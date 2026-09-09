import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { spawn, ChildProcess, execSync } from 'child_process';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createRequire } from 'module';

const cjsRequire = typeof require !== 'undefined' 
  ? require 
  : createRequire(typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : path.resolve(process.cwd(), 'server.ts'));

dotenv.config({ override: true });

const app = express();
const PORT = 3000;
app.use(express.json());

// Global Keep-Alive & Anti-Freeze Header Middleware
app.use((_req: Request, res: Response, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=120, max=1000');
  next();
});

// API health endpoint for container & reverse proxy checks
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ==================== BOT STATE & LOGS CONTROLLER ====================
interface BotLog {
  id: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'system';
  text: string;
}

interface BotPersistedState {
  desiredState: 'running' | 'stopped';
  autoRestart: boolean;
  lastStartedAt: number;
}

const BOT_STATE_PATH = path.resolve(process.cwd(), 'bot-state.json');

function loadBotState(): BotPersistedState {
  try {
    if (fs.existsSync(BOT_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(BOT_STATE_PATH, 'utf8'));
    }
  } catch (e) {}
  return {
    desiredState: 'running',
    autoRestart: true,
    lastStartedAt: 0
  };
}

function saveBotState(patch: Partial<BotPersistedState>) {
  try {
    const current = loadBotState();
    const updated = { ...current, ...patch };
    fs.writeFileSync(BOT_STATE_PATH, JSON.stringify(updated, null, 2), 'utf8');
  } catch (e) {}
}

let botProcess: ChildProcess | null = null;
let botStartTime: number | null = null;
let botStatus: 'running' | 'stopped' | 'starting' | 'error' = 'stopped';
const logs: BotLog[] = [];
const MAX_LOGS = 300;
const LOGS_AUTO_CLEAR_THRESHOLD = 285; // Saat mendekati angka 300 (285+ baris), otomatis bersihkan log

function addLog(type: 'stdout' | 'stderr' | 'system', text: string) {
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;

    const logItem: BotLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
      type,
      text: line.trim()
    };
    logs.push(logItem);

    // Otomatis bersihkan saat mendekati angka 300 untuk menjaga performa & memori
    if (logs.length >= LOGS_AUTO_CLEAR_THRESHOLD) {
      const recent = logs.slice(-5);
      logs.length = 0;
      logs.push({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
        type: 'system',
        text: `[SYSTEM] 🧹 Live console & Lavalink log otomatis dibersihkan (mencapai ${LOGS_AUTO_CLEAR_THRESHOLD} log, mendekati batas 300). Buffer di-reset demi performa & kestabilan.`
      });
      logs.push(...recent);
    }
  }
}

// Supervisor & State
let isDesiredRunning = loadBotState().desiredState !== 'stopped';
let autoRestartTimer: NodeJS.Timeout | null = null;
let restartAttemptsInWindow = 0;
let lastRestartWindowReset = Date.now();
let keepAlivePingsCount = 0;
let lastKeepAlivePingTime = Date.now();

function startBot(isManual = false): { success: boolean; message: string } {
  if (isManual) {
    isDesiredRunning = true;
    saveBotState({ desiredState: 'running', autoRestart: true, lastStartedAt: Date.now() });
    if (autoRestartTimer) {
      clearTimeout(autoRestartTimer);
      autoRestartTimer = null;
    }
  }

  if (botProcess && !botProcess.killed) {
    return { success: false, message: 'Bot sudah berjalan.' };
  }

  // Terminate any leftover zombie processes to avoid duplicate event handlers
  try {
    execSync('pkill -9 -f "node.*bot\\.cjs" || true');
  } catch (e) {}

  const token = process.env.TOKEN;
  if (!token || token.trim().length < 10) {
    addLog('system', '[SYSTEM] ⚠️ Peringatan: TOKEN belum dikonfigurasi di Settings/Secrets atau .env');
  }

  botStatus = 'starting';
  addLog('system', '[SYSTEM] 🚀 Memulai On Ao Discord Music Bot process (bot.cjs)...');

  try {
    const botScriptPath = path.resolve(process.cwd(), 'bot.cjs');
    botProcess = spawn('node', [botScriptPath], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    botStartTime = Date.now();
    botStatus = 'running';
    addLog('system', `[SYSTEM] ✅ Process started (PID: ${botProcess.pid})`);

    botProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      addLog('stdout', output);
    });

    botProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      addLog('stderr', output);
    });

    botProcess.on('close', (code, signal) => {
      botStatus = 'stopped';
      botStartTime = null;
      addLog('system', `[SYSTEM] ⏹️ Bot process berhenti (code: ${code}, signal: ${signal || 'none'})`);
      botProcess = null;

      // Auto-Recovery Supervisor
      const state = loadBotState();
      if (isDesiredRunning && state.autoRestart !== false) {
        const now = Date.now();
        if (now - lastRestartWindowReset > 60000) {
          restartAttemptsInWindow = 0;
          lastRestartWindowReset = now;
        }
        restartAttemptsInWindow++;

        if (restartAttemptsInWindow > 5) {
          addLog('system', `[SUPERVISOR] ⚠️ Terdeteksi restart berulang. Menunda pemulihan 15 detik...`);
          if (autoRestartTimer) clearTimeout(autoRestartTimer);
          autoRestartTimer = setTimeout(() => {
            restartAttemptsInWindow = 0;
            addLog('system', `[SUPERVISOR] 🔄 Memulai kembali bot...`);
            startBot(false);
          }, 15000);
        } else {
          addLog('system', `[SUPERVISOR] 🛡️ Auto-Recovery: Menghidupkan ulang bot dalam 3 detik...`);
          if (autoRestartTimer) clearTimeout(autoRestartTimer);
          autoRestartTimer = setTimeout(() => {
            startBot(false);
          }, 3000);
        }
      }
    });

    botProcess.on('error', (err) => {
      botStatus = 'error';
      addLog('system', `[SYSTEM] ❌ Gagal menjalankan bot: ${err.message}`);
    });

    return { success: true, message: 'Bot berhasil dijalankan.' };
  } catch (err: any) {
    botStatus = 'error';
    addLog('system', `[SYSTEM] ❌ Exception saat start bot: ${err.message}`);
    return { success: false, message: err.message };
  }
}

