/**
 * On Ao Discord Music Bot - Lavalink Patches & Node Candidate Manager
 * High-performance Lavalink prototype monkey-patches & crash shields
 */
const { LavalinkNode } = require('lavalink-client');

/**
 * Global Process Crash Shield
 * Prevents unhandled socket aborts or network promise rejections from crashing Node process
 */
function setupProcessCrashShield() {
  process.on('uncaughtException', (err, origin) => {
    console.error(`[UNCAUGHT EXCEPTION SHIELD] [${origin}] ${err?.stack || err?.message || err}`);
  });

  process.on('unhandledRejection', (reason) => {
    console.error(`[UNHANDLED REJECTION SHIELD] ${reason?.stack || reason?.message || reason}`);
  });
}

/**
 * Monkey-patch LavalinkNode.prototype to handle 404, HTML error pages, and rate limits from public nodes
 */
function applyLavalinkNodePatches() {
  if (!LavalinkNode || !LavalinkNode.prototype) return;

  if (typeof LavalinkNode.prototype.fetchInfo === 'function') {
    const originalFetchInfo = LavalinkNode.prototype.fetchInfo;
    LavalinkNode.prototype.fetchInfo = async function (...args) {
      try {
        const res = await originalFetchInfo.apply(this, args);
        if (res) return res;
      } catch (e) {
        console.warn(`[LAVALINK FETCHINFO RATELIMIT BYPASS] ⚠️ Gagal mengambil info dari '${this.id}' (${e.message}). Menggunakan mock info untuk menjaga koneksi tetap aktif.`);
      }
      return {
        version: {
          semver: "4.0.0",
          major: 4,
          minor: 0,
          patch: 0,
          preRelease: null
        },
        buildTime: Date.now(),
        git: {
          branch: "main",
          commit: "mocked",
          commitTime: Date.now()
        },
        jvm: "21.0.0",
        lavaplayer: "3.0.0",
        sourceManagers: ["soundcloud", "youtube", "spotify", "http"],
        filters: ["volume", "equalizer", "timescale", "tremolo", "vibrato"],
        plugins: [],
        isNodelink: false
      };
    };
  }

  if (typeof LavalinkNode.prototype.open === 'function') {
    const originalOpen = LavalinkNode.prototype.open;
    LavalinkNode.prototype.open = async function (...args) {
      try {
        return await originalOpen.apply(this, args);
      } catch (openErr) {
        console.warn(`[LAVALINK SHIELD] ⚠️ Node '${this.id}' (${this.options?.host || 'unknown'}) gagal verifikasi /info atau handshake: ${openErr.message}`);
        this.isAlive = false;
        this.connected = false;
        if (this.socket) {
          try { this.socket.close(); } catch (e) {}
        }
        return null;
      }
    };
  }

  if (typeof LavalinkNode.prototype.reconnect === 'function') {
    const originalReconnect = LavalinkNode.prototype.reconnect;
    LavalinkNode.prototype.reconnect = function (...args) {
      if (this.inCooldown) return;
      return originalReconnect.apply(this, args);
    };
  }

  if (typeof LavalinkNode.prototype.connect === 'function') {
    const originalConnect = LavalinkNode.prototype.connect;
    LavalinkNode.prototype.connect = function (...args) {
      if (this.inCooldown) return;
      return originalConnect.apply(this, args);
    };
  }
}

/**
 * Build deduplicated list of Lavalink node candidates
 */
function buildNodeCandidates() {
  const customHost = process.env.LAVALINK_HOST?.trim();
  const isOutdatedReplit = customHost && customHost.includes('sisko.replit.dev');
  const primaryPort = parseInt(process.env.LAVALINK_PORT || '443', 10);
  const primaryPassword = process.env.LAVALINK_PASSWORD || process.env.LAVALINK_SERVER_PASSWORD || 'https://discord.gg/mjS5J2K3ep';

  let primarySecure = primaryPort === 443;
  if (process.env.LAVALINK_SECURE) {
    primarySecure = process.env.LAVALINK_SECURE.toLowerCase() === 'true' || primaryPort === 443;
  }

  const seenEndpoints = new Set();
  const candidates = [];

  function addCandidate(candidate) {
    if (!candidate || !candidate.host) return;
    const cleanHost = candidate.host.trim().toLowerCase();
    const cleanPort = parseInt(candidate.port || '443', 10);
    const key = `${cleanHost}:${cleanPort}`;
    if (seenEndpoints.has(key)) {
      console.log(`[LAVALINK CONFIG] ⏩ Mengabaikan duplikat node candidate '${candidate.id}' (${key}).`);
      return;
    }
    seenEndpoints.add(key);
    candidates.push(candidate);
  }

  // 1. High-Performance Official Lavalink v4 Production Node
  addCandidate({
    id: 'millohost-v4',
    host: 'lava-v4.millohost.my.id',
    port: 443,
    authorization: 'https://discord.gg/mjS5J2K3ep',
    password: 'https://discord.gg/mjS5J2K3ep',
    secure: true,
    retryAmount: 5,
    retryDelay: 8000,
    closeOnError: false
  });

  // 2. Custom host from env if provided and valid
  if (customHost && !isOutdatedReplit) {
    addCandidate({
      id: 'custom-primary',
      host: customHost,
      port: primaryPort,
      authorization: primaryPassword,
      password: primaryPassword,
      secure: primarySecure,
      retryAmount: 4,
      retryDelay: 10000,
      closeOnError: false
    });
  }

  // 3. Backup node
  addCandidate({
    id: 'serenetia-v4-backup',
    host: 'lavalinkv4.serenetia.com',
    port: 443,
    authorization: 'https://seretia.link/discord',
    password: 'https://seretia.link/discord',
    secure: true,
    retryAmount: 3,
    retryDelay: 15000,
    closeOnError: false
  });

  // 4. Optional custom backup node
  if (process.env.LAVALINK_BACKUP_HOST) {
    addCandidate({
      id: 'custom-backup',
      host: process.env.LAVALINK_BACKUP_HOST.trim(),
      port: parseInt(process.env.LAVALINK_BACKUP_PORT || '443', 10),
      authorization: process.env.LAVALINK_BACKUP_PASSWORD || primaryPassword,
      password: process.env.LAVALINK_BACKUP_PASSWORD || primaryPassword,
      secure: (process.env.LAVALINK_BACKUP_SECURE || 'true').toLowerCase() === 'true',
      retryAmount: 4,
      retryDelay: 10000,
      closeOnError: false
    });
  }

  return candidates;
}

module.exports = {
  setupProcessCrashShield,
  applyLavalinkNodePatches,
  buildNodeCandidates
};
