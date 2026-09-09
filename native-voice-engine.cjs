/**
 * On Ao Discord Bot - Native Direct Voice Engine (Robust & Continuous)
 * Zero-dependency-server fallback engine powered by @discordjs/voice, play-dl, and prism-media FFmpeg
 * Guaranteed continuous playback with automatic reconnect and zero premature stops.
 */
const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  entersState,
  StreamType
} = require('@discordjs/voice');
const play = require('play-dl');
const prism = require('prism-media');
const EventEmitter = require('events');
const { PassThrough } = require('stream');

// Verified fallback SoundCloud Client IDs
const SC_CLIENT_IDS = [
  'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo',
  '7Pvd44pT5F68Lg405QO3BwQ7rNqA864S',
  'm39f727829778263435b67272883901a',
  'a3e059563d7fd3372b49b37f00a00bcf'
];

let isPlayDlInitialized = false;
let activeScClientId = null;

async function initPlayDl(forceRefresh = false) {
  if (isPlayDlInitialized && !forceRefresh && activeScClientId) return activeScClientId;
  
  // 1. Attempt to get fresh dynamic Client ID from SoundCloud
  try {
    const freshCid = await play.getFreeClientID();
    if (freshCid) {
      await play.setToken({ soundcloud: { client_id: freshCid } });
      activeScClientId = freshCid;
      isPlayDlInitialized = true;
      return freshCid;
    }
  } catch (err) {
    console.warn('[SOUNDCLOUD DYNAMIC CID WARN]', err.message);
  }

  // 2. Fallback to known working list
  for (const cid of SC_CLIENT_IDS) {
    try {
      await play.setToken({ soundcloud: { client_id: cid } });
      activeScClientId = cid;
      isPlayDlInitialized = true;
      return cid;
    } catch (e) {}
  }
  return null;
}
initPlayDl().catch(() => {});

class NativePlayerQueue {
  constructor(player) {
    this.player = player;
    this.tracks = [];
    this.current = null;
  }

  add(trackOrTracks) {
    if (Array.isArray(trackOrTracks)) {
      this.tracks.push(...trackOrTracks);
    } else if (trackOrTracks) {
      this.tracks.push(trackOrTracks);
    }
  }

  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  clear() {
    this.tracks = [];
  }

  remove(removeQuery) {
    if (typeof removeQuery === 'number') {
      if (removeQuery < 0 || removeQuery >= this.tracks.length) return null;
      const removed = this.tracks.splice(removeQuery, 1);
      return { removed };
    }
    if (Array.isArray(removeQuery)) {
      const removed = [];
      const sorted = [...removeQuery].sort((a, b) => b - a);
      for (const idx of sorted) {
        if (typeof idx === 'number' && idx >= 0 && idx < this.tracks.length) {
          removed.unshift(...this.tracks.splice(idx, 1));
        }
      }
      return removed.length ? { removed } : null;
    }
    return null;
  }

  splice(start, count, ...items) {
    return this.tracks.splice(start, count, ...items);
  }
}

class NativeGuildPlayer extends EventEmitter {
  constructor(manager, options) {
    super();
    this.manager = manager;
    this.guildId = options.guildId;
    this.voiceChannelId = options.voiceChannelId;
    this.sessionVoiceChannelId = options.voiceChannelId;
    this.textChannelId = options.textChannelId;
    this.selfDeaf = options.selfDeaf !== false;
    this.volume = options.volume || 100;
    this.repeatMode = 'off'; // 'off' | 'track' | 'queue'
    this.position = 0;
    this.lastPlaybackPosition = 0;
    this.playing = false;
    this.paused = false;
    this.connected = false;
    this.isAutoReconnecting = false;
    this.connection = null;
    this.audioPlayer = null;
    this.queue = new NativePlayerQueue(this);
    this.store = new Map();
    this.currentResource = null;
    this.playbackStartTime = 0;
    this.positionTimer = null;
    this.isStopping = false;
    this._filters = {
      eq: [],
      timescale: null,
      rotation: null,
      bassboost: null,
      nightcore: false,
      vaporwave: false,
      eightD: false,
      eqPreset: 'flat'
    };
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
    return value;
  }

  async connect() {
    await initPlayDl();
    const guild = this.manager.client.guilds.cache.get(this.guildId);
    if (!guild) throw new Error(`Guild ${this.guildId} not found`);

    // Clean up any stale/orphaned Discord voice connection for this guild to prevent yellow warning '!'
    let conn = getVoiceConnection(this.guildId);
    if (conn && (conn.state.status === VoiceConnectionStatus.Destroyed || conn.state.status === VoiceConnectionStatus.Disconnected || conn.state.status !== VoiceConnectionStatus.Ready || this.isAutoReconnecting)) {
      try { conn.destroy(); } catch (e) {}
      conn = null;
    }

    // Explicitly send Gateway opcode 4 (Voice State Update) setting channel_id: null to reset Gateway session state
    try {
      if (guild.shard) {
        guild.shard.send({
          op: 4,
          d: { guild_id: this.guildId, channel_id: null, self_mute: false, self_deaf: false }
        });
      }
    } catch (e) {}

    if (!conn) {
      if (this.connection) {
        try { this.connection.destroy(); } catch (e) {}
        this.connection = null;
      }

      this.connection = joinVoiceChannel({
        channelId: this.voiceChannelId,
        guildId: this.guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: this.selfDeaf !== false,
        selfMute: false,
        group: 'default'
      });
      conn = this.connection;

      this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        if (this.manualDisconnect) {
          this.destroy().catch(() => {});
          return;
        }

        // If not manual, preserve the player and queue for Auto-Reconnect
        try {
          await Promise.race([
            entersState(this.connection, VoiceConnectionStatus.Signalling, 3000),
            entersState(this.connection, VoiceConnectionStatus.Connecting, 3000)
          ]);
        } catch (error) {
          // If disconnected permanently, cleanly destroy without wiping queue
          if (this.connection && !this.manualDisconnect) {
            try { this.connection.destroy(); } catch (e) {}
            this.connection = null;
          }
        }
      });