function stopBot(isManual = false): { success: boolean; message: string } {
  if (isManual) {
    isDesiredRunning = false;
    saveBotState({ desiredState: 'stopped', autoRestart: false });
    if (autoRestartTimer) {
      clearTimeout(autoRestartTimer);
      autoRestartTimer = null;
    }
  }

  addLog('system', '[SYSTEM] 🛑 Menghentikan proses bot...');
  try {
    if (botProcess && !botProcess.killed) {
      botProcess.kill('SIGTERM');
      setTimeout(() => {
        if (botProcess && !botProcess.killed) {
          botProcess.kill('SIGKILL');
        }
      }, 1500);
    }
    try {
      execSync('pkill -9 -f "node.*bot\\.cjs" || true');
    } catch (e) {}
    botStatus = 'stopped';
    botStartTime = null;
    botProcess = null;
    return { success: true, message: 'Bot berhasil dihentikan.' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// Supervisor Watchdog: Verify bot running state periodically
setInterval(() => {
  const state = loadBotState();
  if (isDesiredRunning && state.autoRestart !== false) {
    const isRunning = botProcess !== null && !botProcess.killed;
    if (!isRunning && botStatus !== 'starting') {
      addLog('system', '[SUPERVISOR] 🔍 Watchdog: Bot tidak aktif padahal desiredState=running. Memulihkan...');
      startBot(false);
    }
  }
}, 10000);

// Active Container Keep-Alive Engine: Pings localhost every 15s to keep container port 3000 active & prevent idle suspension
setInterval(() => {
  try {
    lastKeepAlivePingTime = Date.now();
    const req = http.get(`http://127.0.0.1:${PORT}/api/health`, { timeout: 4000 }, (res) => {
      res.resume();
    });
    req.on('error', () => {});
    req.end();
  } catch (e) {}
}, 15000);

// Client ID Extractor
function getClientIdFromToken(token: string): string {
  if (process.env.CLIENT_ID && process.env.CLIENT_ID.trim().length > 10) {
    return process.env.CLIENT_ID.trim();
  }
  if (!token) return '';
  try {
    const firstPart = token.split('.')[0];
    const decoded = Buffer.from(firstPart, 'base64').toString('utf8');
    if (/^\d{17,20}$/.test(decoded)) {
      return decoded;
    }
  } catch (e) {}
  return process.env.CLIENT_ID || '';
}

// ==================== REST API ROUTES ====================

app.get('/api/bot/ping', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  keepAlivePingsCount++;
  res.json({
    status: 'pong',
    timestamp: Date.now(),
    uptime: Math.floor(process.uptime()),
    botStatus: botProcess !== null && !botProcess.killed ? 'online' : botStatus,
    pingsReceived: keepAlivePingsCount,
    lastPingTime: lastKeepAlivePingTime
  });
});

app.get('/api/bot/status', (_req: Request, res: Response) => {
  const isRunning = botProcess !== null && !botProcess.killed;
  const uptime = botStartTime ? Math.floor((Date.now() - botStartTime) / 1000) : 0;

  let hasMessageContentIntent = true;
  let hasGuildMembersIntent = true;
  try {
    const intentPath = path.resolve(process.cwd(), 'intent-status.json');
    if (fs.existsSync(intentPath)) {
      const parsed = JSON.parse(fs.readFileSync(intentPath, 'utf8'));
      hasMessageContentIntent = parsed.hasMessageContentIntent !== false;
      hasGuildMembersIntent = parsed.hasGuildMembersIntent !== false;
    }
  } catch (e) {}

  res.json({
    status: isRunning ? 'online' : (botStatus === 'starting' ? 'starting' : 'offline'),
    pid: botProcess?.pid || null,
    uptime,
    tokenConfigured: Boolean(process.env.TOKEN && process.env.TOKEN.trim().length > 10),
    tokenMasked: process.env.TOKEN ? `${process.env.TOKEN.slice(0, 8)}...${process.env.TOKEN.slice(-4)}` : '',
    hasMessageContentIntent,
    hasGuildMembersIntent,
    keepAliveActive: true,
    autoRestartEnabled: isDesiredRunning,
    lavalink: {
      host: (process.env.LAVALINK_HOST && !process.env.LAVALINK_HOST.includes('sisko.replit.dev')) ? process.env.LAVALINK_HOST : 'lava-v4.millohost.my.id',
      port: process.env.LAVALINK_PORT || '443',
      secure: (process.env.LAVALINK_SECURE || 'true').toLowerCase() === 'true'
    }
  });
});

const PLAYER_STATE_PATH = path.resolve(process.cwd(), 'player-state.json');
const LAVALINK_STATUS_PATH = path.resolve(process.cwd(), 'lavalink-status.json');
const RECONNECT_FLAG_PATH = path.resolve(process.cwd(), 'lavalink-reconnect.flag');

app.get('/api/bot/lavalink-status', (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(LAVALINK_STATUS_PATH)) {
      const data = JSON.parse(fs.readFileSync(LAVALINK_STATUS_PATH, 'utf8'));
      return res.json(data);
    }
  } catch (e) {}

  const defaultHost = (process.env.LAVALINK_HOST && !process.env.LAVALINK_HOST.includes('sisko.replit.dev')) ? process.env.LAVALINK_HOST : 'lava-v4.millohost.my.id';
  res.json({
    nodes: [
      {
        id: 'millohost-v4',
        host: defaultHost,
        port: parseInt(process.env.LAVALINK_PORT || '443', 10),
        secure: (process.env.LAVALINK_SECURE || 'true').toLowerCase() === 'true',
        status: 'disconnected',
        attempts: 0,
        nextRetryInMs: 0,
        cooldownUntil: 0,
        lastError: null,
        ping: null,
        updatedAt: Date.now()
      }
    ],
    updatedAt: Date.now()
  });
});

