/**
 * On Ao Discord Music Bot — Master Orchestrator
 * High-Performance Discord.js v14 & Lavalink-Client v2.11.0 Engine
 */
require('dotenv').config({ override: true });
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  REST,
  Routes,
  ActivityType,
  AuditLogEvent,
  PermissionFlagsBits
} = require('discord.js');
const { LavalinkManager, EQList, UnresolvedTrackSymbol, TrackSymbol } = require('lavalink-client');
const { getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Modular Imports
const { setupProcessCrashShield, applyLavalinkNodePatches, buildNodeCandidates } = require('./src/bot/lavalink-patches.cjs');
const { NativeVoiceEngineManager } = require('./native-voice-engine.cjs');
const { generateOnAoProfileCard, formatDurationOnAo } = require('./profile-canvas.cjs');
const { getLanguage, setLanguage, getGuildSettings, updateGuildSettings, isUserDJ, t } = require('./bot-i18n.cjs');
const { handleHelpInteraction } = require('./bot-help.cjs');
const {
  isSpotifyUrl,
  parseSpotifyUrl,
  resolveSpotify,
  searchSpotifyArtwork,
  getTrackArtwork,
  resolveTrackArtworkAsync,
  getSpotifyToken
} = require('./spotify-resolver.cjs');
const {
  recordUserProfile,
  recordUserCommand,
  recordPlaybackSession,
  startVoicePresenceTracker,
  getUserProfile,
  updateUserProfileSettings,
  getFormattedUserProfile,
  flushProfilesToDisk
} = require('./src/bot/profile-manager.cjs');
const { fetchSongLyrics } = require('./src/bot/lyrics-service.cjs');
const {
  getUserPlaylists,
  getPlaylist,
  createPlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  deletePlaylist,
  resolveYouTubePlaylist,
  createUniversalTrack
} = require('./src/bot/playlist-manager.cjs');
const {
  guildPlaybackSnapshots,
  getGuildPlaybackSnapshot,
  saveGuildPlaybackSnapshot,
  hardPurgeVoiceSession,
  handleReturnToOrigin,
  handleFollowInitiator,
  handleAntiDisconnect
} = require('./src/bot/voice-protection.cjs');
const { handleMusicCommand, applyUnifiedAudioFilters, createAudioFilterComponents } = require('./bot-commands.cjs');

// 1. Process Crash Shield & Lavalink Node Patches
setupProcessCrashShield();
applyLavalinkNodePatches();

// 2. Singleton PID File Guard
const PID_FILE = path.resolve(__dirname, '.bot.pid');
try {
  if (fs.existsSync(PID_FILE)) {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    if (oldPid && oldPid !== process.pid) {
      try { process.kill(oldPid, 'SIGKILL'); } catch (e) {}
    }
  }
  fs.writeFileSync(PID_FILE, String(process.pid));
  process.on('exit', () => {
    try {
      if (fs.existsSync(PID_FILE) && fs.readFileSync(PID_FILE, 'utf8').trim() === String(process.pid)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch (e) {}
  });
} catch (err) {}

// 3. Track Metadata & Formatting Helpers
function getTrackTitle(track) {
  return track?.info?.title || track?.title || 'Judul Tidak Diketahui';
}

function getTrackAuthor(track) {
  return track?.info?.author || track?.author || 'Artis Tidak Diketahui';
}

function getTrackDuration(track) {
  return track?.info?.duration || track?.duration || 0;
}

function getTrackUri(track) {
  return track?.info?.uri || track?.uri || 'https://discord.com';
}

function formatDuration(ms) {
  if (!ms || isNaN(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function createProgressBar(currentMs, totalMs, size = 10) {
  const curStr = formatDuration(currentMs || 0);
  if (!totalMs || totalMs <= 0) {
    return `\`${curStr}\` 🔘────────── \`LIVE 🔴\``;
  }
  const totStr = formatDuration(totalMs);
  const progress = Math.min(Math.max((currentMs || 0) / totalMs, 0), 1);
  const filled = Math.max(0, Math.min(size, Math.round(progress * size)));
  const empty = Math.max(0, size - filled);
  const bar = '▬'.repeat(filled) + '🔘' + '▬'.repeat(empty);
  return `\`${curStr}\` ${bar} \`${totStr}\``;
}

function createMusicControlButtons(player) {
  const isPaused = Boolean(player.paused);
  const loopMode = (player.repeatMode || 'off').toUpperCase();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_pause_resume')
      .setLabel(isPaused ? 'Resume' : 'Pause')
      .setEmoji(isPaused ? '▶️' : '⏸️')
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setLabel('Skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_shuffle')
      .setLabel('Shuffle')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setLabel(`Loop: ${loopMode}`)
      .setEmoji('🔁')
      .setStyle(loopMode !== 'OFF' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setLabel('Stop')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_previous')
      .setLabel('Back')
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_forward')
      .setLabel('+15s')
      .setEmoji('⏩')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_filters')
      .setLabel('Filters')
      .setEmoji('🎛️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_lyrics')
      .setLabel('Lyrics')
      .setEmoji('🎤')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_queue')
      .setLabel('Queue')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

const RADIO_STATIONS = {
  lofi: { name: 'Lofi Girl - Chill Beats 24/7', url: 'https://stream.zeno.fm/f3wvbbqmdg8uv', desc: 'Beats to study / relax to ☕' },
  synthwave: { name: 'Synthwave & Retrowave 24/7', url: 'https://stream.zeno.fm/0r0xa792kwzuv', desc: 'Neon cyber synth vibes 🌆' },
  jazz: { name: 'Cafe Jazz & Bossa Nova', url: 'https://stream.zeno.fm/9162xubfs7zuv', desc: 'Cozy acoustic cafe vibes 🎷' },
  gaming: { name: 'Gaming & Chiptune Beats', url: 'https://stream.zeno.fm/wq9ua6rmehptv', desc: 'Upbeat electronic & 8-bit beats 🎮' },
  anime: { name: 'Anime OST & J-Pop 24/7', url: 'https://stream.zeno.fm/4v63e6q3mkhvv', desc: 'Japanese melodies and anime themes 🌸' },
  hits: { name: 'Global Top 40 Hits', url: 'https://stream.zeno.fm/yr8x6rm48v8uv', desc: 'Billboard and worldwide chart toppers 🔥' }
};

// 4. Match Confidence & YouTube Resolution
async function resolveYouTubeUrl(url) {
  try {
    const oembedUrl = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json';
    const res = await fetch(oembedUrl).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.title) {
        const title = data.title;
        const author = (data.author_name || '').replace(/- Topic|Official/gi, '').trim();
        const searchQuery = (author ? `${author} ${title}` : title).replace(/Official Video|Official Audio|Music Video/gi, '').trim();
        return { title, author, searchQuery, artworkUrl: data.thumbnail_url || null };
      }
    }
  } catch (e) {}
  return null;
}

function calculateMatchConfidence(query, track) {
  if (!track || !track.info) return 0;
  
  const queryLower = query.toLowerCase();
  const titleLower = (track.info.title || '').toLowerCase();
  const authorLower = (track.info.author || '').toLowerCase();
  
  const cleanStr = str => str.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
  const qClean = cleanStr(queryLower);
  const tClean = cleanStr(titleLower);
  const aClean = cleanStr(authorLower);
  
  let score = 0;
  const qWords = qClean.split(' ').filter(w => w.length > 1);
  if (qWords.length === 0) return 1;
  
  let matchedWords = 0;
  for (const word of qWords) {
    if (tClean.includes(word) || aClean.includes(word)) {
      matchedWords++;
    }
  }
  
  score += (matchedWords / qWords.length) * 60;
  if (tClean.includes(qClean) || `${aClean} ${tClean}`.includes(qClean)) {
    score += 25;
  }
  
  const officialMarkers = ['official audio', 'official music video', 'official video', 'official visualizer', 'official lyric video', 'provided to youtube by', 'auto-generated by youtube', 'vevo', '- topic'];
  if (officialMarkers.some(m => titleLower.includes(m) || authorLower.includes(m))) {
    score += 45;
  }

  const nonOriginalKeywords = ['cover', 'karaoke', 'acoustic cover', 'sped up', 'slowed', 'reverb', 'nightcore', '8d', 'bass boosted', 'instrumental', 'remake', 'mashup'];
  for (const kw of nonOriginalKeywords) {
    if ((titleLower.includes(kw) || authorLower.includes(kw)) && !queryLower.includes(kw)) {
      score -= 60;
    }
  }
  return score;
}

// Global reference holder for botClient
let botClient = null;

function getGuildPlayer(guildId) {
  if (!botClient || !guildId) return null;
  return botClient.lavalink?.getPlayer(guildId) || botClient.nativeVoice?.getPlayer(guildId) || null;
}

// 5. Safe Player Search Engine
async function safePlayerSearch(player, query, requester) {
  if (!player || !query) return null;

  // A. Spotify Resolver (Instant track & playlist mapping)
  if (isSpotifyUrl(query)) {
    try {
      const spData = await resolveSpotify(query);
      if (spData) {
        if (spData.type === 'track') {
          const spRes = await player.search({ query: spData.query, source: 'ytmsearch' }, requester).catch(() => null);
          if (spRes && spRes.tracks && spRes.tracks.length > 0) {
            const track = spRes.tracks[0];
            if (spData.artworkUrl) {
              if (!track.info) track.info = {};
              track.info.artworkUrl = spData.artworkUrl;
              track.artworkUrl = spData.artworkUrl;
            }
            return { loadType: 'track', tracks: [track] };
          }
          // Fallback direct track object
          const directTrack = createUniversalTrack({
            title: spData.title,
            author: spData.artist || 'Spotify',
            duration: spData.durationMs || 180000,
            uri: spData.spotifyUrl || query,
            artworkUrl: spData.artworkUrl || null,
            query: spData.query
          }, requester);
          return { loadType: 'track', tracks: [directTrack] };
        } else if ((spData.type === 'playlist' || spData.type === 'album') && Array.isArray(spData.tracks)) {
          const resolvedTracks = spData.tracks.map(item => createUniversalTrack({
            title: item.title || 'Spotify Track',
            author: item.artist || 'Spotify',
            duration: item.durationMs || 180000,
            uri: item.spotifyUrl || query,
            artworkUrl: item.artworkUrl || spData.artworkUrl || null,
            query: item.query
          }, requester)).filter(Boolean);

          if (resolvedTracks.length > 0) {
            return {
              loadType: 'playlist',
              playlist: {
                title: spData.title || (spData.type === 'album' ? 'Spotify Album' : 'Spotify Playlist'),
                name: spData.title || (spData.type === 'album' ? 'Spotify Album' : 'Spotify Playlist'),
                artworkUrl: spData.artworkUrl || resolvedTracks[0]?.artworkUrl || null
              },
              tracks: resolvedTracks
            };
          }
        }
      }
    } catch (spErr) {
      console.warn('[SPOTIFY RESOLVE WARN]', spErr.message);
    }
  }

  // B. YouTube Playlist Resolver
  if (/youtube\.com|youtu\.be/i.test(query) && (query.includes('list=') || query.includes('/playlist'))) {
    try {
      const ytPl = await resolveYouTubePlaylist(query);
      if (ytPl && ytPl.tracks && ytPl.tracks.length > 0) {
        ytPl.tracks.forEach(t => { t.requester = requester || null; });
        return ytPl;
      }
    } catch (ytErr) {
      console.warn('[YT PLAYLIST SEARCH WARN]', ytErr.message);
    }
  }

  // C. YouTube Single Track oEmbed
  if (/youtube\.com|youtu\.be/i.test(query) && !query.includes('list=')) {
    const ytOembed = await resolveYouTubeUrl(query);
    if (ytOembed && ytOembed.searchQuery) {
      const oembedRes = await player.search({ query: ytOembed.searchQuery, source: 'ytmsearch' }, requester).catch(() => null);
      if (oembedRes && oembedRes.tracks && oembedRes.tracks.length > 0) {
        const topTrack = oembedRes.tracks[0];
        if (ytOembed.artworkUrl) {
          if (!topTrack.info) topTrack.info = {};
          topTrack.info.artworkUrl = ytOembed.artworkUrl;
        }
        return { loadType: 'track', tracks: [topTrack] };
      }
    }
  }

  // D. Standard Sources (ytmsearch -> ytsearch -> scsearch -> direct)
  const sources = [
    { query, source: 'ytmsearch' },
    { query, source: 'ytsearch' },
    { query, source: 'scsearch' },
    { query, source: undefined }
  ];

  for (const src of sources) {
    try {
      const res = await player.search(src, requester);
      if (res && res.tracks && res.tracks.length > 0) {
        if (res.loadType === 'search' && res.tracks.length > 1) {
          res.tracks.sort((a, b) => calculateMatchConfidence(query, b) - calculateMatchConfidence(query, a));
        }
        return res;
      }
    } catch (e) {}
  }

  // E. Fallback Native Voice Engine Search
  if (botClient?.nativeVoice) {
    try {
      const nativeRes = await botClient.nativeVoice.search(query, requester);
      if (nativeRes && nativeRes.tracks && nativeRes.tracks.length > 0) {
        return nativeRes;
      }
    } catch (nErr) {}
  }

  return null;
}

// 6. Autoplay Engine
async function fetchAutoplayRecommendation(player, currentTrack) {
  if (!currentTrack) return null;
  const requester = currentTrack.requester || player.queue?.current?.requester;
  const title = getTrackTitle(currentTrack);
  const author = getTrackAuthor(currentTrack);

  const queries = [
    `similar songs to ${author} ${title}`,
    `${author} music mix`,
    `${title} song mix`
  ];

  for (const q of queries) {
    const res = await safePlayerSearch(player, q, requester);
    if (res && res.tracks && res.tracks.length > 0) {
      const rec = res.tracks.find(t => getTrackTitle(t).toLowerCase() !== title.toLowerCase());
      if (rec) return rec;
    }
  }
  return null;
}

async function triggerAutoplayNext(player, lastTrack) {
  if (!player || !player.get?.('autoplay') || !lastTrack) return;
  try {
    const recTrack = await fetchAutoplayRecommendation(player, lastTrack);
    if (recTrack) {
      if (player.queue?.add) {
        await player.queue.add(recTrack);
      } else if (player.queue?.tracks) {
        player.queue.tracks.push(recTrack);
      }
      if (!player.playing) {
        await player.play();
      }
      console.log(`[AUTOPLAY] 📻 Autoplay played recommendation: "${getTrackTitle(recTrack)}"`);
    }
  } catch (err) {
    console.warn('[AUTOPLAY ERR]', err.message);
  }
}

async function handleControllerSkipWithAutoplay(player, currentTrackOverride = null, forceAutoplay = false) {
  const current = currentTrackOverride || player.queue?.current || player.get?.('currentTrack');
  const hasNext = player.queue?.tracks ? player.queue.tracks.length > 0 : false;
  let recTrack = null;

  const isAutoplay = forceAutoplay || Boolean(player.get?.('autoplay'));

  if (!hasNext && isAutoplay && current) {
    recTrack = await fetchAutoplayRecommendation(player, current);
    if (recTrack) {
      if (player.queue?.add) {
        await player.queue.add(recTrack);
      } else if (player.queue?.tracks) {
        player.queue.tracks.push(recTrack);
      }
    }
  }

  if (typeof player.skip === 'function') {
    await player.skip();
  } else if (typeof player.stopPlaying === 'function') {
    await player.stopPlaying(true, false);
  } else if (typeof player.stop === 'function') {
    await player.stop();
  }

  return {
    success: true,
    newTrack: recTrack,
    isAutoplay: Boolean(recTrack)
  };
}

// 7. Player State & Multi-Guild Exporter
const PLAYERS_STATE_FILE = path.resolve(__dirname, 'players-state.json');
const BOT_GUILDS_FILE = path.resolve(__dirname, 'bot-guilds.json');
const IPC_COMMAND_FILE = path.resolve(__dirname, 'ipc-command.json');

function syncPlayerState(player) {
  try {
    if (!player) return;
    const curTrack = player.queue?.current || player.get?.('currentTrack') || null;
    const isPlaying = Boolean(player.playing && !player.paused);

    const queueTracks = player.queue?.tracks ? Array.from(player.queue.tracks) : [];
    const filterName = player.get ? (player.get('filter_active_name') || player.get('filter_eq') || 'Normal') : 'Normal';
    const crossfadeSec = player.get ? (player.get('crossfade_seconds') || 0) : 0;
    const isVocal = player.get ? Boolean(player.get('filter_vocalboost')) : false;

    const stateData = {
      active: true,
      guildId: player.guildId,
      isPlaying,
      isPaused: Boolean(player.paused),
      current: curTrack ? {
        title: getTrackTitle(curTrack),
        author: getTrackAuthor(curTrack),
        duration: getTrackDuration(curTrack),
        uri: getTrackUri(curTrack),
        artworkUrl: getTrackArtwork(curTrack),
        requester: curTrack.requester?.username || curTrack.requester?.tag || 'User'
      } : null,
      position: player.position || player.lastPlaybackPosition || 0,
      duration: curTrack ? getTrackDuration(curTrack) : 0,
      volume: player.volume || 100,
      loop: player.repeatMode || 'off',
      autoplay: player.get ? Boolean(player.get('autoplay')) : false,
      is247: player.get ? Boolean(player.get('is247')) : false,
      filter: filterName,
      filter_eq: player.get ? (player.get('filter_eq') || 'flat') : 'flat',
      bassboost: player.get ? (player.get('filter_bassboost') || 0) : 0,
      nightcore: player.get ? Boolean(player.get('filter_nightcore')) : false,
      vaporwave: player.get ? Boolean(player.get('filter_vaporwave')) : false,
      eightD: player.get ? Boolean(player.get('filter_8d')) : false,
      vocalboost: isVocal,
      crossfade: crossfadeSec,
      voiceChannelId: player.voiceChannelId || null,
      queueCount: queueTracks.length,
      queue: queueTracks.slice(0, 15).map(t => ({
        title: getTrackTitle(t),
        author: getTrackAuthor(t),
        duration: getTrackDuration(t),
        uri: getTrackUri(t),
        artworkUrl: getTrackArtwork(t),
        requester: t.requester?.username || t.requester?.tag || 'User'
      })),
      updatedAt: Date.now()
    };

    // Primary player-state.json
    fs.writeFileSync(path.resolve(__dirname, 'player-state.json'), JSON.stringify(stateData, null, 2), 'utf8');

    // Per-guild players-state.json
    let allStates = {};
    if (fs.existsSync(PLAYERS_STATE_FILE)) {
      try {
        allStates = JSON.parse(fs.readFileSync(PLAYERS_STATE_FILE, 'utf8')) || {};
      } catch (e) {}
    }
    allStates[player.guildId] = stateData;
    fs.writeFileSync(PLAYERS_STATE_FILE, JSON.stringify(allStates, null, 2), 'utf8');
  } catch (e) {}
}

function syncAllGuildsState(clientInstance) {
  if (!clientInstance || !clientInstance.guilds) return;
  try {
    const guildsList = [];
    for (const [guildId, guild] of clientInstance.guilds.cache) {
      const player = clientInstance.lavalink?.getPlayer(guildId) || clientInstance.nativeVoice?.getPlayer(guildId);
      const voiceChannel = player?.voiceChannelId ? guild.channels.cache.get(player.voiceChannelId) : null;
      const curTrack = player?.queue?.current || player?.get?.('currentTrack') || null;
      const isPlaying = Boolean(player?.playing && !player?.paused);

      guildsList.push({
        id: guildId,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true, size: 128 }),
        memberCount: guild.memberCount || 0,
        botInVoice: Boolean(player?.connected && player?.voiceChannelId),
        voiceChannelId: player?.voiceChannelId || null,
        voiceChannelName: voiceChannel?.name || null,
        voiceMembersCount: voiceChannel?.members ? voiceChannel.members.filter(m => !m.user.bot).size : 0,
        isPlaying,
        isPaused: Boolean(player?.paused),
        volume: player?.volume || 100,
        loop: player?.repeatMode || 'off',
        autoplay: player?.get ? Boolean(player.get('autoplay')) : false,
        filter: player?.get ? (player.get('filter_active_name') || player.get('filter_eq') || 'Normal') : 'Normal',
        crossfade: player?.get ? (player.get('crossfade_seconds') || 0) : 0,
        queueCount: player?.queue?.tracks?.length || 0,
        current: curTrack ? {
          title: getTrackTitle(curTrack),
          author: getTrackAuthor(curTrack),
          duration: getTrackDuration(curTrack),
          uri: getTrackUri(curTrack),
          artworkUrl: getTrackArtwork(curTrack)
        } : null
      });
    }

    fs.writeFileSync(BOT_GUILDS_FILE, JSON.stringify(guildsList, null, 2), 'utf8');
  } catch (e) {}
}

// IPC Remote Control Dispatcher
async function handleIpcCommand(msg) {
  if (!msg || !botClient) return;
  try {
    const { action, guildId, data } = msg;
    // If guildId specified, use it; otherwise fallback to first connected guild or first cached guild
    let targetGuildId = guildId;
    if (!targetGuildId) {
      for (const [gId, g] of botClient.guilds.cache) {
        const p = botClient.lavalink?.getPlayer(gId) || botClient.nativeVoice?.getPlayer(gId);
        if (p?.voiceChannelId) {
          targetGuildId = gId;
          break;
        }
      }
      if (!targetGuildId) {
        targetGuildId = Array.from(botClient.guilds.cache.keys())[0];
      }
    }
    if (!targetGuildId) return;

    const player = botClient.lavalink?.getPlayer(targetGuildId) || botClient.nativeVoice?.getPlayer(targetGuildId);

    if (action === 'pause') {
      if (player && !player.paused) await player.pause();
    } else if (action === 'resume') {
      if (player && player.paused) await player.resume();
    } else if (action === 'skip') {
      if (player) await handleControllerSkipWithAutoplay(player);
    } else if (action === 'stop') {
      if (player) {
        player.manualDisconnect = true;
        await player.destroy();
      }
    } else if (action === 'volume') {
      const vol = parseInt(data?.value, 10);
      if (player && !isNaN(vol) && vol >= 1 && vol <= 100) await player.setVolume(vol);
    } else if (action === 'loop') {
      const mode = data?.mode || (player?.repeatMode === 'off' ? 'track' : (player?.repeatMode === 'track' ? 'queue' : 'off'));
      if (player) {
        if (typeof player.setRepeatMode === 'function') await player.setRepeatMode(mode);
        else player.repeatMode = mode;
      }
    } else if (action === 'shuffle') {
      if (player?.queue?.shuffle) await player.queue.shuffle();
    } else if (action === 'seek') {
      const pos = parseInt(data?.position, 10);
      if (player && !isNaN(pos)) await player.seek(pos * 1000);
    } else if (action === 'filter') {
      if (player) {
        const filterType = data?.filter;
        if (filterType === 'reset' || filterType === 'flat') {
          player.set('filter_bassboost', 0);
          player.set('filter_nightcore', false);
          player.set('filter_vaporwave', false);
          player.set('filter_8d', false);
          player.set('filter_vocalboost', false);
          player.set('filter_eq', 'flat');
        } else if (filterType === 'bassboost_1') {
          player.set('filter_bassboost', 1);
        } else if (filterType === 'bassboost_2') {
          player.set('filter_bassboost', 2);
        } else if (filterType === 'bassboost_3') {
          player.set('filter_bassboost', 3);
        } else if (filterType === 'nightcore') {
          const cur = player.get ? Boolean(player.get('filter_nightcore')) : false;
          player.set('filter_nightcore', !cur);
          if (!cur) player.set('filter_vaporwave', false);
        } else if (filterType === 'vaporwave') {
          const cur = player.get ? Boolean(player.get('filter_vaporwave')) : false;
          player.set('filter_vaporwave', !cur);
          if (!cur) player.set('filter_nightcore', false);
        } else if (filterType === '8d') {
          const cur = player.get ? Boolean(player.get('filter_8d')) : false;
          player.set('filter_8d', !cur);
        } else if (filterType === 'vocal' || filterType === 'vocalboost') {
          const cur = player.get ? Boolean(player.get('filter_vocalboost')) : false;
          player.set('filter_vocalboost', !cur);
          if (!cur) player.set('filter_eq', 'vocal');
          else if (player.get('filter_eq') === 'vocal') player.set('filter_eq', 'flat');
        } else if (filterType === 'hifi') {
          player.set('filter_eq', 'hifi');
          player.set('filter_vocalboost', false);
        } else if (filterType === 'gaming') {
          player.set('filter_eq', 'gaming');
          player.set('filter_vocalboost', false);
        }
        await applyUnifiedAudioFilters(player);
      }
    } else if (action === 'crossfade') {
      const sec = parseInt(data?.seconds, 10);
      if (player && !isNaN(sec)) {
        player.set('crossfade_seconds', Math.max(0, Math.min(5, sec)));
      }
    } else if (action === 'autoplay') {
      if (player) {
        const cur = Boolean(player.get('autoplay'));
        player.set('autoplay', !cur);
      }
    }

    if (player) syncPlayerState(player);
    syncAllGuildsState(botClient);
  } catch (err) {
    console.warn('[IPC COMMAND ERROR]', err.message);
  }
}

// IPC Stdin & File Queue Listeners
try {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    try {
      if (line && line.trim()) {
        const msg = JSON.parse(line.trim());
        handleIpcCommand(msg);
      }
    } catch (e) {}
  });
} catch (e) {}

setInterval(() => {
  if (fs.existsSync(IPC_COMMAND_FILE)) {
    try {
      const content = fs.readFileSync(IPC_COMMAND_FILE, 'utf8').trim();
      fs.unlinkSync(IPC_COMMAND_FILE);
      if (content) {
        const msg = JSON.parse(content);
        handleIpcCommand(msg);
      }
    } catch (e) {}
  }
}, 500);

// 8. Main Bot Process Startup
let hasMessageContentIntent = true;
let hasGuildMembersIntent = true;

async function startBot() {
  const token = process.env.TOKEN;
  if (!token || token.trim().length < 10) {
    console.warn('[BOT START WARN] TOKEN is not set in environment.');
  }

  let client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent
    ]
  });

  botClient = client;

  // Initialize Native Voice Engine Fallback
  client.nativeVoice = new NativeVoiceEngineManager(client);

  function setupLavalink(botClient) {
    const candidates = buildNodeCandidates();

    botClient.lavalink = new LavalinkManager({
      nodes: candidates,
      sendToShard: (guildId, payload) => {
        const guild = botClient.guilds.cache.get(guildId);
        if (guild && guild.shard) guild.shard.send(payload);
      },
      sendWS: (guildId, payload) => {
        const guild = botClient.guilds.cache.get(guildId);
        if (guild && guild.shard) guild.shard.send(payload);
      },
      playerOptions: {
        clientBasedPositionUpdateInterval: 150,
        defaultSearchPlatform: 'ytmsearch',
        volumeDecrementer: 1.0,
        onVolumeChange: (player, volume) => {
          player.volume = volume;
          syncPlayerState(player);
        }
      },
      queueOptions: {
        maxPreviousTracks: 10
      }
    });

    // Node state exporter
    function exportNodeStatus() {
      try {
        const nodesData = Array.from(botClient.lavalink.nodeManager.nodes.values()).map(n => ({
          id: n.id,
          host: n.options.host,
          port: n.options.port,
          secure: n.options.secure,
          status: n.connected ? 'connected' : (n.isAlive ? 'connecting' : 'disconnected'),
          attempts: n.retryAmount || 0,
          ping: n.ping || null,
          updatedAt: Date.now()
        }));

        fs.writeFileSync(
          path.resolve(__dirname, 'lavalink-status.json'),
          JSON.stringify({ nodes: nodesData, updatedAt: Date.now() }, null, 2),
          'utf8'
        );
      } catch (e) {}
    }

    botClient.lavalink.nodeManager.on('connect', (node) => {
      console.log(`[LAVALINK ENGINE] ✅ Connected to node '${node.id}' (${node.options.host}:${node.options.port}).`);
      exportNodeStatus();
    });

    botClient.lavalink.nodeManager.on('disconnect', (node, reason) => {
      console.warn(`[LAVALINK ENGINE] ⚠️ Disconnected from node '${node.id}':`, reason?.reason || reason);
      exportNodeStatus();
    });

    botClient.lavalink.nodeManager.on('error', (node, error) => {
      console.warn(`[LAVALINK ENGINE ERROR] Node '${node.id}':`, error?.message || error);
      exportNodeStatus();
    });

    // Player Events
    botClient.lavalink.on('playerCreate', (player) => {
      syncPlayerState(player);
    });

    botClient.lavalink.on('playerDestroy', (player) => {
      syncPlayerState(player);
    });

    const handleTrackStart = async (player, track) => {
      syncPlayerState(player);
      saveGuildPlaybackSnapshot(player.guildId, player, { currentTrack: track, position: 0 });

      // Check if command handler (play, playnext, playskip, etc.) already sent the response embed
      const skipUntil = (player.get ? player.get('skipTrackStartNotification') : 0) || player._skipTrackStartNotification || 0;
      if (skipUntil && Date.now() < skipUntil) {
        if (player.set) player.set('skipTrackStartNotification', 0);
        player._skipTrackStartNotification = 0;
      } else {
        const textCh = botClient.channels.cache.get(player.textChannelId);
        if (textCh && textCh.isTextBased()) {
          const title = getTrackTitle(track) || 'Unknown Track';
          const author = getTrackAuthor(track);
          const uri = getTrackUri(track);

          const trackLink = uri ? `[${title}](${uri})` : `**${title}**`;
          const authorPart = author && author !== 'Unknown Artist' ? ` by **${author}**` : '';

          const compactEmbed = new EmbedBuilder()
            .setColor(0x38bdf8)
            .setDescription(`🎶 **Started playing** ${trackLink}${authorPart}`);

          textCh.send({ embeds: [compactEmbed] }).catch(() => {});
        }
      }

      recordPlaybackSession(track, track.requester, botClient.guilds.cache.get(player.guildId), botClient.guilds.cache.get(player.guildId)?.channels.cache.get(player.voiceChannelId), getTrackTitle);
    };

    botClient.lavalink.on('trackStart', handleTrackStart);
    if (botClient.nativeVoice) {
      botClient.nativeVoice.on('trackStart', handleTrackStart);
    }

    botClient.lavalink.on('trackEnd', async (player, track, reason) => {
      syncPlayerState(player);
      if (reason?.reason === 'finished' || reason?.reason === 'loadFailed') {
        const hasNext = player.queue?.tracks ? player.queue.tracks.length > 0 : false;
        if (!hasNext && player.get?.('autoplay')) {
          await triggerAutoplayNext(player, track);
        }
      }
    });

    // Force Reconnect File Watcher Flag
    setInterval(() => {
      const reconFlag = path.resolve(__dirname, 'lavalink-reconnect.flag');
      if (fs.existsSync(reconFlag)) {
        try {
          fs.unlinkSync(reconFlag);
          console.log('[LAVALINK RECONNECT] ⚡ Force reconnect triggered from UI.');
          botClient.lavalink.nodeManager.nodes.forEach(node => {
            if (!node.connected) node.connect();
          });
        } catch (e) {}
      }
    }, 3000);
  }

  setupLavalink(client);

  function registerClientEvents(botClient) {
    // Forward Discord Voice Gateway packets to LavalinkManager
    botClient.on('raw', (data) => {
      try {
        botClient.lavalink?.sendRawData(data);
      } catch (e) {}
    });

    botClient.once('ready', async () => {
      console.log(`[BOT READY] ✅ Online as ${botClient.user.tag} (ID: ${botClient.user.id})`);
      botClient.user.setActivity({ name: '🎶 on play <lagu> | /play', type: ActivityType.Listening });

      startVoicePresenceTracker(() => botClient, getGuildPlayer);

      try {
        botClient.lavalink.init({ id: botClient.user.id, username: botClient.user.username });
      } catch (initErr) {
        console.error('[BOT LAVALINK INIT ERROR]', initErr.message);
      }

      syncAllGuildsState(botClient);
      setInterval(() => syncAllGuildsState(botClient), 2500);
    });

    // Voice State Update Event Processor
    botClient.on('voiceStateUpdate', async (oldState, newState) => {
      try {
        const guild = oldState.guild;
        const player = botClient.lavalink?.getPlayer(guild.id) || botClient.nativeVoice?.getPlayer(guild.id);
        if (!player) return;

        // A. Return to Origin (Bot moved by Admin/Mod or external action)
        if (oldState.id === botClient.user.id && oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
          await handleReturnToOrigin(oldState, newState, player, botClient);
          return;
        }

        // B. Follow First User (Session initiator moved to another voice channel)
        if (player.sessionInitiatorId && oldState.id === player.sessionInitiatorId && oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
          await handleFollowInitiator(oldState, newState, player, botClient);
          return;
        }

        // C. Anti-Disconnect (Bot was disconnected or kicked)
        if (oldState.id === botClient.user.id && oldState.channelId && !newState.channelId) {
          await handleAntiDisconnect(oldState, player, botClient, {
            getTrackTitle,
            syncPlayerState,
            applyUnifiedAudioFilters,
            getVoiceConnection
          });
          return;
        }

        // C. Idle Empty Voice Channel Auto-Disconnect
        if (player.connected && player.voiceChannelId) {
          const channel = oldState.guild.channels.cache.get(player.voiceChannelId);
          if (channel && channel.isVoiceBased?.()) {
            const nonBots = channel.members.filter(m => !m.user.bot);
            if (nonBots.size === 0 && !player.get?.('is247')) {
              const timer = setTimeout(async () => {
                const freshChannel = oldState.guild.channels.cache.get(player.voiceChannelId);
                if (freshChannel && freshChannel.members.filter(m => !m.user.bot).size === 0 && !player.get?.('is247')) {
                  console.log(`[VOICE] Empty voice channel in ${oldState.guild.name}. Disconnecting.`);
                  await player.destroy().catch(() => {});
                }
              }, 60000);
              if (player.set) player.set('emptyTimer', timer);
            } else if (nonBots.size > 0 && player.get?.('emptyTimer')) {
              clearTimeout(player.get('emptyTimer'));
              if (player.set) player.set('emptyTimer', null);
            }
          }
        }
      } catch (err) {
        console.warn('[VOICE STATE ERROR]', err.message);
      }
    });

    // Command Helpers Object passed to handleMusicCommand
    const commandHelpers = {
      safePlayerSearch,
      RADIO_STATIONS,
      createMusicControlButtons,
      createProgressBar,
      formatDuration,
      getTrackTitle,
      getTrackAuthor,
      getTrackDuration,
      getTrackUri,
      getTrackArtwork,
      searchSpotifyArtwork,
      resolveTrackArtworkAsync,
      recordPlaybackSession,
      recordUserCommand,
      getUserProfile,
      getFormattedUserProfile,
      updateUserProfileSettings,
      fetchSongLyrics,
      syncPlayerState,
      triggerAutoplayNext,
      fetchAutoplayRecommendation,
      handleControllerSkipWithAutoplay,
      getUserPlaylists,
      getPlaylist,
      createPlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      deletePlaylist,
      resolveYouTubePlaylist,
      createUniversalTrack
    };

    // Interaction Dispatcher (Slash commands & Button Controllers)
    botClient.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          const cmdName = interaction.commandName.toLowerCase();
          const options = {};

          try {
            const subCmd = interaction.options.getSubcommand(false);
            if (subCmd) options.subcommand = subCmd;
            const subGroup = interaction.options.getSubcommandGroup(false);
            if (subGroup) options.subcommandGroup = subGroup;
          } catch (e) {}

          interaction.options.data.forEach(opt => {
            if (opt.type === 1) { // SUB_COMMAND
              options.subcommand = opt.name;
              if (opt.options) {
                opt.options.forEach(subOpt => {
                  options[subOpt.name] = subOpt.value;
                  if (subOpt.user) options.user = subOpt.user;
                });
              }
            } else {
              options[opt.name] = opt.value;
              if (opt.user) options.user = opt.user;
            }
          });

          if (interaction.options.getUser('user')) {
            options.user = interaction.options.getUser('user');
          }

          await handleMusicCommand(interaction, cmdName, options, botClient, commandHelpers);
          return;
        }

        if (interaction.isButton()) {
          const customId = interaction.customId;

          if (customId.startsWith('help_')) {
            await handleHelpInteraction(interaction);
            return;
          }

          const guild = interaction.guild;
          if (!guild) return;

          const player = botClient.lavalink?.getPlayer(guild.id) || botClient.nativeVoice?.getPlayer(guild.id);
          const lang = getLanguage(guild.id, interaction.user.id);

          if (!player) {
            return await interaction.reply({ content: t('no_player', lang), ephemeral: true });
          }

          const memberVoice = interaction.member?.voice?.channel;
          if (!memberVoice) {
            return await interaction.reply({ content: t('voice_required', lang), ephemeral: true });
          }

          if (player.voiceChannelId && memberVoice.id !== player.voiceChannelId) {
            return await interaction.reply({ content: t('voice_diff_channel', lang), ephemeral: true });
          }

          const initiatorId = player.sessionInitiatorId;
          const isSessionOwner = !initiatorId || initiatorId === interaction.user.id;
          const isStaff = interaction.member.permissions?.has('Administrator') || interaction.member.permissions?.has('ManageGuild');

          // Initiator Protection Check for Stop Command
          if (customId === 'music_stop' && !isSessionOwner && !isStaff) {
            const ownerMember = await guild.members.fetch(initiatorId).catch(() => null);
            if (ownerMember?.voice?.channelId === player.voiceChannelId) {
              return await interaction.reply({
                content: t('anti_disconnect_blocked', lang, { initiator: initiatorId }),
                ephemeral: true
              });
            }
          }

          if (customId.startsWith('q_')) {
            const upcoming = player.queue.tracks || [];
            const current = player.queue.current;
            const pageSize = 10;
            const totalPages = Math.max(1, Math.ceil(upcoming.length / pageSize));

            let currentPage = 1;
            const titleText = interaction.message?.embeds?.[0]?.title || '';
            const footerText = interaction.message?.embeds?.[0]?.footer?.text || '';
            const pageMatch = (titleText + ' ' + footerText).match(/Page\s+(\d+)\/(\d+)/i);
            if (pageMatch) {
              currentPage = parseInt(pageMatch[1], 10) || 1;
            }

            if (customId === 'q_first') currentPage = 1;
            else if (customId === 'q_prev') currentPage = Math.max(1, currentPage - 1);
            else if (customId === 'q_next') currentPage = Math.min(totalPages, currentPage + 1);
            else if (customId === 'q_last') currentPage = totalPages;
            else if (customId === 'q_clear') {
              const isSolo = memberVoice?.members?.filter(m => !m.user.bot).size <= 1;
              const isDJ = isUserDJ(interaction.member, guild.id);
              const isInitiator = !initiatorId || interaction.user.id === initiatorId;

              if (!isInitiator && !isDJ && !isSolo) {
                return await interaction.reply({ content: t('dj_only', lang), ephemeral: true });
              }
              const count = upcoming.length;
              player.queue.tracks = [];
              if (typeof syncPlayerState === 'function') syncPlayerState(player);
              if (typeof syncAllGuildsState === 'function') syncAllGuildsState(botClient);

              const clearedEmbed = new EmbedBuilder().setColor(0x10b981).setDescription(t('queue_cleared', lang, { count }));
              return await interaction.update({ embeds: [clearedEmbed], components: [] }).catch(() => {});
            }

            const buildQueueEmbed = (page) => {
              const startIdx = (page - 1) * pageSize;
              const tracksOnPage = upcoming.slice(startIdx, startIdx + pageSize);

              const embed = new EmbedBuilder()
                .setColor(0x6366f1)
                .setTitle(`📜 ${lang === 'en' ? 'Server Music Queue' : 'Antrian Musik Server'} (Page ${page}/${totalPages})`)
                .setFooter({ text: `${lang === 'en' ? 'Total Tracks' : 'Total Lagu'}: ${upcoming.length + (current ? 1 : 0)} • On Ao Music Studio` })
                .setTimestamp();

              if (current) {
                embed.addFields({
                  name: t('now_playing', lang),
                  value: `**[${getTrackTitle(current)}](${getTrackUri(current)})** - \`${formatDuration(getTrackDuration(current))}\``
                });
              }

              if (tracksOnPage.length > 0) {
                const listStr = tracksOnPage
                  .map((tr, idx) => `**${startIdx + idx + 1}.** [${getTrackTitle(tr)}](${getTrackUri(tr)}) - \`${formatDuration(getTrackDuration(tr))}\``)
                  .join('\n');
                embed.addFields({ name: lang === 'en' ? `⏳ Up Next (${upcoming.length} songs)` : `⏳ Akan Datang (${upcoming.length} lagu)`, value: listStr });
              } else {
                embed.addFields({ name: lang === 'en' ? '⏳ Up Next' : '⏳ Akan Datang', value: t('queue_empty', lang) });
              }

              return embed;
            };

            const buildQueueButtons = (page) => {
              return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('q_first')
                  .setLabel('⏮️')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(page <= 1),
                new ButtonBuilder()
                  .setCustomId('q_prev')
                  .setLabel('◀️')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(page <= 1),
                new ButtonBuilder()
                  .setCustomId('q_next')
                  .setLabel('▶️')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(page >= totalPages),
                new ButtonBuilder()
                  .setCustomId('q_last')
                  .setLabel('⏭️')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(page >= totalPages),
                new ButtonBuilder()
                  .setCustomId('q_clear')
                  .setLabel(lang === 'en' ? 'Clear' : 'Kosongkan')
                  .setEmoji('🗑️')
                  .setStyle(ButtonStyle.Danger)
                  .setDisabled(upcoming.length === 0)
              );
            };

            await interaction.update({
              embeds: [buildQueueEmbed(currentPage)],
              components: totalPages > 1 || upcoming.length > 0 ? [buildQueueButtons(currentPage)] : []
            }).catch(() => {});
            return;
          }

          await interaction.deferUpdate().catch(() => {});

          if (customId === 'music_pause_resume') {
            if (player.paused) {
              await player.resume();
            } else {
              await player.pause();
            }
          } else if (customId === 'music_skip') {
            await handleControllerSkipWithAutoplay(player);
          } else if (customId === 'music_stop') {
            player.manualDisconnect = true;
            await player.destroy();
          } else if (customId === 'music_shuffle') {
            if (player.queue?.shuffle) await player.queue.shuffle();
          } else if (customId === 'music_loop') {
            const cur = player.repeatMode || 'off';
            const next = cur === 'off' ? 'track' : (cur === 'track' ? 'queue' : 'off');
            if (typeof player.setRepeatMode === 'function') {
              await player.setRepeatMode(next);
            } else {
              player.repeatMode = next;
            }
          } else if (customId === 'music_previous') {
            await handleMusicCommand(interaction, 'previous', {}, botClient, commandHelpers);
          } else if (customId === 'music_forward') {
            await handleMusicCommand(interaction, 'forward', { seconds: 15 }, botClient, commandHelpers);
          } else if (customId === 'music_filters') {
            await handleMusicCommand(interaction, 'filters', {}, botClient, commandHelpers);
          } else if (customId === 'filter_crossfade_toggle') {
            const cur = player.get ? (player.get('crossfade_seconds') || 0) : 0;
            const next = cur === 0 ? 1 : (cur === 1 ? 2 : (cur === 2 ? 3 : 0));
            if (player.set) player.set('crossfade_seconds', next);
            if (interaction.message?.edit) {
              await interaction.message.edit({ components: createAudioFilterComponents(player, lang) }).catch(() => {});
            }
          } else if (customId === 'filter_reset_btn') {
            if (player.set) {
              player.set('filter_bassboost', 0);
              player.set('filter_nightcore', false);
              player.set('filter_vaporwave', false);
              player.set('filter_8d', false);
              player.set('filter_vocalboost', false);
              player.set('filter_eq', 'flat');
            }
            await applyUnifiedAudioFilters(player);
            if (interaction.message?.edit) {
              await interaction.message.edit({ components: createAudioFilterComponents(player, lang) }).catch(() => {});
            }
          } else if (customId === 'filter_vocal_toggle') {
            const cur = player.get ? Boolean(player.get('filter_vocalboost')) : false;
            const next = !cur;
            if (player.set) {
              player.set('filter_vocalboost', next);
              if (next) player.set('filter_eq', 'vocal');
              else if (player.get('filter_eq') === 'vocal') player.set('filter_eq', 'flat');
            }
            await applyUnifiedAudioFilters(player);
            if (interaction.message?.edit) {
              await interaction.message.edit({ components: createAudioFilterComponents(player, lang) }).catch(() => {});
            }
          } else if (customId === 'music_lyrics') {
            await handleMusicCommand(interaction, 'lyrics', {}, botClient, commandHelpers);
          } else if (customId === 'music_grab') {
            await handleMusicCommand(interaction, 'grab', {}, botClient, commandHelpers);
          } else if (customId === 'music_queue') {
            await handleMusicCommand(interaction, 'queue', {}, botClient, commandHelpers);
          }

          syncPlayerState(player);
          syncAllGuildsState(botClient);
        } else if (interaction.isStringSelectMenu()) {
          if (interaction.customId === 'music_search_select') {
            const selectedUrl = interaction.values[0];
            await interaction.deferUpdate().catch(() => {});
            await handleMusicCommand(interaction, 'play', { query: selectedUrl }, botClient, commandHelpers);
          } else if (interaction.customId === 'music_filter_select') {
            const selected = interaction.values[0];
            await interaction.deferUpdate().catch(() => {});
            if (selected === 'filter_reset') {
              if (player.set) {
                player.set('filter_bassboost', 0);
                player.set('filter_nightcore', false);
                player.set('filter_vaporwave', false);
                player.set('filter_8d', false);
                player.set('filter_vocalboost', false);
                player.set('filter_eq', 'flat');
              }
            } else if (selected === 'filter_bassboost_1') {
              if (player.set) player.set('filter_bassboost', 1);
            } else if (selected === 'filter_bassboost_2') {
              if (player.set) player.set('filter_bassboost', 2);
            } else if (selected === 'filter_bassboost_3') {
              if (player.set) player.set('filter_bassboost', 3);
            } else if (selected === 'filter_nightcore') {
              const cur = player.get ? Boolean(player.get('filter_nightcore')) : false;
              if (player.set) {
                player.set('filter_nightcore', !cur);
                if (!cur) player.set('filter_vaporwave', false);
              }
            } else if (selected === 'filter_vaporwave') {
              const cur = player.get ? Boolean(player.get('filter_vaporwave')) : false;
              if (player.set) {
                player.set('filter_vaporwave', !cur);
                if (!cur) player.set('filter_nightcore', false);
              }
            } else if (selected === 'filter_8d') {
              const cur = player.get ? Boolean(player.get('filter_8d')) : false;
              if (player.set) player.set('filter_8d', !cur);
            } else if (selected === 'filter_vocal') {
              const cur = player.get ? Boolean(player.get('filter_vocalboost')) : false;
              const next = !cur;
              if (player.set) {
                player.set('filter_vocalboost', next);
                if (next) player.set('filter_eq', 'vocal');
                else if (player.get('filter_eq') === 'vocal') player.set('filter_eq', 'flat');
              }
            } else if (selected === 'filter_hifi') {
              if (player.set) {
                player.set('filter_eq', 'hifi');
                player.set('filter_vocalboost', false);
              }
            } else if (selected === 'filter_gaming') {
              if (player.set) {
                player.set('filter_eq', 'gaming');
                player.set('filter_vocalboost', false);
              }
            }

            await applyUnifiedAudioFilters(player);
            syncPlayerState(player);
            syncAllGuildsState(botClient);

            if (interaction.message?.edit) {
              await interaction.message.edit({ components: createAudioFilterComponents(player, lang) }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('[INTERACTION ERROR]', err.message);
      }
    });

    // Message Event Dispatcher (Prefix Commands: on play, onao play, !play)
    botClient.on('messageCreate', async (message) => {
      try {
        if (message.author.bot || !message.guild) return;

        const content = message.content.trim();
        const botMention = `<@${botClient.user.id}>`;
        const botMentionNick = `<@!${botClient.user.id}>`;

        let prefix = 'on ';
        let matchPrefix = null;

        const guildSettings = getGuildSettings(message.guild.id);
        const customPrefix = guildSettings.prefix || 'on ';

        const validPrefixes = [customPrefix, 'on ', 'onao ', '!', botMention, botMentionNick];
        for (const p of validPrefixes) {
          if (content.toLowerCase().startsWith(p.toLowerCase())) {
            matchPrefix = p;
            break;
          }
        }

        if (!matchPrefix) return;

        const rawArgs = content.slice(matchPrefix.length).trim();
        if (!rawArgs) {
          // If user just typed prefix or mentioned the bot with no command
          await message.channel.send({
            content: `👋 Halo <@${message.author.id}>! Prefix saya adalah \`${matchPrefix.trim()}\`.\nKetik **\`${matchPrefix.trim()} play <judul lagu>\`** untuk memutar musik, **\`${matchPrefix.trim()} np\`** untuk info lagu, atau **\`${matchPrefix.trim()} help\`** untuk daftar perintah!`
          }).catch(() => {});
          return;
        }

        const parts = rawArgs.split(/\s+/);
        const cmdName = parts[0].toLowerCase();
        const argsStr = parts.slice(1).join(' ');
        const attachmentUrl = message.attachments?.first()?.url || null;

        const parsedOptions = {
          query: argsStr,
          seconds: parseInt(argsStr, 10) || 15,
          subcommand: parts[1] || '',
          action: parts[1] || '',
          value: parts[2] || '',
          subArg1: parts[2] || '',
          subArg2: parts[3] || '',
          subArg3: parts.slice(4).join(' ') || '',
          attachmentUrl,
          rawArgs: parts.slice(1)
        };

        if (message.mentions?.users?.first()) {
          parsedOptions.user = message.mentions.users.first();
        }

        console.log(`[PREFIX CMD] 📩 Received: '${content}' -> '${cmdName}' from @${message.author.username} in Guild: ${message.guild.name}`);

        await handleMusicCommand(message, cmdName, parsedOptions, botClient, commandHelpers);
      } catch (err) {
        console.warn('[MESSAGE COMMAND ERROR]', err.message);
      }
    });

    botClient.on('error', (err) => console.error(`[DISCORD CLIENT ERROR] ${err?.message || err}`));
    botClient.on('shardDisconnect', (ev, id) => console.warn(`[SHARD ${id}] Disconnected (${ev.code}). Reconnecting...`));
    botClient.on('shardReconnecting', (id) => console.log(`[SHARD ${id}] Reconnecting...`));
    botClient.on('shardResume', (id, replayed) => console.log(`[SHARD ${id}] Resumed (${replayed} events).`));
  }

  registerClientEvents(client);

  try {
    await client.login(token);
  } catch (err) {
    if (err.message?.includes('disallowed intents')) {
      console.warn('[BOT INTENT] ⚠️ Disallowed Intents detected. Attempting fallback...');

      const attemptFallback = async (withMembers, withContent) => {
        const fbIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages];
        if (withMembers) fbIntents.push(GatewayIntentBits.GuildMembers);
        if (withContent) fbIntents.push(GatewayIntentBits.MessageContent);

        client = new Client({ intents: fbIntents });
        botClient = client;
        client.nativeVoice = new NativeVoiceEngineManager(client);

        setupLavalink(client);
        registerClientEvents(client);

        client.once('ready', async () => {
          console.log(`[BOT] ✅ Online as ${client.user.tag} [Members: ${withMembers}, Content: ${withContent}]`);
          client.user.setActivity({ name: withContent ? '🎶 on play <lagu> | /play' : '🎶 /play <lagu>', type: ActivityType.Listening });

          hasMessageContentIntent = withContent;
          hasGuildMembersIntent = withMembers;
          try {
            fs.writeFileSync(
              path.resolve(__dirname, 'intent-status.json'),
              JSON.stringify({ hasMessageContentIntent, hasGuildMembersIntent, lastChecked: Date.now() }, null, 2)
            );
          } catch (e) {}

          try {
            client.lavalink.init({ id: client.user.id, username: client.user.username });
          } catch (e) {}
        });

        await client.login(token);
      };

      try {
        await attemptFallback(true, false);
      } catch (e1) {
        try {
          await attemptFallback(false, true);
        } catch (e2) {
          await attemptFallback(false, false);
        }
      }
    } else {
      console.error('[BOT LOGIN ERROR]', err.message);
    }
  }
}

// Launch master bot
startBot().catch((err) => {
  console.error('[BOT FATAL ERROR]', err.message);
});