      this.connection.on('error', (err) => {
        console.warn(`[VOICE CONNECTION ERROR] Guild ${this.guildId}:`, err.message);
      });
    } else {
      this.connection = conn;
    }

    if (!this.audioPlayer) {
      this.audioPlayer = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
          maxMissedFrames: 1000
        }
      });
      this.setupAudioPlayerEvents();
    }

    let isReady = false;
    try {
      if (this.connection.state.status !== VoiceConnectionStatus.Ready) {
        await entersState(this.connection, VoiceConnectionStatus.Ready, 8_000);
      }
      isReady = true;
    } catch (e) {
      console.warn(`[VOICE CONNECTION WARN] Guild ${this.guildId} failed initial Ready state (${this.connection?.state?.status}). Force resetting & retrying...`);
      try { this.connection?.destroy(); } catch (err) {}
      this.connection = null;

      // Force reset Gateway voice state
      try {
        if (guild.shard) {
          guild.shard.send({
            op: 4,
            d: { guild_id: this.guildId, channel_id: null, self_mute: false, self_deaf: false }
          });
        }
      } catch (err) {}

      await new Promise(r => setTimeout(r, 800));

      this.connection = joinVoiceChannel({
        channelId: this.voiceChannelId,
        guildId: this.guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: this.selfDeaf !== false,
        selfMute: false,
        group: 'default'
      });

      try {
        await entersState(this.connection, VoiceConnectionStatus.Ready, 10_000);
        isReady = true;
      } catch (retryErr) {
        console.warn(`[VOICE CONNECTION RETRY FAIL] Guild ${this.guildId}:`, retryErr.message);
      }
    }

    if (this.connection && this.audioPlayer) {
      this.connection.subscribe(this.audioPlayer);
    }
    this.connected = isReady;
    return this;
  }

  async changeVoiceState(data) {
    const newChannelId = typeof data === 'string' ? data : (data?.voiceChannelId || data?.channelId);
    if (!newChannelId) return this;
    this.voiceChannelId = newChannelId;
    this.sessionVoiceChannelId = newChannelId;
    const guild = this.manager.client.guilds.cache.get(this.guildId);
    if (guild) {
      try {
        this.connection = joinVoiceChannel({
          channelId: newChannelId,
          guildId: this.guildId,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: this.selfDeaf !== false,
          selfMute: false,
          group: 'default'
        });
        if (this.audioPlayer) {
          this.connection.subscribe(this.audioPlayer);
        }
        this.connected = true;
      } catch (err) {
        console.warn(`[NATIVE VOICE] changeVoiceState to ${newChannelId} failed:`, err.message);
      }
    }
    return this;
  }

  async reconnectAndResume(targetChannelId, savedTrackOverride = null, savedSeekSecOverride = null, savedQueueOverride = null) {
    this.isAutoReconnecting = true;
    this.isStopping = false;

    const channelId = targetChannelId || this.sessionVoiceChannelId || this.voiceChannelId;
    const currentTrack = savedTrackOverride || this.queue.current;
    const seekSec = (typeof savedSeekSecOverride === 'number' && savedSeekSecOverride >= 0)
      ? savedSeekSecOverride
      : Math.max(0, Math.floor((this.position || this.lastPlaybackPosition || 0) / 1000));

    if (savedQueueOverride && Array.isArray(savedQueueOverride) && savedQueueOverride.length > 0) {
      this.queue.tracks = [...savedQueueOverride];
    }

    console.log(`[AUTO-RECONNECT] 🛡️ Membersihkan koneksi lama dan menghubungkan kembali ke channel ${channelId} (Resume di ${seekSec}s)...`);

    const guild = this.manager.client.guilds.cache.get(this.guildId);

    // 1. Fully destroy stale voice connections to eliminate Discord yellow '!' warning
    if (this.connection) {
      try { this.connection.destroy(); } catch (e) {}
      this.connection = null;
    }
    const staleGlobalConn = getVoiceConnection(this.guildId);
    if (staleGlobalConn) {
      try { staleGlobalConn.destroy(); } catch (e) {}
    }

    // Force Discord Gateway to release previous voice session token
    if (guild && guild.shard) {
      try {
        guild.shard.send({
          op: 4,
          d: { guild_id: this.guildId, channel_id: null, self_mute: false, self_deaf: false }
        });
      } catch (e) {}
    }

    if (this.audioPlayer) {
      try { this.audioPlayer.stop(true); } catch (e) {}
    }

    this.voiceChannelId = channelId;
    this.sessionVoiceChannelId = channelId;

    // Wait 800ms to allow Discord Voice Gateway to reset session
    await new Promise(r => setTimeout(r, 800));

    // 2. Establish fresh voice connection & wait for Ready
    try {
      await this.connect();
    } catch (err) {
      console.warn('[AUTO-RECONNECT CONNECT FAILED]', err.message);
    }

    // Immediately verify session state after connection to clear any '!' alert status
    const isConnReady = this.connection && this.connection.state.status === VoiceConnectionStatus.Ready;
    if (isConnReady) {
      this.connected = true;
      console.log(`[AUTO-RECONNECT] ✅ Voice connection verified READY for channel ${channelId}. Alert '!' status cleared.`);
    } else {
      console.warn(`[AUTO-RECONNECT] ⚠️ Voice connection status not READY (${this.connection?.state?.status}). Retrying connect...`);
      try {
        await this.connect();
      } catch (retryErr) {
        console.warn('[AUTO-RECONNECT RETRY FAILED]', retryErr.message);
      }
    }

    // 3. Trigger resume/play on the current track at saved position
    if (currentTrack) {
      this.queue.current = currentTrack;
      this.playing = true;
      this.paused = false;
      console.log(`[AUTO-RESUME] 🎶 Melanjutkan trek: "${currentTrack.title || currentTrack.info?.title}" di ${seekSec} detik.`);
      try {
        await this.playTrack(currentTrack, seekSec);
      } catch (playErr) {
        console.warn('[AUTO-RESUME PLAY ERR]', playErr.message);
      }
    } else if (this.paused) {
      try {
        await this.resume();
      } catch (resumeErr) {
        console.warn('[AUTO-RESUME ERR]', resumeErr.message);
      }
    }

    this.isAutoReconnecting = false;
    return true;
  }

  setupAudioPlayerEvents() {
    this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
      this.playing = true;
      this.paused = false;
      this.playbackStartTime = Date.now();
      this.isChangingStream = false;
      this.isAutoReconnecting = false;
      this.startPositionTimer();
    });

    this.audioPlayer.on(AudioPlayerStatus.Paused, () => {
      this.paused = true;
      this.stopPositionTimer();
    });

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.stopPositionTimer();
      if (this.isStopping || this.isChangingStream || this.isAutoReconnecting) return;

      const finishedTrack = this.queue.current;
      const wasSkipping = Boolean(this.isSkipping);
      this.isSkipping = false;

      this.playing = false;
      this.paused = false;
      this.position = 0;

      if (finishedTrack) {
        this.manager.emit('trackEnd', this, finishedTrack);
      }

      if (!wasSkipping && this.repeatMode === 'track' && finishedTrack) {
        this.playTrack(finishedTrack).catch(() => {});
        return;
      }

      if (this.repeatMode === 'queue' && finishedTrack) {
        this.queue.tracks.push(finishedTrack);
      }

      if (this.queue.tracks.length > 0) {
        const next = this.queue.tracks.shift();
        this.playTrack(next).catch(() => {});
      } else {
        this.queue.current = null;
        this.manager.emit('queueEnd', this);
      }
    });

    this.audioPlayer.on('error', (err) => {
      console.warn(`[NATIVE AUDIO PLAYER ERROR] Guild ${this.guildId}:`, err.message);
      if (this.isStopping || this.isChangingStream || this.isAutoReconnecting) return;

      if (this.queue.tracks.length > 0) {
        const next = this.queue.tracks.shift();
        this.playTrack(next).catch(() => {});
      } else {
        this.playing = false;
        this.queue.current = null;
        this.manager.emit('queueEnd', this);
      }
    });
  }

  startPositionTimer() {
    this.stopPositionTimer();
    this.positionTimer = setInterval(() => {
      if (this.playing && !this.paused) {
        this.position += 1000;
        this.lastPlaybackPosition = this.position;
      }
    }, 1000);
  }

  stopPositionTimer() {
    if (this.positionTimer) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
  }

  async play() {
    if (this.playing && !this.paused) return;
    if (this.paused) {
      return this.resume();
    }
    if (!this.queue.current && this.queue.tracks.length > 0) {
      const track = this.queue.tracks.shift();
      return await this.playTrack(track);
    }
  }

  async playTrack(track, seekSeconds = 0) {
    if (!track) return;
    this.isStopping = false;
    await this.connect();

    this.queue.current = track;
    this.playing = true;
    this.position = (seekSeconds || 0) * 1000;
    this.lastPlaybackPosition = this.position;

    const uri = track.uri || track.info?.uri || track.url;

    // 1. Direct radio / HTTP stream
    if (uri && (uri.includes('.zeno.fm') || uri.endsWith('.mp3') || uri.endsWith('.aac') || uri.endsWith('.ogg') || uri.includes('/stream'))) {
      try {
        const resource = createAudioResource(uri, {
          inputType: StreamType.Arbitrary,
          inlineVolume: true
        });

        if (resource.volume) {
          resource.volume.setVolume(Math.max(0.01, Math.min(1.0, this.volume / 100)));
        }

        this.currentResource = resource;
        this.audioPlayer.play(resource);
        if (!seekSeconds && !this.isSeeking) {
          this.manager.emit('trackStart', this, track);
        }
        this.isSeeking = false;
        return;
      } catch (err) {
        console.warn('[NATIVE STREAM DIRECT ERR]', err.message);
      }
    }

    // 2. Resolve via SoundCloud Stream (Official Artist Matching & Web URL Seeking)
    try {
      await initPlayDl();
      let streamData = null;
      const isShortSnippet = ((track.duration || track.info?.duration || 0) > 0 && (track.duration || track.info?.duration || 0) <= 45000);

      let targetUrl = track.resolvedWebUrl;

      if (!targetUrl && uri && uri.includes('soundcloud.com') && !uri.includes('api.soundcloud.com') && !isShortSnippet) {
        targetUrl = uri;
      }

      if (!targetUrl) {
        const rawTitle = (track.title || track.info?.title || '').replace(/Official Audio|Official Music Video|Official Video|Lyrics|Audio|HD|4K/gi, '').trim();
        const rawArtist = (track.author || track.info?.author || '').replace(/VEVO|- Topic|Official/gi, '').trim();
        const searchQuery = `${rawArtist} ${rawTitle}`.trim() || track.title || uri;

        const scResults = await play.search(searchQuery, { source: { soundcloud: 'tracks' }, limit: 12 }).catch(() => []);
        if (scResults && scResults.length > 0) {
          const artistLower = rawArtist.toLowerCase();

          const officialMatch = scResults.find(s => {
            const uName = (s.user?.name || '').toLowerCase();
            const sTitle = (s.name || '').toLowerCase();
            const isBadEdit = /slowed|sped up|nightcore|reverb|remix|cover|pitch|bootleg/i.test(sTitle) || /slowed|sped up|nightcore|reverb|remix|cover|pitch|bootleg/i.test(uName);
            const isArtist = artistLower.length > 1 && (uName.includes(artistLower) || artistLower.includes(uName));
            return isArtist && !isBadEdit && (s.durationInSec || 0) > 45;
          }) || scResults.find(s => {
            const sTitle = (s.name || '').toLowerCase();
            const isBadEdit = /slowed|sped up|nightcore|reverb|remix|cover|pitch|bootleg/i.test(sTitle);
            return !isBadEdit && (s.durationInSec || 0) > 45;
          }) || scResults[0];

          if (officialMatch) {
            targetUrl = officialMatch.permalink || officialMatch.url;
            if (officialMatch.name) {
              track.title = officialMatch.name;
              if (track.info) track.info.title = officialMatch.name;
            }
            if (officialMatch.user?.name) {
              track.author = officialMatch.user.name;
              if (track.info) track.info.author = officialMatch.user.name;
            }
            if (officialMatch.durationInSec) {
              const durMs = officialMatch.durationInSec * 1000;
              track.duration = durMs;
              if (track.info) track.info.duration = durMs;
            }
            if (officialMatch.thumbnail) {
              track.artworkUrl = officialMatch.thumbnail;
              if (track.info) track.info.artworkUrl = officialMatch.thumbnail;
            }
          }
        }
      }

      if (!targetUrl) targetUrl = uri;

      if (targetUrl && targetUrl.includes('api.soundcloud.com/tracks/') && track.permalink) {
        targetUrl = track.permalink;
      }

      let useFfmpegSeek = false;
      if (targetUrl) {
        track.resolvedWebUrl = targetUrl;
        const seekOpt = seekSeconds ? { seek: Math.floor(seekSeconds), quality: 2 } : { quality: 2 };
        try {
          streamData = await play.stream(targetUrl, seekOpt);
        } catch (ytErr) {
          console.warn(`[NATIVE STREAM WARN] Stream with seek failed for "${track.title}": ${ytErr.message}. Attempting fallback...`);

          if (seekSeconds > 0) {
            try {
              streamData = await play.stream(targetUrl, { quality: 2 });
              useFfmpegSeek = true;
            } catch (noSeekErr) {
              console.warn(`[NATIVE STREAM WARN] Standard stream without seek failed: ${noSeekErr.message}`);
            }
          }

          if (!streamData) {
            console.warn(`[NATIVE STREAM YT/SC FALLBACK] Switching to SoundCloud search for "${track.title}"...`);
            const rawTitle = (track.title || track.info?.title || '').replace(/Official Audio|Official Music Video|Official Video|Lyrics|Audio|HD|4K/gi, '').trim();
            const rawArtist = (track.author || track.info?.author || '').replace(/VEVO|- Topic|Official/gi, '').trim();
            const scQuery = `${rawArtist} ${rawTitle}`.trim() || track.title;
            const scResults = await play.search(scQuery, { source: { soundcloud: 'tracks' }, limit: 5 }).catch(() => []);
            if (scResults && scResults.length > 0) {
              const bestSc = scResults.find(s => (s.durationInSec || 0) > 45) || scResults[0];
              const scUrl = bestSc.permalink || bestSc.url;
              if (scUrl) {
                track.resolvedWebUrl = scUrl;
                try {
                  streamData = await play.stream(scUrl, seekOpt);
                } catch (scSeekErr) {
                  try {
                    streamData = await play.stream(scUrl, { quality: 2 });
                    if (seekSeconds > 0) useFfmpegSeek = true;
                  } catch (scNoSeekErr) {
                    console.warn('[SC FALLBACK ERR]', scNoSeekErr.message);
                  }
                }
              }
            }
          }

          if (!streamData) {
            throw ytErr;
          }
        }
      }

      if (streamData && streamData.stream) {
        let finalStream;
        let inputType;

        const filterStr = this.buildFFmpegFilterString();
        const hasFilters = Boolean(filterStr && filterStr.length > 0);

        if (hasFilters || useFfmpegSeek) {
          console.log(`[NATIVE TRANSCODE] 🎛️ FFmpeg processing (Filters: "${filterStr || 'none'}", FFmpeg Seek: ${useFfmpegSeek ? seekSeconds + 's' : 'none'}).`);

          try {
            const ffmpegArgs = [
              '-analyzeduration', '0',
              '-loglevel', '0'
            ];

            if (useFfmpegSeek && seekSeconds > 0) {
              ffmpegArgs.push('-ss', String(Math.floor(seekSeconds)));
            }

            ffmpegArgs.push('-i', 'pipe:0');

            if (hasFilters) {
              ffmpegArgs.push('-af', filterStr);
            }

            ffmpegArgs.push(
              '-f', 's16le',
              '-ar', '48000',
              '-ac', '2'
            );

            const ffmpegStream = new prism.FFmpeg({ args: ffmpegArgs });

            streamData.stream.on('error', (err) => console.warn('[NATIVE STREAM ERR]', err.message));
            ffmpegStream.on('error', (err) => console.warn('[NATIVE TRANSCODE ERR]', err.message));

            finalStream = streamData.stream.pipe(ffmpegStream);
            inputType = StreamType.Raw;
          } catch (ffmpegSetupErr) {
            console.error('[FFMPEG SETUP ERR]', ffmpegSetupErr.message);
            finalStream = streamData.stream;
            inputType = streamData.type || StreamType.Arbitrary;
          }
        } else {
          if (seekSeconds > 0) {
            console.log(`[NATIVE SEEK] ⏩ Audio seeked to ${seekSeconds}s via play-dl stream.`);
          }
          finalStream = streamData.stream;
          inputType = streamData.type || StreamType.Arbitrary;
        }

        const useInlineVolume = typeof this.volume === 'number' && this.volume !== 100;
        const resource = createAudioResource(finalStream, {
          inputType: inputType,
          inlineVolume: useInlineVolume
        });

        if (useInlineVolume && resource.volume) {
          resource.volume.setVolume(Math.max(0.01, Math.min(1.0, this.volume / 100)));
        }

        this.currentResource = resource;
        this.audioPlayer.play(resource);

        if (!seekSeconds && !this.isSeeking) {
          this.manager.emit('trackStart', this, track);
        }
        this.isSeeking = false;
      } else {
        throw new Error('No playable audio stream available');
      }
    } catch (streamErr) {
      console.warn(`[NATIVE STREAM ERROR] Track "${track.title || uri}":`, streamErr.message);
      this.isSeeking = false;
      if (this.isAutoReconnecting) {
        console.warn(`[AUTO-RECONNECT] Stream error during auto-reconnect. Retaining track "${track.title}" in player.`);
        this.queue.current = track;
        return;
      }
      if (this.queue.tracks.length > 0) {
        const next = this.queue.tracks.shift();
        return await this.playTrack(next);
      } else {
        this.playing = false;
        this.queue.current = null;
        this.manager.emit('queueEnd', this);
      }
    }
  }

  async pause(state) {
    if (typeof state === 'boolean') {
      if (state) {
        if (this.audioPlayer && this.playing && !this.paused) {
          this.audioPlayer.pause();
          this.paused = true;
        }
      } else {
        if (this.audioPlayer && this.paused) {
          this.audioPlayer.unpause();
          this.paused = false;
        }
      }
      return;
    }
    if (this.audioPlayer && this.playing && !this.paused) {
      this.audioPlayer.pause();
      this.paused = true;
    }
  }

  async resume() {
    if (this.audioPlayer && this.paused) {
      this.audioPlayer.unpause();
      this.paused = false;
    }
  }

  async stop(clearQueue = true) {
    return await this.stopPlaying(clearQueue, false);
  }

  async skip() {
    this.isSkipping = true;
    if (this.audioPlayer) {
      this.audioPlayer.stop(true);
    }
  }

  buildFFmpegFilterString() {
    const parts = [];

    // 0. Base Audio Normalization & Anti-Subsonic DC Offset Filter
    // dynaudnorm with smooth Gaussian window (g=31) normalizes volume across intro/verse/chorus
    // and prevents volume ducking when high-frequency vocals/drops occur.
    parts.push('highpass=f=20,dynaudnorm=f=200:g=31:p=0.95:m=10:s=0');

    if (!this._filters) return parts.join(',');

    // 1. Nightcore (High pitch + speed boost)
    if (this._filters.nightcore || (this._filters.timescale && this._filters.timescale.pitch > 1.1)) {
      parts.push('asetrate=48000*1.25,aresample=48000');
    }
    // 2. Vaporwave (Slowed + Low pitch + aesthetic reverb)
    else if (this._filters.vaporwave || (this._filters.timescale && this._filters.timescale.pitch < 0.9)) {
      parts.push('asetrate=48000*0.85,aresample=48000,aecho=0.8:0.88:45:0.3');
    }

    // 3. Bassboost (Rich sub-bass & mid-bass boost)
    if (this._filters.bassboost) {
      const lvl = Number(this._filters.bassboost) || 2;
      if (lvl === 1) parts.push('bass=g=5:f=100:w=0.6');
      else if (lvl === 2) parts.push('bass=g=9:f=100:w=0.6');
      else if (lvl >= 3) parts.push('bass=g=13:f=100:w=0.6');
    }

    // 4. 8D Surround Audio (True 360° rotational binaural stereo panning)
    if (this._filters.eightD || (this._filters.rotation && this._filters.rotation.rotationHz > 0)) {
      parts.push('apulsator=hz=0.125:mode=sine:width=1:offset_l=0:offset_r=0.5,extrastereo=m=1.5');
    }

    // 5. Equalizer Presets & Custom Bands
    if (this._filters.eq && this._filters.eq.length > 0) {
      const freqs = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];
      const eqParts = [];
      for (const eq of this._filters.eq) {
        if (typeof eq.band === 'number' && typeof eq.gain === 'number' && Math.abs(eq.gain) > 0.01) {
          const freq = freqs[eq.band] || (eq.band * 1000);
          const gainDb = Math.round(eq.gain * 15);
          if (gainDb !== 0) {
            eqParts.push(`equalizer=f=${freq}:width_type=o:width=1:g=${gainDb}`);
          }
        }
      }
      if (eqParts.length > 0) {
        parts.push(eqParts.join(','));
      }
    } else if (this._filters.eqPreset && this._filters.eqPreset !== 'flat') {
      const preset = String(this._filters.eqPreset).toLowerCase().trim();
      if (preset === 'hifi') {
        parts.push('treble=g=4,bass=g=3');
      } else if (preset === 'bass') {
        parts.push('bass=g=8');
      } else if (preset === 'deep bass' || preset === 'deepbass' || preset === 'deep') {
        parts.push('bass=g=11:f=80');
      } else if (preset === 'gaming' || preset === 'game') {
        parts.push('equalizer=f=1000:t=q:w=1:g=2,equalizer=f=3000:t=q:w=1:g=3');
      } else if (preset === 'treble') {
        parts.push('treble=g=5');
      } else if (preset === 'studio') {
        parts.push('equalizer=f=250:t=q:w=1:g=-1,equalizer=f=4000:t=q:w=1:g=2');
      }
    }

    return parts.join(',');
  }

  async applyFilter() {
    if (this._applyFilterLock) return;
    this._applyFilterLock = true;
    try {
      if (this.playing && this.queue.current) {
        const currentSec = Math.max(0, Math.floor((this.position || 0) / 1000));
        this.isChangingStream = true;
        await this.playTrack(this.queue.current, currentSec);
      }
    } catch (e) {
      console.warn('[APPLY FILTER ERR]', e.message);
    } finally {
      this._applyFilterLock = false;
    }
  }

  get filterManager() {
    if (!this._filters) {
      this._filters = {
        eq: [],
        timescale: null,
        rotation: null,
        bassboost: null,
        nightcore: false,
        vaporwave: false,
        eightD: false,
        eqPreset: 'flat'
      };
    }
    return {
      filters: this._filters,
      resetFilters: async () => {
        this._filters = {
          eq: [],
          timescale: null,
          rotation: null,
          bassboost: null,
          nightcore: false,
          vaporwave: false,
          eightD: false,
          eqPreset: 'flat'
        };
        await this.applyFilter();
        return true;
      },
      setVolume: async (vol) => this.setVolume(vol),
      setEQ: async (eqs) => {
        this._filters.eq = eqs;
        this._filters.eqPreset = null;
        await this.applyFilter();
        return true;
      },
      setEqualizer: async (eqs) => {
        this._filters.eq = eqs;
        this._filters.eqPreset = null;
        await this.applyFilter();
        return true;
      },
      setBassboost: async (lvl = 2) => {
        this._filters.bassboost = lvl;
        await this.applyFilter();
        return true;
      },
      setTimescale: async (ts) => {
        this._filters.timescale = ts;
        if (ts && ts.pitch >= 1.2) {
          this._filters.nightcore = true;
          this._filters.vaporwave = false;
        } else if (ts && ts.pitch <= 0.9) {
          this._filters.vaporwave = true;
          this._filters.nightcore = false;
        } else {
          this._filters.nightcore = false;
          this._filters.vaporwave = false;
        }
        await this.applyFilter();
        return true;
      },
      setRotation: async (rot) => {
        this._filters.rotation = rot;
        this._filters.eightD = Boolean(rot && rot.rotationHz > 0);
        await this.applyFilter();
        return true;
      },
      setNightcore: async (enable = true) => {
        this._filters.nightcore = enable;
        if (enable) this._filters.vaporwave = false;
        await this.applyFilter();
        return true;
      },
      setVaporwave: async (enable = true) => {
        this._filters.vaporwave = enable;
        if (enable) this._filters.nightcore = false;
        await this.applyFilter();
        return true;
      },
      set8D: async (enable = true) => {
        this._filters.eightD = enable;
        await this.applyFilter();
        return true;
      },
      setEQPreset: async (presetName) => {
        this._filters.eqPreset = presetName;
        this._filters.eq = [];
        await this.applyFilter();
        return true;
      },
      applyPlayerFilters: async () => {
        await this.applyFilter();
        return true;
      }
    };
  }

  async stopPlaying(clearQueue = true, disconnect = false) {
    this.isStopping = true;
    if (clearQueue) this.queue.clear();
    this.queue.current = null;
    this.playing = false;
    this.paused = false;
    this.stopPositionTimer();
    if (this.audioPlayer) {
      this.audioPlayer.stop(true);
    }
    if (disconnect) {
      await this.disconnect();
    }
    setTimeout(() => { this.isStopping = false; }, 500);
  }

  async setVolume(vol) {
    this.volume = Math.max(1, Math.min(100, Number(vol) || 100));
    if (this.currentResource && this.currentResource.volume) {
      this.currentResource.volume.setVolume(this.volume / 100);
    }
  }

  setRepeatMode(mode) {
    this.repeatMode = mode; // 'off', 'track', 'queue'
  }

  async seek(positionMs) {
    const targetMs = Math.max(0, positionMs);
    const sec = Math.floor(targetMs / 1000);
    this.position = targetMs;
    this.isSeeking = true;
    this.isChangingStream = true;
    const track = this.queue.current;
    if (track) {
      await this.playTrack(track, sec);
    }
  }

  async search(queryObj, requester) {
    await initPlayDl();
    const queryStr = typeof queryObj === 'string' ? queryObj : (queryObj.query || '');
    const isUrl = /^https?:\/\//i.test(queryStr);

    try {
      if (isUrl && queryStr.includes('soundcloud.com')) {
        const scInfo = await play.soundcloud(queryStr).catch(() => null);
        if (scInfo) {
          if (scInfo.type === 'playlist' || Array.isArray(scInfo.tracks)) {
            const rawTracks = scInfo.tracks || [];
            const scTracks = rawTracks.map(r => ({
              title: r.name || 'SoundCloud Track',
              author: r.user?.name || scInfo.user?.name || 'SoundCloud',
              duration: (r.durationInSec || 180) * 1000,
              uri: r.url || r.permalink || queryStr,
              artworkUrl: r.thumbnail || scInfo.thumbnail || null,
              requester: requester || null,
              info: {
                title: r.name || 'SoundCloud Track',
                author: r.user?.name || scInfo.user?.name || 'SoundCloud',
                duration: (r.durationInSec || 180) * 1000,
                uri: r.url || r.permalink || queryStr,
                artworkUrl: r.thumbnail || scInfo.thumbnail || null
              }
            }));
            if (scTracks.length > 0) {
              return {
                loadType: 'playlist',
                playlist: {
                  title: scInfo.name || 'SoundCloud Playlist',
                  name: scInfo.name || 'SoundCloud Playlist',
                  author: scInfo.user?.name || 'SoundCloud',
                  artworkUrl: scInfo.thumbnail || null
                },
                tracks: scTracks
              };
            }
          }
          const trk = {
            title: scInfo.name || 'SoundCloud Track',
            author: scInfo.user?.name || 'SoundCloud',
            duration: (scInfo.durationInSec || 180) * 1000,
            uri: scInfo.url || queryStr,
            artworkUrl: scInfo.thumbnail || null,
            requester: requester || null,
            info: {
              title: scInfo.name || 'SoundCloud Track',
              author: scInfo.user?.name || 'SoundCloud',
              duration: (scInfo.durationInSec || 180) * 1000,
              uri: scInfo.url || queryStr,
              artworkUrl: scInfo.thumbnail || null
            }
          };
          return { loadType: 'track', tracks: [trk] };
        }
      }

      if (isUrl && (queryStr.includes('list=') || queryStr.includes('/playlist'))) {
        try {
          const ytPl = await play.playlist_info(queryStr, { incomplete: true }).catch(() => null);
          if (ytPl && ytPl.videos && ytPl.videos.length > 0) {
            const ytTracks = ytPl.videos.map(v => ({
              title: v.title || 'YouTube Track',
              author: v.channel?.name || 'YouTube',
              duration: (v.durationInSec || 180) * 1000,
              uri: v.url,
              artworkUrl: v.thumbnails?.[0]?.url || null,
              requester: requester || null,
              info: {
                title: v.title || 'YouTube Track',
                author: v.channel?.name || 'YouTube',
                duration: (v.durationInSec || 180) * 1000,
                uri: v.url,
                artworkUrl: v.thumbnails?.[0]?.url || null
              }
            }));
            return {
              loadType: 'playlist',
              playlist: {
                title: ytPl.title || 'YouTube Playlist',
                name: ytPl.title || 'YouTube Playlist',
                author: ytPl.channel?.name || 'YouTube',
                artworkUrl: ytPl.thumbnail?.url || null
              },
              tracks: ytTracks
            };
          }
        } catch (ytErr) {}
      }

      // Calculate Original Score helper to rank official tracks highest
      const calculateOriginalScore = (item) => {
        let score = 0;
        const title = (item.name || item.title || '').toLowerCase();
        const author = (item.user?.name || item.channel?.name || '').toLowerCase();
        const durSec = item.durationInSec || (item.duration ? item.duration / 1000 : 0);
        const cleanQ = queryStr.toLowerCase().replace(/official|audio|video|full/g, '').trim();
        const artistGuess = cleanQ.includes('-') ? cleanQ.split('-')[0].trim() : cleanQ.split(' ')[0];

        if (artistGuess && (author.includes(artistGuess) || artistGuess.includes(author))) score += 200;
        if (author.endsWith('- topic') || author.endsWith('vevo') || author.includes('official')) score += 100;
        if (title.includes('official audio') || title.includes('official music video') || title.includes('official video')) score += 80;
        if (title.includes('cover') || title.includes('remix') || title.includes('slowed') || title.includes('reverb') || title.includes('nightcore') || title.includes('sped up') || title.includes('bootleg') || title.includes('edit') || title.includes('pitch')) score -= 300;
        if (author.includes('slowed') || author.includes('nightcore') || author.includes('reverb') || author.includes('sped up') || author.includes('edits')) score -= 300;
        if (artistGuess && !author.includes(artistGuess) && !author.includes('topic') && !author.includes('vevo')) score -= 80;
        if (durSec >= 90 && durSec <= 480) score += 30;
        else if (durSec < 45 || durSec > 1200) score -= 100;

        return score;
      };

      // Search YouTube videos first if query is text to get original official channel track
      let results = [];
      if (!isUrl) {
        results = await play.search(`${queryStr} official audio`, { source: { youtube: 'video' }, limit: 10 }).catch(() => []);
        if (!results || results.length === 0) {
          results = await play.search(queryStr, { source: { youtube: 'video' }, limit: 10 }).catch(() => []);
        }
      }

      // Fallback to SoundCloud if YouTube search failed or query is url
      if (!results || results.length === 0) {
        results = await play.search(queryStr, { source: { soundcloud: 'tracks' }, limit: 15 }).catch(() => []);
      }

      let validTracks = (results || []).filter(r => (r.durationInSec || 0) > 45);

      if (validTracks && validTracks.length > 0) {
        // Sort tracks descending by calculateOriginalScore
        validTracks.sort((a, b) => calculateOriginalScore(b) - calculateOriginalScore(a));

        const tracks = validTracks.map(r => {
          const webUrl = r.permalink || (r.url && !r.url.includes('api.soundcloud.com') ? r.url : null);
          return {
            title: r.name || r.title || queryStr,
            author: r.user?.name || r.channel?.name || 'Artist',
            duration: (r.durationInSec || 180) * 1000,
            uri: webUrl || r.url,
            permalink: r.permalink,
            resolvedWebUrl: webUrl,
            artworkUrl: r.thumbnail || r.thumbnails?.[0]?.url || null,
            requester: requester || null,
            info: {
              title: r.name || r.title || queryStr,
              author: r.user?.name || r.channel?.name || 'Artist',
              duration: (r.durationInSec || 180) * 1000,
              uri: webUrl || r.url,
              artworkUrl: r.thumbnail || r.thumbnails?.[0]?.url || null
            }
          };
        });
        return { loadType: 'search', tracks };
      }
    } catch (e) {
      console.warn('[NATIVE SEARCH ERR]', e.message);
    }

    // Direct fallback item
    const fallbackTrack = {
      title: queryStr,
      author: 'Streaming Audio',
      duration: 180000,
      uri: isUrl ? queryStr : `https://soundcloud.com/search?q=${encodeURIComponent(queryStr)}`,
      artworkUrl: null,
      requester: requester || null,
      info: {
        title: queryStr,
        author: 'Streaming Audio',
        duration: 180000,
        uri: isUrl ? queryStr : `https://soundcloud.com/search?q=${encodeURIComponent(queryStr)}`,
        artworkUrl: null
      }
    };
    return { loadType: 'track', tracks: [fallbackTrack] };
  }

  async disconnect() {
    this.connected = false;
    this.stopPositionTimer();
    if (this.connection) {
      try {
        this.connection.destroy();
      } catch (e) {}
      this.connection = null;
    }
  }

  async destroy() {
    await this.stopPlaying(true, true);
    this.manager.players.delete(this.guildId);
    this.manager.emit('playerDestroy', this);
  }
}

class NativeVoiceEngineManager extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.players = new Map();
    this.nodeManager = {
      nodes: new Map([
        ['native-built-in', { id: 'native-built-in', connected: true, options: { host: 'localhost (Built-In Direct Engine)', port: 0 } }]
      ]),
      on: () => {}
    };
  }

  init(user) {
    console.log(`[NATIVE VOICE ENGINE] 🚀 Mesin audio bawaan (Built-in Native Engine) aktif untuk bot: ${user?.username}`);
  }

  getPlayer(guildId) {
    return this.players.get(guildId) || null;
  }

  createPlayer(options) {
    let player = this.players.get(options.guildId);
    if (!player) {
      player = new NativeGuildPlayer(this, options);
      this.players.set(options.guildId, player);
    } else {
      player.voiceChannelId = options.voiceChannelId;
      player.textChannelId = options.textChannelId;
    }
    return player;
  }
}

module.exports = {
  NativeVoiceEngineManager,
  NativeGuildPlayer
};