app.post('/api/bot/lavalink-reconnect', (_req: Request, res: Response) => {
  try {
    fs.writeFileSync(RECONNECT_FLAG_PATH, JSON.stringify({ requestedAt: Date.now() }), 'utf8');
    addLog('system', '[SYSTEM] ⚡ Force Reconnect Lavalink dipicu dari UI.');
    res.json({ success: true, message: 'Instruksi reconnect berhasil dikirim ke Lavalink Manager.' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

const BOT_GUILDS_PATH = path.resolve(process.cwd(), 'bot-guilds.json');
const PLAYERS_STATE_PATH = path.resolve(process.cwd(), 'players-state.json');
const IPC_COMMAND_PATH = path.resolve(process.cwd(), 'ipc-command.json');

function sendIpcToBot(command: any) {
  try {
    fs.writeFileSync(IPC_COMMAND_PATH, JSON.stringify(command), 'utf8');
  } catch (e) {}
  if (botProcess && !botProcess.killed && botProcess.stdin && botProcess.stdin.writable) {
    try {
      botProcess.stdin.write(JSON.stringify(command) + '\n');
    } catch (e) {}
  }
}

app.get('/api/bot/guilds', async (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(BOT_GUILDS_PATH)) {
      const data = JSON.parse(fs.readFileSync(BOT_GUILDS_PATH, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        return res.json({ success: true, guilds: data });
      }
    }
  } catch (e) {}

  // Fallback to Discord REST API if file not written yet
  const token = process.env.TOKEN;
  if (token && token.trim().length > 20) {
    try {
      const rest = new REST({ version: '10' }).setToken(token);
      const discordGuilds = await rest.get(Routes.userGuilds()) as Array<{ id: string; name: string; icon: string | null }>;
      const mapped = discordGuilds.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
        memberCount: 0,
        botInVoice: false,
        isPlaying: false,
        isPaused: false,
        current: null,
        volume: 100,
        loop: 'off',
        filter: 'Normal',
        crossfade: 0,
        queueCount: 0
      }));
      return res.json({ success: true, guilds: mapped });
    } catch (e) {}
  }

  res.json({ success: true, guilds: [] });
});

app.post('/api/bot/control', (req: Request, res: Response) => {
  const { action, guildId, data } = req.body;
  if (!action) {
    return res.status(400).json({ success: false, message: 'Action diperlukan.' });
  }
  sendIpcToBot({ action, guildId, data });
  addLog('system', `[REMOTE CONTROL] 🕹️ Perintah '${action}' dikirim ke bot (Guild: ${guildId || 'active'}).`);
  res.json({ success: true, action, guildId });
});

app.get('/api/bot/player-state', (req: Request, res: Response) => {
  const queryGuildId = (req.query.guildId as string) || '';
  try {
    if (queryGuildId && fs.existsSync(PLAYERS_STATE_PATH)) {
      const allStates = JSON.parse(fs.readFileSync(PLAYERS_STATE_PATH, 'utf8'));
      if (allStates[queryGuildId]) {
        return res.json(allStates[queryGuildId]);
      }
    }
    if (fs.existsSync(PLAYER_STATE_PATH)) {
      const data = JSON.parse(fs.readFileSync(PLAYER_STATE_PATH, 'utf8'));
      return res.json(data);
    }
  } catch (e) {}
  res.json({
    active: false,
    isPlaying: false,
    current: null,
    queue: [],
    queueCount: 0,
    volume: 100,
    loop: 'off',
    filter: 'Normal',
    filter_eq: 'flat',
    bassboost: 0,
    nightcore: false,
    vaporwave: false,
    eightD: false,
    vocalboost: false,
    crossfade: 0,
    updatedAt: Date.now()
  });
});

app.post('/api/bot/start', (_req: Request, res: Response) => {
  const result = startBot(true);
  res.json(result);
});

app.post('/api/bot/stop', (_req: Request, res: Response) => {
  const result = stopBot(true);
  res.json(result);
});

app.post('/api/bot/restart', (_req: Request, res: Response) => {
  stopBot(false);
  setTimeout(() => {
    const result = startBot(true);
    res.json({ success: true, message: 'Bot berhasil direstart.', details: result });
  }, 1000);
});

app.get('/api/bot/logs', (_req: Request, res: Response) => {
  res.json({
    logs,
    count: logs.length,
    maxLogs: MAX_LOGS,
    threshold: LOGS_AUTO_CLEAR_THRESHOLD,
    autoClearEnabled: true
  });
});

app.post('/api/bot/logs/clear', (_req: Request, res: Response) => {
  logs.length = 0;
  addLog('system', '[SYSTEM] 🧹 Live console & Lavalink log berhasil dibersihkan secara manual.');
  res.json({ success: true, count: logs.length });
});

// Profiles API
const PROFILES_PATH = path.resolve(process.cwd(), 'profiles.json');

app.get('/api/bot/profiles', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(PROFILES_PATH)) {
      return res.json({});
    }
    const data = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot/profiles', (req: Request, res: Response) => {
  try {
    const { profiles } = req.body;
    if (typeof profiles !== 'object' || profiles === null) {
      return res.status(400).json({ error: 'Format profiles tidak valid' });
    }
    fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Profile Card Preview Endpoint (Renders real On Ao Music Card)
app.get('/api/bot/profile-card-preview/:userId?', async (req: Request, res: Response) => {
  try {
    const { generateOnAoProfileCard } = cjsRequire('./profile-canvas.cjs');
    let profiles: any = {};
    if (fs.existsSync(PROFILES_PATH)) {
      try {
        profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
      } catch (e) {}
    }

    const userId = req.params.userId || Object.keys(profiles)[0];
    const userProf = (userId && profiles[userId]) ? profiles[userId] : null;

    const username = userProf?.username || req.query.username || 'ryezenki';
    const avatarUrl = userProf?.avatarUrl || null;
    const lang = (req.query.lang as string) || 'id';

    let servers: Array<{ name: string; durationSec: number }> = [];
    if (userProf?.servers && typeof userProf.servers === 'object') {
      servers = Object.entries(userProf.servers).map(([name, sec]) => ({
        name,
        durationSec: Number(sec) || 0
      })).sort((a, b) => b.durationSec - a.durationSec);
    }

    let friends: Array<{ username: string; durationSec: number }> = [];
    if (userProf?.friends && typeof userProf.friends === 'object') {
      friends = Object.entries(userProf.friends).map(([u, sec]) => ({
        username: u,
        durationSec: Number(sec) || 0
      })).sort((a, b) => b.durationSec - a.durationSec);
    }

    let tracks: Array<{ title: string; durationSec: number; count: number }> = [];
    if (userProf?.tracks && typeof userProf.tracks === 'object') {
      tracks = Object.values(userProf.tracks).map((t: any) => ({
        title: t.title,
        durationSec: Number(t.seconds) || (Number(t.count) * 180),
        count: t.count || 1
      })).sort((a: any, b: any) => b.durationSec - a.durationSec);
    }

    const color = (req.query.color as string) || userProf?.color || 'red';
    const background = (req.query.background as string) || userProf?.background || null;
    const privacy = userProf?.privacy || {
      servers: (req.query.privacyServers as string) || 'public',
      friends: (req.query.privacyFriends as string) || 'public',
      tracks: (req.query.privacyTracks as string) || 'public'
    };
    const isOwner = req.query.isOwner === 'true';

    const buffer = await generateOnAoProfileCard({
      username,
      avatarUrl,
      color,
      background,
      privacy,
      servers,
      friends,
      tracks,
      favSong: userProf?.favSong || tracks[0]?.title || null,
      favCount: userProf?.favCount || tracks[0]?.count || 0,
      totalHours: userProf?.seconds ? Math.round((userProf.seconds / 3600) * 10) / 10 : undefined,
      isOwner,
      lang
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=10');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Settings & Language API
const SETTINGS_PATH = path.resolve(process.cwd(), 'bot-settings.json');

app.get('/api/bot/language', (_req: Request, res: Response) => {
  try {
    let settings = { defaultLanguage: 'id', guilds: {}, users: {} };
    if (fs.existsSync(SETTINGS_PATH)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot/language', (req: Request, res: Response) => {
  try {
    const { language, guildId } = req.body;
    const validLang = ['en', 'english'].includes(String(language).toLowerCase()) ? 'en' : 'id';
    let settings: any = { defaultLanguage: 'id', guilds: {}, users: {} };
    if (fs.existsSync(SETTINGS_PATH)) {
      try {
        settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      } catch (e) {}
    }
    if (guildId) {
      if (!settings.guilds) settings.guilds = {};
      if (!settings.guilds[guildId]) settings.guilds[guildId] = {};
      settings.guilds[guildId].language = validLang;
    } else {
      settings.defaultLanguage = validLang;
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    res.json({ success: true, language: validLang });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Config API
app.get('/api/bot/config', (_req: Request, res: Response) => {
  res.json({
    token: process.env.TOKEN || '',
    tokenMasked: process.env.TOKEN ? `${process.env.TOKEN.slice(0, 8)}••••••••${process.env.TOKEN.slice(-4)}` : '',
    guildId: process.env.GUILD_ID || '',
    lavalinkHost: process.env.LAVALINK_HOST || 'lavalink.heavencloud.in',
    lavalinkPort: process.env.LAVALINK_PORT || '443',
    lavalinkPassword: process.env.LAVALINK_PASSWORD || 'heavencloud',
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    defaultVolume: 100
  });
});

app.post('/api/bot/config', (req: Request, res: Response) => {
  try {
    const { token, guildId, lavalinkHost, lavalinkPort, lavalinkPassword, spotifyClientId, spotifyClientSecret } = req.body;

    if (token !== undefined) process.env.TOKEN = token;
    if (guildId !== undefined) process.env.GUILD_ID = guildId;
    if (lavalinkHost !== undefined) process.env.LAVALINK_HOST = lavalinkHost;
    if (lavalinkPort !== undefined) process.env.LAVALINK_PORT = lavalinkPort;
    if (lavalinkPassword !== undefined) process.env.LAVALINK_PASSWORD = lavalinkPassword;
    if (spotifyClientId !== undefined) process.env.SPOTIFY_CLIENT_ID = spotifyClientId;
    if (spotifyClientSecret !== undefined) process.env.SPOTIFY_CLIENT_SECRET = spotifyClientSecret;

    const envContent = [
      `TOKEN="${process.env.TOKEN || ''}"`,
      `GUILD_ID="${process.env.GUILD_ID || ''}"`,
      `CLIENT_ID="${process.env.CLIENT_ID || ''}"`,
      `LAVALINK_HOST="${process.env.LAVALINK_HOST || 'lavalink.heavencloud.in'}"`,
      `LAVALINK_PORT="${process.env.LAVALINK_PORT || '443'}"`,
      `LAVALINK_PASSWORD="${process.env.LAVALINK_PASSWORD || 'heavencloud'}"`,
      `LAVALINK_SECURE="${process.env.LAVALINK_SECURE || 'true'}"`,
      `SPOTIFY_CLIENT_ID="${process.env.SPOTIFY_CLIENT_ID || ''}"`,
      `SPOTIFY_CLIENT_SECRET="${process.env.SPOTIFY_CLIENT_SECRET || ''}"`,
      `APP_URL="${process.env.APP_URL || ''}"`,
      `GEMINI_API_KEY="${process.env.GEMINI_API_KEY || ''}"`
    ].join('\n');

    fs.writeFileSync(path.resolve(process.cwd(), '.env'), envContent);
    addLog('system', '[CONFIG] ⚙️ Konfigurasi bot berhasil diperbarui.');

    res.json({ success: true, message: 'Konfigurasi berhasil disimpan.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download ZIP API
app.get('/api/download-bot-zip', (_req: Request, res: Response) => {
  const standaloneZip = path.resolve(process.cwd(), 'public', 'discord-bot-standalone.zip');
  if (fs.existsSync(standaloneZip)) {
    return res.download(standaloneZip, 'discord-bot-standalone.zip');
  }
  res.status(404).json({ error: 'File ZIP belum tersedia.' });
});

app.get('/api/download-zip', (_req: Request, res: Response) => {
  const fullZip = path.resolve(process.cwd(), 'public', 'discord-bot-full-project.zip');
  const standaloneZip = path.resolve(process.cwd(), 'public', 'discord-bot-standalone.zip');
  const target = fs.existsSync(fullZip) ? fullZip : standaloneZip;
  if (fs.existsSync(target)) {
    return res.download(target, 'discord-bot-full-project.zip');
  }
  res.status(404).json({ error: 'File ZIP belum tersedia.' });
});

// Commands API
const BOT_COMMANDS = [
  { name: 'play', category: 'playback', desc: 'Putar lagu atau playlist musik (Prefix: on play <lagu> | on p)', params: 'query (String, Required)' },
  { name: 'playnext', category: 'playback', desc: 'Sisipkan lagu langsung di posisi terdepan antrian (Prefix: on playnext <lagu> | on pn)', params: 'query (String, Required)' },
  { name: 'playskip', category: 'playback', desc: 'Lewati lagu sekarang dan langsung putar lagu baru (Prefix: on playskip <lagu> | on ps)', params: 'query (String, Required)' },
  { name: 'search', category: 'playback', desc: 'Cari dan pilih lagu dari 5 hasil teratas (Prefix: on search <kata kunci>)', params: 'query (String, Required)' },
  { name: 'skip', category: 'playback', desc: 'Lewati lagu yang sedang diputar (Prefix: on skip | on s)', params: 'None' },
  { name: 'forceskip', category: 'playback', desc: 'Lewati lagu secara paksa (khusus DJ / Admin) (Prefix: on forceskip | on fs)', params: 'None' },
  { name: 'voteskip', category: 'playback', desc: 'Lakukan voting demokratis untuk lewati lagu (Prefix: on voteskip | on vs)', params: 'None' },
  { name: 'pause', category: 'playback', desc: 'Jeda pemutaran musik sementara (Prefix: on pause)', params: 'None' },
  { name: 'resume', category: 'playback', desc: 'Lanjutkan pemutaran musik (Prefix: on resume)', params: 'None' },
  { name: 'stop', category: 'playback', desc: 'Hentikan musik dan keluar dari voice channel (Prefix: on stop)', params: 'None' },
  { name: 'nowplaying', category: 'playback', desc: 'Info detail lagu sedang berputar & progress bar (Prefix: on np)', params: 'None' },
  { name: 'seek', category: 'playback', desc: 'Lompat ke detik tertentu dalam lagu (Prefix: on seek <detik>)', params: 'seconds (Integer, Required)' },
  { name: 'forward', category: 'playback', desc: 'Maju cepat sekian detik dalam lagu (Prefix: on forward <detik> | on fwd)', params: 'seconds (Integer, Default 15)' },
  { name: 'rewind', category: 'playback', desc: 'Mundur sekian detik dalam lagu (Prefix: on rewind <detik> | on rw)', params: 'seconds (Integer, Default 15)' },
  { name: 'replay', category: 'playback', desc: 'Ulangi lagu saat ini dari detik ke-0 (Prefix: on replay | on restart)', params: 'None' },
  { name: 'previous', category: 'playback', desc: 'Putar kembali lagu sebelumnya yang baru saja selesai (Prefix: on prev | on back)', params: 'None' },
  { name: 'queue', category: 'queue', desc: 'Tampilkan daftar antrian lagu saat ini (Prefix: on queue | on q)', params: 'None' },
  { name: 'clearqueue', category: 'queue', desc: 'Kosongkan seluruh daftar antrian lagu (Prefix: on clearqueue | on cq)', params: 'None' },
  { name: 'remove', category: 'queue', desc: 'Hapus lagu dari antrian berdasarkan nomor urut (Prefix: on remove <no>)', params: 'position (Integer, Required)' },
  { name: 'skipto', category: 'queue', desc: 'Lompat langsung ke nomor antrian tertentu (Prefix: on skipto <no>)', params: 'position (Integer, Required)' },
  { name: 'move', category: 'queue', desc: 'Pindahkan posisi lagu dalam antrian (Prefix: on move <dari> <ke>)', params: 'from (Int), to (Int)' },
  { name: 'swap', category: 'queue', desc: 'Tukar posisi dua lagu di dalam antrian (Prefix: on swap <pos1> <pos2>)', params: 'pos1 (Int), pos2 (Int)' },
  { name: 'loop', category: 'playback', desc: 'Toggle mode perulangan: Off, Track, atau Queue (Prefix: on loop | on l)', params: 'None' },
  { name: 'shuffle', category: 'queue', desc: 'Acak urutan daftar antrian lagu (Prefix: on shuffle | on sh)', params: 'None' },
  { name: 'volume', category: 'playback', desc: 'Sesuaikan tingkat volume audio 1 - 100% (Prefix: on volume <1-100>)', params: 'level (Integer, 1-100)' },
  { name: 'grab', category: 'utilities', desc: 'Kirimkan detail dan info lagu saat ini ke DM pribadi (Prefix: on grab | on save)', params: 'None' },
  { name: 'radio', category: 'playback', desc: 'Putar siaran radio online 24/7 (Lofi, Jazz, Synthwave, Genshin, Pop) (Prefix: on radio <stasiun>)', params: 'station (String, Optional)' },
  { name: 'join', category: 'playback', desc: 'Perintahkan bot masuk ke voice channel kamu (Prefix: on join | on summon)', params: 'None' },
  { name: 'leave', category: 'playback', desc: 'Perintahkan bot keluar dari voice channel (Prefix: on leave)', params: 'None' },
  { name: 'dj', category: 'dj', desc: 'Cek status atau toggle mode DJ di server (Prefix: on dj [toggle|on|off])', params: 'action (Optional)' },
  { name: 'setdj', category: 'dj', desc: 'Tentukan role khusus DJ untuk mengendalikan musik (Prefix: on setdj <role>)', params: 'role (Role, Required)' },
  { name: 'bassboost', category: 'filters', desc: 'Aktifkan filter penambah bass tingkat 1-3 (Prefix: on bass <1-3>)', params: 'level (Integer, 1-3)' },
  { name: 'nightcore', category: 'filters', desc: 'Aktifkan efek audio Nightcore (tempo naik + pitch tinggi) (Prefix: on nightcore | on nc)', params: 'None' },
  { name: 'vaporwave', category: 'filters', desc: 'Aktifkan efek audio Vaporwave (tempo rileks) (Prefix: on vaporwave | on vw)', params: 'None' },
  { name: '8d', category: 'filters', desc: 'Aktifkan efek audio 3D/8D surround berputar (Prefix: on 8d)', params: 'None' },
  { name: 'vocalboost', category: 'filters', desc: 'Perjelas suara vokal penyanyi dengan isolasi frekuensi midrange (Prefix: on vocal | on vocalboost)', params: 'None' },
  { name: 'filters', category: 'filters', desc: 'Buka menu equalizer & audio filters interaktif real-time (Prefix: on filters | on fx)', params: 'None' },
  { name: 'crossfade', category: 'playback', desc: 'Atur transisi mulus gapless playback antar lagu 0-5 detik (Prefix: on crossfade [detik])', params: 'seconds (Integer, 0-5)' },
  { name: 'equalizer', category: 'filters', desc: 'Terapkan preset mastering audio (Vocal, Hi-Fi, Studio, Bass, Treble, Flat) (Prefix: on eq <preset>)', params: 'preset (vocal/hifi/studio/bass/treble/flat)' },
  { name: 'resetfilter', category: 'filters', desc: 'Matikan semua filter efek audio dan reset ke suara asli (Prefix: on resetfilter)', params: 'None' },
  { name: 'autoplay', category: 'automation', desc: 'Aktifkan rekomendasi lagu otomatis saat antrian habis (Prefix: on autoplay)', params: 'None' },
  { name: '247', category: 'automation', desc: 'Bot menetap di voice channel tanpa disconnect saat idle (Prefix: on 247)', params: 'None' },
  { name: 'profile', category: 'utilities', desc: 'Lihat kartu statistik profil musik On Ao (Prefix: on profile [@user])', params: 'user (User, Optional)' },
  { name: 'setprofile', category: 'utilities', desc: 'Kustomisasi tema warna, background, dan privasi kartu profil (Prefix: on profile color/bg/privacy/reset)', params: 'color/bg/privacy/reset' },
  { name: 'language', category: 'utilities', desc: 'Ganti bahasa bot ke Indonesia atau English (Prefix: on language [id|en] [server|user])', params: 'choice (id/en), scope (server/user)' },
  { name: 'prefix', category: 'utilities', desc: 'Lihat atau ubah prefix server (Prefix: on prefix [prefix_baru] | !prefix)', params: 'new_prefix (String, Optional)' },
  { name: 'lyrics', category: 'utilities', desc: 'Cari lirik lagu dari database online (Prefix: on lyrics [judul])', params: 'title (String, Optional)' },
  { name: 'quality', category: 'utilities', desc: 'Cek bitrate Voice Channel & panduan optimasi audio jernih (Prefix: on quality)', params: 'None' },
  { name: 'ping', category: 'utilities', desc: 'Cek latency WebSocket bot dan responsivitas server (Prefix: on ping)', params: 'None' },
  { name: 'stats', category: 'utilities', desc: 'Lihat uptime sistem, memori, dan status audio node (Prefix: on stats | on botinfo)', params: 'None' },
  { name: 'help', category: 'utilities', desc: 'Tampilkan buku panduan perintah lengkap (Prefix: on help | on)', params: 'None' }
];

app.get('/api/bot/commands', (_req: Request, res: Response) => {
  res.json(BOT_COMMANDS);
});

// Deploy Slash Commands Endpoint
app.post('/api/bot/deploy-commands', async (req: Request, res: Response) => {
  const token = process.env.TOKEN;
  if (!token || token.trim().length < 20) {
    return res.status(400).json({ success: false, message: 'TOKEN Discord Bot belum diisi atau tidak valid.' });
  }

  const clientId = getClientIdFromToken(token);
  if (!clientId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Client ID tidak dapat dideteksi dari Token. Masukkan CLIENT_ID di konfigurasi.' 
    });
  }

  const targetGuildId = req.body.guildId || process.env.GUILD_ID;
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    const slashCommandsList = [
      new SlashCommandBuilder().setName('play').setDescription('Putar lagu atau playlist musik').addStringOption(opt => opt.setName('query').setDescription('Judul lagu atau link YouTube/Spotify/SoundCloud').setRequired(true)),
      new SlashCommandBuilder().setName('playnext').setDescription('Sisipkan lagu di urutan pertama antrian').addStringOption(opt => opt.setName('query').setDescription('Judul lagu atau URL').setRequired(true)),
      new SlashCommandBuilder().setName('playskip').setDescription('Lewati lagu saat ini dan langsung putar lagu baru').addStringOption(opt => opt.setName('query').setDescription('Judul lagu atau URL').setRequired(true)),
      new SlashCommandBuilder().setName('search').setDescription('Cari dan pilih lagu dari 5 hasil teratas').addStringOption(opt => opt.setName('query').setDescription('Kata kunci lagu').setRequired(true)),
      new SlashCommandBuilder().setName('skip').setDescription('Lewati lagu yang sedang diputar'),
      new SlashCommandBuilder().setName('forceskip').setDescription('Lewati lagu secara paksa (khusus DJ / Admin)'),
      new SlashCommandBuilder().setName('voteskip').setDescription('Lakukan voting bersama untuk lewati lagu'),
      new SlashCommandBuilder().setName('stop').setDescription('Hentikan musik dan keluar dari voice channel'),
      new SlashCommandBuilder().setName('pause').setDescription('Jeda musik yang sedang berputar'),
      new SlashCommandBuilder().setName('resume').setDescription('Lanjutkan pemutaran musik'),
      new SlashCommandBuilder().setName('queue').setDescription('Lihat daftar antrian lagu'),
      new SlashCommandBuilder().setName('clearqueue').setDescription('Kosongkan seluruh antrian musik'),
      new SlashCommandBuilder().setName('remove').setDescription('Hapus lagu tertentu dari antrian').addIntegerOption(opt => opt.setName('position').setDescription('Nomor antrian (cek di /queue)').setRequired(true).setMinValue(1)),
      new SlashCommandBuilder().setName('skipto').setDescription('Lompat langsung ke lagu nomor tertentu di antrian').addIntegerOption(opt => opt.setName('position').setDescription('Nomor antrian tujuan').setRequired(true).setMinValue(1)),
      new SlashCommandBuilder().setName('move').setDescription('Pindahkan urutan lagu di antrian')
        .addIntegerOption(opt => opt.setName('from').setDescription('Posisi lagu saat ini').setRequired(true).setMinValue(1))
        .addIntegerOption(opt => opt.setName('to').setDescription('Posisi tujuan baru').setRequired(true).setMinValue(1)),
      new SlashCommandBuilder().setName('swap').setDescription('Tukar posisi dua lagu di antrian')
        .addIntegerOption(opt => opt.setName('pos1').setDescription('Nomor lagu pertama').setRequired(true).setMinValue(1))
        .addIntegerOption(opt => opt.setName('pos2').setDescription('Nomor lagu kedua').setRequired(true).setMinValue(1)),
      new SlashCommandBuilder().setName('loop').setDescription('Ganti mode perulangan: Off / Track / Queue').addStringOption(opt =>
        opt.setName('mode').setDescription('Pilih mode perulangan (opsional)').setRequired(false).addChoices(
          { name: 'Off (Matikan Loop)', value: 'off' },
          { name: 'Track (Ulang Lagu Saat Ini)', value: 'track' },
          { name: 'Queue (Ulang Seluruh Antrian)', value: 'queue' }
        )
      ),
      new SlashCommandBuilder().setName('volume').setDescription('Atur volume pemutaran musik (1-100)').addIntegerOption(opt => opt.setName('level').setDescription('Nilai volume (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),
      new SlashCommandBuilder().setName('shuffle').setDescription('Acak urutan antrian lagu'),
      new SlashCommandBuilder().setName('nowplaying').setDescription('Lihat lagu yang sedang diputar beserta progress bar'),
      new SlashCommandBuilder().setName('np').setDescription('Lihat lagu yang sedang diputar beserta progress bar (alias /nowplaying)'),
      new SlashCommandBuilder().setName('seek').setDescription('Lompat ke detik tertentu dalam lagu').addIntegerOption(opt => opt.setName('seconds').setDescription('Detik tujuan').setRequired(true).setMinValue(0)),
      new SlashCommandBuilder().setName('forward').setDescription('Maju sekian detik dalam lagu').addIntegerOption(opt => opt.setName('seconds').setDescription('Jumlah detik (default: 15)').setRequired(false).setMinValue(1)),
      new SlashCommandBuilder().setName('rewind').setDescription('Mundur sekian detik dalam lagu').addIntegerOption(opt => opt.setName('seconds').setDescription('Jumlah detik (default: 15)').setRequired(false).setMinValue(1)),
      new SlashCommandBuilder().setName('replay').setDescription('Ulangi lagu saat ini dari awal'),
      new SlashCommandBuilder().setName('previous').setDescription('Putar kembali lagu sebelumnya'),
      new SlashCommandBuilder().setName('grab').setDescription('Kirim info lagu yang sedang berputar ke Direct Message kamu'),
      new SlashCommandBuilder().setName('radio').setDescription('Putar siaran radio online 24/7').addStringOption(opt =>
        opt.setName('station').setDescription('Pilih stasiun radio').setRequired(false).addChoices(
          { name: '☕ Lofi Hip Hop Beats (Relax/Study)', value: 'lofi' },
          { name: '🎷 Chillhop Cafe & Smooth Jazz', value: 'chill' },
          { name: '🌃 Synthwave / Retrowave 80s', value: 'synthwave' },
          { name: '✨ Genshin & Anime OST Symphony', value: 'anime' },
          { name: '🎧 Asian Pop & J-Pop Hits', value: 'pop' }
        )
      ),
      new SlashCommandBuilder().setName('join').setDescription('Perintahkan bot masuk ke voice channel kamu'),
      new SlashCommandBuilder().setName('leave').setDescription('Keluarkan bot dari voice channel'),
      new SlashCommandBuilder().setName('dj').setDescription('Cek atau aktifkan/nonaktifkan DJ Mode').addStringOption(opt =>
        opt.setName('action').setDescription('Pilihan aksi').setRequired(false).addChoices(
          { name: 'Lihat Status DJ', value: 'status' },
          { name: 'Aktifkan DJ Mode', value: 'on' },
          { name: 'Matikan DJ Mode', value: 'off' }
        )
      ),
      new SlashCommandBuilder().setName('setdj').setDescription('Tentukan Role khusus DJ di server').addRoleOption(opt => opt.setName('role').setDescription('Role Discord untuk DJ').setRequired(true)),
      new SlashCommandBuilder().setName('bassboost').setDescription('Terapkan efek bassboost (level 1-3)').addIntegerOption(opt => opt.setName('level').setDescription('Pilih level bass (1: Low +20%, 2: Med +40%, 3: Extreme +65%)').setRequired(true).setMinValue(1).setMaxValue(3)),
      new SlashCommandBuilder().setName('nightcore').setDescription('Toggle filter Nightcore (tempo cepat + nada tinggi)'),
      new SlashCommandBuilder().setName('vaporwave').setDescription('Toggle filter Vaporwave (santai & lambat)'),
      new SlashCommandBuilder().setName('8d').setDescription('Toggle efek 8D Audio surround berputar'),
      new SlashCommandBuilder().setName('vocalboost').setDescription('Toggle filter vocal booster (memperjelas vokal penyanyi)'),
      new SlashCommandBuilder().setName('filters').setDescription('Buka panel interaktif filter audio & equalizer real-time'),
      new SlashCommandBuilder().setName('crossfade').setDescription('Atur transisi halus antar lagu (1-5 detik, gapless playback)').addIntegerOption(opt => opt.setName('seconds').setDescription('Durasi transisi dalam detik (0-5, default: 1)').setRequired(false).setMinValue(0).setMaxValue(5)),
      new SlashCommandBuilder().setName('equalizer').setDescription('Pilih preset equalizer mastering').addStringOption(opt =>
        opt.setName('preset').setDescription('Preset suara').setRequired(true).addChoices(
          { name: '🎤 Vocal Booster (Vokal Jernih)', value: 'vocal' },
          { name: '✨ Hi-Fi Clarity (Bening & Bersih)', value: 'hifi' },
          { name: '🎙️ Studio Warmth (Seimbang)', value: 'studio' },
          { name: '🔊 Deep Bass HD (Bass Solid)', value: 'deep bass' },
          { name: '🎮 Gaming & Spatial Audio', value: 'gaming' },
          { name: '🎸 Treble Boost (Cymbals & Akustik)', value: 'treble' },
          { name: '🔄 Flat (Default Original)', value: 'flat' }
        )
      ),
      new SlashCommandBuilder().setName('resetfilter').setDescription('Matikan semua filter audio dan reset ke suara asli'),
      new SlashCommandBuilder().setName('autoplay').setDescription('Toggle rekomendasi lagu otomatis setelah antrian habis'),
      new SlashCommandBuilder().setName('247').setDescription('Toggle mode 24/7 tetap di voice channel'),
      new SlashCommandBuilder().setName('profile').setDescription('Lihat statistik profil musik user On Ao').addUserOption(opt => opt.setName('user').setDescription('Pilih user (opsional)').setRequired(false)),
      new SlashCommandBuilder().setName('setprofile').setDescription('Kustomisasi kartu profil musik On Ao')
        .addSubcommand(sub =>
          sub.setName('color').setDescription('Ganti tema warna kartu profil')
            .addStringOption(opt => opt.setName('color').setDescription('Warna (merah, biru, pink, oranye, ungu, hijau, kuning, cyan, atau #hex)').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('bg').setDescription('Ganti gambar latar belakang kartu profil')
            .addStringOption(opt => opt.setName('url').setDescription('URL gambar langsung (atau ketik "reset" untuk hapus background)').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('privacy').setDescription('Atur visibilitas bagian kartu profil')
            .addStringOption(opt =>
              opt.setName('section').setDescription('Bagian profil yang ingin diatur').setRequired(true).addChoices(
                { name: 'Daftar Server (servers)', value: 'servers' },
                { name: 'Riwayat Teman (friends)', value: 'friends' },
                { name: 'Riwayat Lagu (tracks)', value: 'tracks' },
                { name: 'Semua Bagian (all)', value: 'all' }
              )
            )
            .addStringOption(opt =>
              opt.setName('status').setDescription('Status privasi').setRequired(true).addChoices(
                { name: 'Public (Dapat dilihat semua orang)', value: 'public' },
                { name: 'Private (Disembunyikan dari kartu publik)', value: 'private' }
              )
            )
        )
        .addSubcommand(sub =>
          sub.setName('reset').setDescription('Reset semua kustomisasi warna, background, dan privasi ke awal')
        ),
      new SlashCommandBuilder().setName('language').setDescription('Ganti bahasa bot / Change bot language').addStringOption(opt =>
        opt.setName('choice').setDescription('Pilih bahasa / Choose language').setRequired(false).addChoices(
          { name: '🇮🇩 Bahasa Indonesia', value: 'id' },
          { name: '🇬🇧 English', value: 'en' }
        )
      ).addStringOption(opt =>
        opt.setName('scope').setDescription('Cakupan Server atau Personal / Scope Server or Personal').setRequired(false).addChoices(
          { name: 'Server (Default untuk semua di server)', value: 'server' },
          { name: 'Personal (Khusus akun kamu saja)', value: 'user' }
        )
      ),
      new SlashCommandBuilder().setName('lyrics').setDescription('Cari lirik lagu online').addStringOption(opt => opt.setName('title').setDescription('Judul lagu (kosongkan untuk lagu saat ini)').setRequired(false)),
      new SlashCommandBuilder().setName('quality').setDescription('Cek status bitrate Voice Channel & tips audio HD'),
      new SlashCommandBuilder().setName('prefix').setDescription('Lihat atau ubah prefix perintah server (Admin Only)').addStringOption(opt => opt.setName('new_prefix').setDescription('Prefix baru (contoh: ! atau >)').setRequired(false)),
      new SlashCommandBuilder().setName('ping').setDescription('Cek latensi WebSocket bot dan koneksi audio'),
      new SlashCommandBuilder().setName('stats').setDescription('Lihat spesifikasi sistem bot, memori, dan status Lavalink'),
      new SlashCommandBuilder().setName('help').setDescription('Tampilkan panduan perintah bot On Ao lengkap')
    ];

    const bodyPayload = slashCommandsList.map(c => c.toJSON());

    // Multi-Guild Deployment: Discover joined guilds
    let targetGuildsList: Array<{ id: string; name: string }> = [];

    if (targetGuildId && targetGuildId.trim() && targetGuildId !== 'all') {
      targetGuildsList.push({ id: targetGuildId.trim(), name: `Server ID ${targetGuildId.trim()}` });
    } else {
      // Query Discord REST for all joined guilds
      try {
        const userGuilds = await rest.get(Routes.userGuilds()) as Array<{ id: string; name: string }>;
        if (Array.isArray(userGuilds) && userGuilds.length > 0) {
          targetGuildsList = userGuilds.map(g => ({ id: g.id, name: g.name }));
        }
      } catch (err: any) {
        addLog('system', `[DEPLOY] ℹ️ Tidak dapat mengambil daftar guild otomatis: ${err.message}`);
      }

      // If BOT_GUILDS_PATH has cached guilds, merge them
      if (fs.existsSync(BOT_GUILDS_PATH)) {
        try {
          const cached = JSON.parse(fs.readFileSync(BOT_GUILDS_PATH, 'utf8'));
          if (Array.isArray(cached)) {
            for (const cg of cached) {
              if (cg.id && !targetGuildsList.find(x => x.id === cg.id)) {
                targetGuildsList.push({ id: cg.id, name: cg.name || cg.id });
              }
            }
          }
        } catch (e) {}
      }

      // If still empty and process.env.GUILD_ID exists, add it
      if (targetGuildsList.length === 0 && process.env.GUILD_ID && process.env.GUILD_ID.trim()) {
        targetGuildsList.push({ id: process.env.GUILD_ID.trim(), name: 'Primary Server' });
      }
    }

    if (targetGuildsList.length > 0) {
      const deployedServers: string[] = [];
      for (const g of targetGuildsList) {
        try {
          addLog('system', `[DEPLOY] ⚡ Mendaftarkan ${slashCommandsList.length} slash commands INSTAN ke: ${g.name} (${g.id})...`);
          await rest.put(Routes.applicationGuildCommands(clientId, g.id), { body: bodyPayload });
          deployedServers.push(g.name);
          addLog('system', `[DEPLOY] ✅ Slash commands BERHASIL DIAKTIFKAN di ${g.name}!`);
        } catch (gErr: any) {
          addLog('system', `[DEPLOY] ⚠️ Gagal mendaftarkan ke ${g.name} (${g.id}): ${gErr.message}`);
        }
      }

      // Also deploy globally in background so future servers get it
      try {
        await rest.put(Routes.applicationCommands(clientId), { body: bodyPayload });
        addLog('system', `[DEPLOY] 🌐 Global slash commands juga berhasil disinkronkan!`);
      } catch (e) {}

      return res.json({
        success: true,
        deployedCount: deployedServers.length,
        guilds: deployedServers,
        message: `Berhasil! ${slashCommandsList.length} slash commands aktif instan di ${deployedServers.length} server: ${deployedServers.join(', ')}.`
      });
    } else {
      addLog('system', `[DEPLOY] 🌐 Mendaftarkan ${slashCommandsList.length} slash commands secara Global...`);
      await rest.put(Routes.applicationCommands(clientId), {
        body: bodyPayload
      });
      addLog('system', `[DEPLOY] ✅ ${slashCommandsList.length} slash commands didaftarkan secara Global!`);
      return res.json({ 
        success: true, 
        message: 'Slash commands berhasil didaftarkan secara Global (perlu beberapa saat sinkronisasi cache Discord).' 
      });
    }
  } catch (err: any) {
    addLog('system', `[DEPLOY] ❌ Gagal mendaftarkan slash commands: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Auto-start bot on boot if TOKEN exists & desiredState is running
setTimeout(() => {
  const state = loadBotState();
  const hasToken = Boolean(process.env.TOKEN && process.env.TOKEN.trim().length > 15);

  if (hasToken && state.desiredState !== 'stopped') {
    console.log('[AUTO-START] 🛡️ TOKEN terdeteksi, menjalankan bot...');
    startBot(false);
  } else if (!hasToken) {
    console.log('[AUTO-START] ℹ️ TOKEN belum diatur. Masukkan Token bot di menu Config.');
  } else {
    console.log('[AUTO-START] ⏸️ Bot berstatus Stopped oleh pengguna.');
  }
}, 1000);

// ==================== VITE MIDDLEWARE / PRODUCTION ====================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] On Ao Bot Studio berjalan di http://0.0.0.0:${PORT}`);
  });
}

// Graceful process shutdown
process.on('SIGTERM', () => {
  if (botProcess && !botProcess.killed) botProcess.kill('SIGTERM');
  process.exit(0);
});
process.on('SIGINT', () => {
  if (botProcess && !botProcess.killed) botProcess.kill('SIGTERM');
  process.exit(0);
});

startServer();
