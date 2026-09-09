/**
 * On Ao Discord Music Bot - Command Processor
 * Professional Discord Music Studio Controls & Utilities
 */
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  AttachmentBuilder,
  PermissionsBitField
} = require('discord.js');
const { generateOnAoProfileCard } = require('./profile-canvas.cjs');
const {
  getLanguage,
  setLanguage,
  getGuildSettings,
  updateGuildSettings,
  isUserDJ,
  t
} = require('./bot-i18n.cjs');

function getBandsForPreset(presetName = 'flat', bassboostLevel = 0) {
  const bandsMap = new Map();
  for (let i = 0; i <= 14; i++) bandsMap.set(i, 0.0);

  const name = String(presetName || 'flat').toLowerCase().trim();
  if (name === 'hifi') {
    [0.10, 0.08, 0.05, 0.02, 0, 0, 0, 0, 0, 0, 0.02, 0.06, 0.10, 0.12, 0.15].forEach((g, i) => bandsMap.set(i, g));
  } else if (name === 'studio') {
    [0.02, 0, 0, 0, 0, -0.02, 0.02, 0, 0.05, 0.08, 0.05, 0, 0, 0.02, 0].forEach((g, i) => bandsMap.set(i, g));
  } else if (name === 'deep bass' || name === 'deepbass' || name === 'deep' || name === 'bass') {
    [0.25, 0.20, 0.15, 0.08, 0.02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].forEach((g, i) => bandsMap.set(i, g));
  } else if (name === 'gaming' || name === 'game') {
    [0.08, 0.05, 0, 0, 0, 0, 0.08, 0.10, 0.12, 0.15, 0.12, 0.08, 0, 0, 0].forEach((g, i) => bandsMap.set(i, g));
  } else if (name === 'treble') {
    [0, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.10, 0.15, 0.20, 0.22, 0.25, 0.25].forEach((g, i) => bandsMap.set(i, g));
  } else if (name === 'vocal' || name === 'vocalboost' || name === 'vocal booster') {
    // Vocal booster: Reduce low rumble (-0.08 on sub-bass), elevate vocal presence (1kHz - 4kHz)
    [-0.08, -0.05, -0.02, 0.0, 0.02, 0.08, 0.15, 0.18, 0.15, 0.08, 0.02, 0.0, 0.0, 0.0, 0.0].forEach((g, i) => bandsMap.set(i, g));
  }

  const lvl = Number(bassboostLevel) || 0;
  if (lvl === 1) {
    bandsMap.set(0, Math.min(0.5, (bandsMap.get(0) || 0) + 0.12));
    bandsMap.set(1, Math.min(0.5, (bandsMap.get(1) || 0) + 0.08));
    bandsMap.set(2, Math.min(0.5, (bandsMap.get(2) || 0) + 0.05));
  } else if (lvl === 2) {
    bandsMap.set(0, Math.min(0.5, (bandsMap.get(0) || 0) + 0.22));
    bandsMap.set(1, Math.min(0.5, (bandsMap.get(1) || 0) + 0.16));
    bandsMap.set(2, Math.min(0.5, (bandsMap.get(2) || 0) + 0.10));
    bandsMap.set(3, Math.min(0.5, (bandsMap.get(3) || 0) + 0.05));
  } else if (lvl >= 3) {
    bandsMap.set(0, Math.min(0.5, (bandsMap.get(0) || 0) + 0.32));
    bandsMap.set(1, Math.min(0.5, (bandsMap.get(1) || 0) + 0.24));
    bandsMap.set(2, Math.min(0.5, (bandsMap.get(2) || 0) + 0.16));
    bandsMap.set(3, Math.min(0.5, (bandsMap.get(3) || 0) + 0.08));
  }

  const result = [];
  for (const [band, gain] of bandsMap.entries()) {
    if (Math.abs(gain) > 0.001) {
      result.push({ band, gain: Math.round(gain * 100) / 100 });
    }
  }
  return result;
}

function createAudioFilterComponents(player, lang = 'id') {
  const curBass = player?.get ? (player.get('filter_bassboost') || 0) : 0;
  const isNightcore = player?.get ? Boolean(player.get('filter_nightcore')) : false;
  const isVaporwave = player?.get ? Boolean(player.get('filter_vaporwave')) : false;
  const is8D = player?.get ? Boolean(player.get('filter_8d')) : false;
  const isVocal = player?.get ? Boolean(player.get('filter_vocalboost')) : false;
  const curEq = player?.get ? (player.get('filter_eq') || 'flat') : 'flat';
  const crossfadeSec = player?.get ? (player.get('crossfade_seconds') || 0) : 0;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('music_filter_select')
    .setPlaceholder(lang === 'en' ? '🎛️ Select Audio Filter / Equalizer Preset...' : '🎛️ Pilih Filter Audio / Preset Equalizer...')
    .addOptions([
      {
        label: 'Flat / Original Sound',
        description: 'Matikan seluruh efek, kembalikan ke audio asli natural',
        value: 'filter_reset',
        emoji: '🔄',
        default: !curBass && !isNightcore && !isVaporwave && !is8D && !isVocal && curEq === 'flat'
      },
      {
        label: 'Bass Boost: Low (+20%)',
        description: 'Penambahan bass halus dan empuk untuk genre pop & lofi',
        value: 'filter_bassboost_1',
        emoji: '🔊',
        default: curBass === 1
      },
      {
        label: 'Bass Boost: Medium (+40%)',
        description: 'Dentuman bass bertenaga cocok untuk EDM & Hip-Hop',
        value: 'filter_bassboost_2',
        emoji: '🔊',
        default: curBass === 2
      },
      {
        label: 'Bass Boost: Extreme (+65%)',
        description: 'Sub-bass maksimal dengan hentakan ekstra nendang',
        value: 'filter_bassboost_3',
        emoji: '💥',
        default: curBass === 3
      },
      {
        label: 'Nightcore (Speed + Pitch 1.25x)',
        description: 'Tempo lebih cepat dan nada vokal lebih imut/tinggi',
        value: 'filter_nightcore',
        emoji: '🌙',
        default: isNightcore
      },
      {
        label: 'Vaporwave (Slowed + Reverb)',
        description: 'Tempo santai lambat dengan gema nostalgia retro 80s',
        value: 'filter_vaporwave',
        emoji: '🌊',
        default: isVaporwave
      },
      {
        label: '8D Spatial Audio (Surround 360°)',
        description: 'Audio memutar melingkar kiri-kanan (wajib pakai headphone)',
        value: 'filter_8d',
        emoji: '🎧',
        default: is8D
      },
      {
        label: 'Vocal Booster (Crisp Clarity)',
        description: 'Memperjelas vokal penyanyi & mengurangi dengung bass',
        value: 'filter_vocal',
        emoji: '🎤',
        default: isVocal
      },
      {
        label: 'Hi-Fi Studio Clarity',
        description: 'Mastering high-fidelity dengan treble jernih & vokal bersih',
        value: 'filter_hifi',
        emoji: '✨',
        default: curEq === 'hifi'
      },
      {
        label: 'Gaming & Spatial Sound',
        description: 'Separasi soundstage luas untuk mendengarkan di discord saat mabar',
        value: 'filter_gaming',
        emoji: '🎮',
        default: curEq === 'gaming'
      }
    ]);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('filter_crossfade_toggle')
      .setLabel(`Crossfade: ${crossfadeSec > 0 ? `${crossfadeSec}s (Gapless)` : 'OFF'}`)
      .setEmoji('🔀')
      .setStyle(crossfadeSec > 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('filter_reset_btn')
      .setLabel('Reset Normal')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('filter_vocal_toggle')
      .setLabel('Vocal Boost')
      .setEmoji('🎤')
      .setStyle(isVocal ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  return [row1, row2];
}

async function applyUnifiedAudioFilters(player) {
  if (!player) return;

  const bassboostLevel = player.get ? (player.get('filter_bassboost') || 0) : 0;
  const isNightcore = player.get ? Boolean(player.get('filter_nightcore')) : false;
  const isVaporwave = player.get ? Boolean(player.get('filter_vaporwave')) : false;
  const is8D = player.get ? Boolean(player.get('filter_8d')) : false;
  const isVocalBoost = player.get ? Boolean(player.get('filter_vocalboost')) : false;
  const eqPreset = isVocalBoost ? 'vocal' : (player.get ? (player.get('filter_eq') || 'flat') : 'flat');

  // Friendly active filter name determination
  let activeName = 'Normal';
  if (bassboostLevel > 0) {
    activeName = `Bass Boost (${bassboostLevel === 1 ? 'Low' : (bassboostLevel === 2 ? 'Medium' : 'Extreme')})`;
  } else if (isNightcore) {
    activeName = 'Nightcore';
  } else if (isVaporwave) {
    activeName = 'Vaporwave';
  } else if (is8D) {
    activeName = '8D Surround';
  } else if (isVocalBoost) {
    activeName = 'Vocal Booster';
  } else if (eqPreset && eqPreset !== 'flat') {
    activeName = `EQ: ${eqPreset.toUpperCase()}`;
  }
  if (player.set) player.set('filter_active_name', activeName);

  // 1. Native Voice Engine (FFmpeg direct transcode)
  if (player.manager && player.manager.client && player.manager.client.nativeVoice) {
    if (!player._filters) {
      player._filters = {};
    }
    player._filters.bassboost = bassboostLevel || null;
    player._filters.nightcore = isNightcore;
    player._filters.vaporwave = isVaporwave;
    player._filters.eightD = is8D;
    player._filters.eqPreset = eqPreset;
    player._filters.eq = getBandsForPreset(eqPreset, bassboostLevel);

    if (typeof player.applyFilter === 'function') {
      await player.applyFilter();
    }
    return;
  }

  // 2. Lavalink Client (Lavalink REST v4 audio filters)
  const filterData = {};

  if (isNightcore) {
    filterData.timescale = { speed: 1.25, pitch: 1.25, rate: 1.0 };
    if (player.filterManager?.filters) {
      player.filterManager.filters.nightcore = true;
      player.filterManager.filters.vaporwave = false;
    }
  } else if (isVaporwave) {
    filterData.timescale = { speed: 0.85, pitch: 0.80, rate: 1.0 };
    if (player.filterManager?.filters) {
      player.filterManager.filters.vaporwave = true;
      player.filterManager.filters.nightcore = false;
    }
  } else if (player.filterManager?.filters) {
    player.filterManager.filters.nightcore = false;
    player.filterManager.filters.vaporwave = false;
  }

  if (is8D) {
    filterData.rotation = { rotationHz: 0.20 };
    if (player.filterManager?.filters) {
      player.filterManager.filters.rotation = true;
    }
  } else if (player.filterManager?.filters) {
    player.filterManager.filters.rotation = false;
  }

  const eqBands = getBandsForPreset(eqPreset, bassboostLevel);
  if (eqBands && eqBands.length > 0) {
    filterData.equalizer = eqBands;
    if (player.filterManager) {
      player.filterManager.equalizerBands = eqBands;
    }
  }

  // Send single unified payload to Lavalink node
  if (player.node && typeof player.node.updatePlayer === 'function') {
    try {
      await player.node.updatePlayer({
        guildId: player.guildId,
        playerOptions: { filters: filterData }
      });
    } catch (err) {
      console.warn('[LAVALINK UNIFIED FILTER WARN]', err.message);
    }
  } else if (player.filterManager?.applyPlayerFilters) {
    if (player.filterManager.data) {
      player.filterManager.data.timescale = filterData.timescale;
      player.filterManager.data.rotation = filterData.rotation;
    }
    await player.filterManager.applyPlayerFilters().catch(() => {});
  }
}

/**
 * Main command execution engine
 */
async function handleMusicCommand(ctx, cmdName, args = {}, client, helpers) {
  const {
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
  } = helpers;

  const isInteraction = Boolean(ctx.isRepliable?.() || ctx.reply);
  const isSlash = Boolean(ctx.isChatInputCommand?.());
  const member = ctx.member;
  const guild = ctx.guild;
  const user = isInteraction ? (ctx.user || ctx.author) : (ctx.author || ctx.user);

  if (user) recordUserCommand(user);

  const lang = getLanguage(guild?.id, user?.id);

  // Comprehensive command alias dictionary
  const rawCommand = String(cmdName || '').toLowerCase().trim();
  const COMMAND_ALIASES = {
    // Now Playing
    'np': 'nowplaying',
    'nowplaying': 'nowplaying',
    'now_playing': 'nowplaying',
    'current': 'nowplaying',
    'playing': 'nowplaying',
    'song': 'nowplaying',

    // Play
    'p': 'play',
    'play': 'play',
    'pn': 'playnext',
    'playnext': 'playnext',
    'ps': 'playskip',
    'playskip': 'playskip',

    // Queue
    'q': 'queue',
    'queue': 'queue',
    'list': 'queue',

    // Skip & Control
    's': 'skip',
    'skip': 'skip',
    'next': 'skip',
    'fs': 'forceskip',
    'forceskip': 'forceskip',
    'voteskip': 'voteskip',
    'prev': 'previous',
    'previous': 'previous',
    'back': 'previous',
    'replay': 'replay',
    'restart': 'replay',

    // Pause & Resume
    'pause': 'pause',
    'resume': 'resume',
    'unpause': 'resume',
    'continue': 'resume',
    'stop': 'stop',

    // Voice
    'join': 'join',
    'connect': 'join',
    'summon': 'join',
    'leave': 'leave',
    'dc': 'leave',
    'disconnect': 'leave',

    // Audio & Volume
    'vol': 'volume',
    'volume': 'volume',
    'v': 'volume',
    'loop': 'loop',
    'repeat': 'loop',
    'lp': 'loop',
    'shuffle': 'shuffle',
    'shuff': 'shuffle',
    'sh': 'shuffle',
    'mix': 'shuffle',

    // Queue Management
    'clear': 'clearqueue',
    'clearqueue': 'clearqueue',
    'cq': 'clearqueue',
    'cls': 'clearqueue',
    'remove': 'remove',
    'rm': 'remove',
    'del': 'remove',
    'skipto': 'skipto',
    'move': 'move',
    'swap': 'swap',

    // Time Seek
    'seek': 'seek',
    'forward': 'forward',
    'fwd': 'forward',
    'ff': 'forward',
    'rewind': 'rewind',
    'rw': 'rewind',

    // Audio Filters & Effects
    'bb': 'bassboost',
    'bass': 'bassboost',
    'bassboost': 'bassboost',
    'nc': 'nightcore',
    'nightcore': 'nightcore',
    'vw': 'vaporwave',
    'vaporwave': 'vaporwave',
    '8d': '8d',
    '3d': '8d',
    'eq': 'equalizer',
    'equalizer': 'equalizer',
    'filter': 'filters',
    'filters': 'filters',
    'fx': 'filters',
    'effects': 'filters',
    'vocal': 'vocalboost',
    'vocalboost': 'vocalboost',
    'vb': 'vocalboost',
    'crossfade': 'crossfade',
    'fade': 'crossfade',
    'cf': 'crossfade',
    'resetfilter': 'resetfilter',
    'resetfilters': 'resetfilter',
    'rf': 'resetfilter',
    'clearfilter': 'resetfilter',

    // Features
    'autoplay': 'autoplay',
    'ap': 'autoplay',
    'auto': 'autoplay',
    '247': '247',
    '24/7': '247',
    'stay': '247',
    'grab': 'grab',
    'save': 'grab',
    'lyrics': 'lyrics',
    'lyric': 'lyrics',
    'ly': 'lyrics',
    'radio': 'radio',
    'playlist': 'playlist',
    'pl': 'playlist',
    'playlists': 'playlist',
    'customplaylist': 'playlist',
    'profile': 'profile',
    'user': 'profile',
    'me': 'profile',
    'ping': 'ping',
    'stats': 'stats',
    'botinfo': 'stats',
    'info': 'stats',
    'help': 'help',
    'h': 'help',
    'commands': 'help'
  };

  cmdName = COMMAND_ALIASES[rawCommand] || rawCommand;

  const reply = async (payload) => {
    try {
      if (isInteraction) {
        if (ctx.deferred || ctx.replied) {
          return await ctx.followUp({ ...payload, fetchReply: true }).catch(async () => {
            return await ctx.editReply({ ...payload, fetchReply: true });
          });
        }
        return await ctx.reply({ ...payload, fetchReply: true });
      } else {
        return await ctx.channel.send(payload);
      }
    } catch (err) {
      console.warn('[REPLY ERROR]', err.message);
      if (isInteraction) {
        try {
          return await ctx.followUp({ ...payload, fetchReply: true });
        } catch (e2) {}
      } else if (payload && payload.embeds && payload.embeds.length > 0) {
        try {
          const firstEmbed = payload.embeds[0];
          const text = firstEmbed.data?.description || firstEmbed.data?.title || '⚠️ [Embed cannot be sent: missing permissions]';
          return await ctx.channel.send({ content: text });
        } catch (e3) {}
      }
    }
  };

  const voiceChannel = member?.voice?.channel;
  let player = client.lavalink?.getPlayer(guild.id) || client.nativeVoice?.getPlayer(guild.id);

  // Commands that require the user to be in a voice channel
  const voiceRequiredCommands = [
    'play', 'playnext', 'playskip', 'search', 'radio',
    'skip', 'forceskip', 'voteskip', 'stop', 'pause', 'resume',
    'seek', 'forward', 'rewind', 'replay', 'previous',
    'volume', 'loop', 'shuffle', 'clearqueue', 'skipto', 'move', 'swap',
    'bassboost', 'nightcore', 'vaporwave', '8d', 'equalizer', 'resetfilter',
    'filters', 'effects', 'fx', 'vocalboost', 'vocal', 'crossfade',
    'autoplay', '247', 'join', 'leave'
  ];

  if (voiceRequiredCommands.includes(cmdName)) {
    if (!voiceChannel) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf43f5e)
            .setDescription(t('voice_required', lang))
        ]
      });
    }

    // Check if bot is already in another voice channel
    if (player && player.connected && player.voiceChannelId && player.voiceChannelId !== voiceChannel.id) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf59e0b)
            .setDescription(t('voice_diff_channel', lang))
        ]
      });
    }
  }

  // DJ and solo listener checks
  const isDJ = isUserDJ(member, guild.id);
  const nonBotsInVC = voiceChannel ? voiceChannel.members.filter(m => !m.user.bot) : [];
  const isSolo = nonBotsInVC.size <= 1;

  // Helper to get or create active player
  const getOrCreatePlayer = async () => {
    const connectedNodes = Array.from(client.lavalink.nodeManager.nodes.values()).filter(n => n.connected);
    if (player && !player.node && connectedNodes.length > 0) {
      console.log(`[LAVALINK AUTO TRANSITION] 🔄 Lavalink kembali online! Memindahkan player dari Native Engine ke Lavalink...`);
      const currentTrack = player.queue.current;
      const remainingTracks = [...player.queue.tracks];
      const textChannelId = player.textChannelId;
      const voiceChannelId = player.voiceChannelId;
      const repeatMode = player.repeatMode;
      const volume = player.volume;

      await player.destroy().catch(() => {});

      player = client.lavalink.createPlayer({
        guildId: guild.id,
        voiceChannelId: voiceChannelId || voiceChannel.id,
        textChannelId: textChannelId || ctx.channel.id,
        selfDeaf: true,
        volume: volume || 100
      });

      if (repeatMode === 'track') player.setRepeatMode('track');
      else if (repeatMode === 'queue') player.setRepeatMode('queue');

      if (currentTrack) {
        await player.queue.add(currentTrack);
      }
      if (remainingTracks.length > 0) {
        await player.queue.add(remainingTracks);
      }
    }

    if (!player) {
      if (connectedNodes.length > 0) {
        player = client.lavalink.createPlayer({
          guildId: guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: ctx.channel.id,
          selfDeaf: true,
          volume: 100
        });
      } else if (client.nativeVoice) {
        console.log(`[AUDIO ENGINE FALLBACK] 🎙️ Tidak ada Lavalink node aktif. Menggunakan Native Voice Engine (@discordjs/voice).`);
        player = client.nativeVoice.createPlayer({
          guildId: guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: ctx.channel.id,
          selfDeaf: true,
          volume: 100
        });
      } else {
        player = client.lavalink.createPlayer({
          guildId: guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: ctx.channel.id,
          selfDeaf: true,
          volume: 100
        });
      }
    }
    if (!player.connected) {
      // Purge any stale ghost connection in @discordjs/voice before connecting
      try {
        const { getVoiceConnection } = require('@discordjs/voice');
        const ghostConn = getVoiceConnection(guild.id);
        if (ghostConn && ghostConn.state?.status !== 'ready') {
          ghostConn.destroy();
        }
      } catch (e) {}
      await player.connect();
    }

    // Anti-Drag & Return to Origin Session State
    if (!player.sessionInitiatorId || (!player.playing && (!player.queue?.tracks || player.queue.tracks.length === 0))) {
      player.sessionInitiatorId = user.id;
      player.sessionInitiatorUsername = user.username;
      player.sessionInitiatorDisplayName = member?.displayName || user.globalName || user.username;
      player.sessionVoiceChannelId = voiceChannel.id;
      player.manualDisconnect = false;
      console.log(`[SESSION INIT] 🛡️ Sesi musik diatur untuk inisiator ${player.sessionInitiatorDisplayName} (${user.id}) di channel ${voiceChannel.name}`);
    } else {
      // Keep session voice channel updated
      player.sessionVoiceChannelId = voiceChannel.id;
    }

    // Optimize bitrate for absolute maximum audio quality
    try {
      if (voiceChannel && voiceChannel.editable) {
        const maxBitrate = guild.maximumBitrate || 96000;
        if (voiceChannel.bitrate < maxBitrate) {
          console.log(`[AUDIO QUALITY] 🔊 Mengoptimalkan bitrate voice channel "${voiceChannel.name}" ke maksimal: ${Math.round(maxBitrate / 1000)}kbps`);
          await voiceChannel.setBitrate(maxBitrate).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[AUDIO QUALITY OPTIMIZE ERR]', e.message);
    }

    return player;
  };

  // Commands requiring an active playing track or queue
  const requireActivePlayer = [
    'skip', 'forceskip', 'pause', 'resume', 'seek', 'forward', 'rewind', 'replay',
    'bassboost', 'nightcore', 'vaporwave', '8d', 'equalizer', 'resetfilter', 'grab',
    'nowplaying', 'np', 'shuffle'
  ];
  if (requireActivePlayer.includes(cmdName)) {
    if (!player || (!player.queue?.current && (!player.queue?.tracks || player.queue.tracks.length === 0))) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf59e0b)
            .setDescription(t('no_current_track', lang))
        ]
      });
    }
  }

  // ==================== 1. PLAY ====================
  if (cmdName === 'play') {
    const query = args.query;
    if (!query) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf43f5e)
            .setDescription(t('play_no_query', lang))
        ]
      });
    }

    player = await getOrCreatePlayer();

    let searchRes;

    // Check if query refers to a saved custom playlist first (if not a direct URL)
    if (!/^https?:\/\//i.test(query.trim()) && typeof getPlaylist === 'function') {
      const savedPl = getPlaylist(user.id, query.trim());
      if (savedPl && savedPl.tracks && savedPl.tracks.length > 0) {
        searchRes = {
          loadType: 'playlist',
          playlist: {
            title: savedPl.name,
            name: savedPl.name,
            artworkUrl: savedPl.tracks[0]?.artworkUrl || null
          },
          tracks: savedPl.tracks.map(t => (typeof createUniversalTrack === 'function' ? createUniversalTrack(t, user) : {
            ...t,
            requester: user,
            info: {
              title: t.title || 'Track',
              author: t.author || 'Artist',
              duration: t.duration || 180000,
              uri: t.uri || '',
              artworkUrl: t.artworkUrl || null,
              requester: user
            }
          }))
        };
      }
    }

    if (!searchRes) {
      try {
        searchRes = await safePlayerSearch(player, query, user);
      } catch (err) {
        return reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf43f5e)
              .setTitle(t('search_error', lang))
              .setDescription(t('search_error_desc', lang, { msg: err.message }))
          ]
        });
      }
    }

    if (!searchRes || !searchRes.tracks || searchRes.tracks.length === 0) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf59e0b)
            .setDescription(t('not_found', lang, { query }))
        ]
      });
    }

    if (searchRes.playlist || searchRes.loadType === 'playlist') {
      const plMeta = searchRes.playlist || { name: 'Playlist', artworkUrl: null };
      await player.queue.add(searchRes.tracks);
      recordPlaybackSession({ title: plMeta.name || plMeta.title || 'Playlist', duration: searchRes.tracks.length * 180000 }, user, guild, voiceChannel);
      if (!player.playing) {
        player._skipTrackStartNotification = Date.now() + 10000;
        if (player.set) player.set('skipTrackStartNotification', Date.now() + 10000);
        await player.play();
      }

      const playlistEmbed = new EmbedBuilder()
        .setColor(0x10b981)
        .setAuthor({ name: 'On Ao Music Studio', iconURL: client.user.displayAvatarURL() })
        .setTitle(t('playlist_added', lang))
        .setDescription(`**${plMeta.name || plMeta.title || 'Playlist'}**\n${t('playlist_tracks', lang, { count: searchRes.tracks.length })}\n⚡ *${lang === 'en' ? 'Fast playlist loading completed' : 'Playlist berhasil dimuat secara instan'}*`)
        .addFields(
          { name: t('requested_by', lang), value: user.username, inline: true },
          { name: t('channel', lang), value: voiceChannel.name, inline: true },
          { name: lang === 'en' ? 'Total Tracks' : 'Total Lagu', value: `🎶 ${searchRes.tracks.length} lagu`, inline: true }
        )
        .setTimestamp();

      if (plMeta.artworkUrl) {
        playlistEmbed.setThumbnail(plMeta.artworkUrl);
      }

      return reply({
        embeds: [playlistEmbed],
        components: createMusicControlButtons(player)
      });
    } else {
      const track = searchRes.tracks[0];
      await player.queue.add(track);
      recordPlaybackSession(track, user, guild, voiceChannel);
      if (!player.playing) {
        player._skipTrackStartNotification = Date.now() + 10000;
        if (player.set) player.set('skipTrackStartNotification', Date.now() + 10000);
        await player.play();
      }

      const embed = new EmbedBuilder()
        .setColor(0x10b981)
        .setAuthor({ name: 'On Ao Music Studio', iconURL: client.user.displayAvatarURL() })
        .setTitle(getTrackTitle(track))
        .setURL(getTrackUri(track))
        .setDescription(`${lang === 'en' ? 'Artist' : 'Artis'}: **${getTrackAuthor(track)}**\n${lang === 'en' ? 'Duration' : 'Durasi'}: \`${formatDuration(getTrackDuration(track))}\``)
        .addFields(
          { name: t('requested_by', lang), value: user.username, inline: true },
          { name: t('channel', lang), value: voiceChannel.name, inline: true },
          { name: t('queue_pos', lang), value: player.queue.tracks.length === 0 ? t('now_playing', lang) : `#${player.queue.tracks.length}`, inline: true }
        )
        .setTimestamp();

      const artwork = getTrackArtwork(track);
      if (artwork) embed.setThumbnail(artwork);

      return reply({
        embeds: [embed],
        components: createMusicControlButtons(player)
      });
    }
  }

  // ==================== 2. PLAYNEXT ====================
  if (cmdName === 'playnext') {
    const query = args.query;
    if (!query) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('play_no_query', lang))]
      });
    }

    player = await getOrCreatePlayer();
    let searchRes;
    try {
      searchRes = await safePlayerSearch(player, query, user);
    } catch (err) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('search_error_desc', lang, { msg: err.message }))]
      });
    }

    if (!searchRes || !searchRes.tracks || searchRes.tracks.length === 0) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('not_found', lang, { query }))]
      });
    }

    const track = searchRes.tracks[0];
    player.queue.tracks.unshift(track);
    recordPlaybackSession(track, user, guild, voiceChannel);

    if (!player.playing) {
      player._skipTrackStartNotification = Date.now() + 10000;
      if (player.set) player.set('skipTrackStartNotification', Date.now() + 10000);
      await player.play();
    }

    const artwork = getTrackArtwork(track);
    const nextEmbed = new EmbedBuilder()
      .setColor(0x10b981)
      .setAuthor({ name: 'On Ao Music Studio', iconURL: client.user.displayAvatarURL() })
      .setTitle(t('playnext_added', lang, { title: getTrackTitle(track) }))
      .setURL(getTrackUri(track))
      .setDescription(`${lang === 'en' ? 'Artist' : 'Artis'}: **${getTrackAuthor(track)}**\n${lang === 'en' ? 'Duration' : 'Durasi'}: \`${formatDuration(getTrackDuration(track))}\``)
      .addFields(
        { name: t('requested_by', lang), value: user.username, inline: true },
        { name: t('channel', lang), value: voiceChannel.name, inline: true },
        { name: t('queue_pos', lang), value: '#1 (Next)', inline: true }
      )
      .setTimestamp();
    if (artwork) nextEmbed.setThumbnail(artwork);

    return reply({
      embeds: [nextEmbed],
      components: createMusicControlButtons(player)
    });
  }

  // ==================== 3. PLAYSKIP ====================
  if (cmdName === 'playskip') {
    const query = args.query;
    if (!query) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('play_no_query', lang))]
      });
    }

    player = await getOrCreatePlayer();
    let searchRes;
    try {
      searchRes = await safePlayerSearch(player, query, user);
    } catch (err) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('search_error_desc', lang, { msg: err.message }))]
      });
    }

    if (!searchRes || !searchRes.tracks || searchRes.tracks.length === 0) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('not_found', lang, { query }))]
      });
    }

    const track = searchRes.tracks[0];
    player.queue.tracks.unshift(track);
    recordPlaybackSession(track, user, guild, voiceChannel);

    if (player.playing) {
      player._skipTrackStartNotification = Date.now() + 10000;
      if (player.set) player.set('skipTrackStartNotification', Date.now() + 10000);
      await player.skip();
    } else {
      player._skipTrackStartNotification = Date.now() + 10000;
      if (player.set) player.set('skipTrackStartNotification', Date.now() + 10000);
      await player.play();
    }

    const artwork = getTrackArtwork(track);
    const skipEmbed = new EmbedBuilder()
      .setColor(0x10b981)
      .setAuthor({ name: 'On Ao Music Studio', iconURL: client.user.displayAvatarURL() })
      .setTitle(t('playskip_success', lang, { title: getTrackTitle(track) }))
      .setURL(getTrackUri(track))
      .setDescription(`${lang === 'en' ? 'Artist' : 'Artis'}: **${getTrackAuthor(track)}**\n${lang === 'en' ? 'Duration' : 'Durasi'}: \`${formatDuration(getTrackDuration(track))}\``)
      .addFields(
        { name: t('requested_by', lang), value: user.username, inline: true },
        { name: t('channel', lang), value: voiceChannel.name, inline: true },
        { name: t('queue_pos', lang), value: t('now_playing', lang), inline: true }
      )
      .setTimestamp();
    if (artwork) skipEmbed.setThumbnail(artwork);

    return reply({
      embeds: [skipEmbed],
      components: createMusicControlButtons(player)
    });
  }

  // ==================== 4. SEARCH ====================
  if (cmdName === 'search') {
    const query = args.query;
    if (!query) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('play_no_query', lang))]
      });
    }

    player = await getOrCreatePlayer();
    let searchRes;
    try {
      searchRes = await safePlayerSearch(player, query, user);
    } catch (err) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('search_error_desc', lang, { msg: err.message }))]
      });
    }

    if (!searchRes || !searchRes.tracks || searchRes.tracks.length === 0) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('not_found', lang, { query }))]
      });
    }

    const tracks = searchRes.tracks.slice(0, 10);
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('search_track_picker')
      .setPlaceholder(lang === 'en' ? 'Choose a track to play...' : 'Pilih lagu yang ingin diputar...')
      .addOptions(
        tracks.map((tr, idx) => ({
          label: `${idx + 1}. ${getTrackTitle(tr)}`.slice(0, 100),
          description: `${getTrackAuthor(tr)} • ${formatDuration(getTrackDuration(tr))}`.slice(0, 100),
          value: String(idx)
        }))
      );

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle(t('search_select_title', lang))
      .setDescription(`${t('search_select_desc', lang)}\n\n` + tracks.map((tr, i) => `**${i + 1}.** [${getTrackTitle(tr)}](${getTrackUri(tr)}) - \`${formatDuration(getTrackDuration(tr))}\``).join('\n'));

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const sentMsg = await reply({ embeds: [embed], components: [row] });

    // Attach interaction collector
    const collector = sentMsg?.createMessageComponentCollector?.({
      componentType: ComponentType.StringSelect,
      time: 60000,
      filter: (i) => i.user.id === user.id
    });

    if (collector) {
      collector.on('collect', async (i) => {
        const selectedIndex = parseInt(i.values[0], 10);
        const selectedTrack = tracks[selectedIndex];
        if (selectedTrack) {
          await player.queue.add(selectedTrack);
          recordPlaybackSession(selectedTrack, user, guild, voiceChannel);
          if (!player.playing) {
            player._skipTrackStartNotification = Date.now() + 10000;
            if (player.set) player.set('skipTrackStartNotification', Date.now() + 10000);
            await player.play();
          }

          await i.update({
            content: null,
            embeds: [
              new EmbedBuilder()
                .setColor(0x10b981)
                .setDescription(`🎵 **${lang === 'en' ? 'Track Queued' : 'Ditambahkan ke Antrian'}:** [${getTrackTitle(selectedTrack)}](${getTrackUri(selectedTrack)})`)
            ],
            components: []
          });
        }
      });

      collector.on('end', async (_collected, reason) => {
        if (reason === 'time') {
          try {
            await sentMsg.edit({ components: [] });
          } catch (e) {}
        }
      });
    }
    return;
  }

  // ==================== 5. SKIP & FORCESKIP & VOTESKIP ====================
  if (cmdName === 'skip' || cmdName === 'forceskip' || cmdName === 'voteskip') {
    const settings = getGuildSettings(guild.id);
    const djModeActive = settings.djMode;

    const currentTrack = player.queue.current;
    const isAutoplayActive = Boolean(player.get('autoplay'));

    if (cmdName === 'forceskip') {
      if (!isDJ && !isSolo) {
        return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
      }
      const res = typeof handleControllerSkipWithAutoplay === 'function'
        ? await handleControllerSkipWithAutoplay(player, currentTrack, isAutoplayActive)
        : { success: true, newTrack: null, isAutoplay: false };
      const trackName = res.newTrack ? `**${getTrackTitle(res.newTrack)}**` : null;
      const skipDesc = isAutoplayActive && trackName
        ? (lang === 'en' ? `⏭️ **Skipped!** Now playing Autoplay recommendation: ${trackName}` : `⏭️ **Lagu dilewati!** Memutar rekomendasi Autoplay: ${trackName}`)
        : t('skipped', lang);
      return reply({ embeds: [new EmbedBuilder().setColor(0x38bdf8).setDescription(skipDesc)] });
    }

    if (cmdName === 'voteskip' || (cmdName === 'skip' && djModeActive && !isDJ && !isSolo)) {
      const required = Math.max(1, Math.ceil(nonBotsInVC.size / 2));
      const votes = player.get('voteskip') || new Set();

      votes.add(user.id);
      player.set('voteskip', votes);

      if (votes.size >= required) {
        player.set('voteskip', new Set());
        const res = typeof handleControllerSkipWithAutoplay === 'function'
          ? await handleControllerSkipWithAutoplay(player, currentTrack, isAutoplayActive)
          : { success: true, newTrack: null, isAutoplay: false };
        const trackName = res.newTrack ? `**${getTrackTitle(res.newTrack)}**` : null;
        const skipDesc = isAutoplayActive && trackName
          ? (lang === 'en' ? `⏭️ **Skipped!** Now playing Autoplay recommendation: ${trackName}` : `⏭️ **Lagu dilewati!** Memutar rekomendasi Autoplay: ${trackName}`)
          : t('voteskip_success', lang, { required });
        return reply({
          embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(skipDesc)]
        });
      } else {
        return reply({
          embeds: [new EmbedBuilder().setColor(0x38bdf8).setDescription(t('voteskip_voted', lang, { user: user.username, current: votes.size, required }))]
        });
      }
    }

    // Standard skip
    const res = typeof handleControllerSkipWithAutoplay === 'function'
      ? await handleControllerSkipWithAutoplay(player, currentTrack, isAutoplayActive)
      : { success: true, newTrack: null, isAutoplay: false };
    const trackName = res.newTrack ? `**${getTrackTitle(res.newTrack)}**` : null;
    const skipDesc = isAutoplayActive && trackName
      ? (lang === 'en' ? `⏭️ **Skipped!** Now playing Autoplay recommendation: ${trackName}` : `⏭️ **Lagu dilewati!** Memutar rekomendasi Autoplay: ${trackName}`)
      : t('skipped', lang);

    return reply({
      embeds: [new EmbedBuilder().setColor(0x38bdf8).setDescription(skipDesc)]
    });
  }

  // ==================== 6. STOP ====================
  if (cmdName === 'stop') {
    // Anti-Disconnect Protection: Only the session initiator who started 'on play' can stop,
    // unless the initiator has already left the voice channel or caller is alone with bot.
    const initiatorId = player.sessionInitiatorId;
    const initiatorInVoice = initiatorId && voiceChannel?.members ? voiceChannel.members.has(initiatorId) : false;
    const isInitiator = !initiatorId || user.id === initiatorId;

    if (!isInitiator && initiatorInVoice && !isSolo) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf43f5e)
            .setTitle(lang === 'en' ? '🛡️ Anti-Disconnect Guard' : '🛡️ Anti-Disconnect Guard Aktif')
            .setDescription(t('anti_disconnect_blocked', lang, { initiator: initiatorId }))
        ]
      });
    }

    if (!isDJ && !isSolo && !isInitiator) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
    }

    // Authorized manual stop by initiator
    player.manualDisconnect = true;
    player.sessionInitiatorId = null;
    player.queue.tracks = [];
    await player.stopPlaying(true, false);
    if (player.connected) await player.disconnect();

    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf43f5e)
          .setDescription(t('stopped', lang))
      ]
    });
  }

  // ==================== 7. PAUSE & RESUME ====================
  if (cmdName === 'pause') {
    if (player.paused) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('already_paused', lang))] });
    }
    await player.pause();
    return reply({
      embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('paused', lang))]
    });
  }

  if (cmdName === 'resume') {
    if (!player.paused) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('not_paused', lang))] });
    }
    await player.resume();
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('resumed', lang))]
    });
  }

  // ==================== 8. QUEUE (Paginated) ====================
  if (cmdName === 'queue') {
    const current = player?.queue?.current;
    const upcoming = player?.queue?.tracks || [];

    if (!current && upcoming.length === 0) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('queue_empty', lang))] });
    }

    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(upcoming.length / pageSize));
    let currentPage = 1;

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
          .map((t, idx) => `**${startIdx + idx + 1}.** [${getTrackTitle(t)}](${getTrackUri(t)}) - \`${formatDuration(getTrackDuration(t))}\``)
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

    const queueMessage = await reply({
      embeds: [buildQueueEmbed(currentPage)],
      components: totalPages > 1 || upcoming.length > 0 ? [buildQueueButtons(currentPage)] : []
    });

    if (queueMessage?.createMessageComponentCollector) {
      const collector = queueMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000
      });

      collector.on('collect', async (btnInt) => {
        try {
          if (btnInt.customId === 'q_first') currentPage = 1;
          else if (btnInt.customId === 'q_prev') currentPage = Math.max(1, currentPage - 1);
          else if (btnInt.customId === 'q_next') currentPage = Math.min(totalPages, currentPage + 1);
          else if (btnInt.customId === 'q_last') currentPage = totalPages;
          else if (btnInt.customId === 'q_clear') {
            const initiatorId = player.sessionInitiatorId;
            const btnVcMembers = btnInt.member?.voice?.channel?.members;
            const initiatorInVoice = initiatorId && btnVcMembers ? btnVcMembers.has(initiatorId) : false;
            const isInitiator = !initiatorId || btnInt.user.id === initiatorId;

            if (!isInitiator && initiatorInVoice && !isSolo) {
              return btnInt.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor(0xf43f5e)
                    .setDescription(t('queue_initiator_only_clear', lang, { initiator: initiatorId }))
                ],
                ephemeral: true
              });
            }

            if (!isUserDJ(btnInt.member, guild.id) && !isSolo && !isInitiator) {
              return btnInt.reply({ content: t('dj_only', lang), ephemeral: true });
            }
            const count = player.queue.tracks.length;
            player.queue.tracks = [];
            if (typeof syncPlayerState === 'function') syncPlayerState(player);
            if (typeof syncAllGuildsState === 'function') syncAllGuildsState(botClient);

            const clearedEmbed = new EmbedBuilder().setColor(0x10b981).setDescription(t('queue_cleared', lang, { count }));
            if (btnInt.deferred || btnInt.replied) {
              await btnInt.editReply({ embeds: [clearedEmbed], components: [] });
            } else {
              await btnInt.update({ embeds: [clearedEmbed], components: [] });
            }
            return;
          }

          if (btnInt.deferred || btnInt.replied) {
            await btnInt.editReply({
              embeds: [buildQueueEmbed(currentPage)],
              components: [buildQueueButtons(currentPage)]
            });
          } else {
            await btnInt.update({
              embeds: [buildQueueEmbed(currentPage)],
              components: [buildQueueButtons(currentPage)]
            });
          }
        } catch (err) {
          console.warn('[QUEUE COLLECTOR ERR]', err.message);
          try {
            await btnInt.message.edit({
              embeds: [buildQueueEmbed(currentPage)],
              components: [buildQueueButtons(currentPage)]
            });
          } catch (e2) {}
        }
      });

      collector.on('end', async () => {
        try {
          await queueMessage.edit({ components: [] });
        } catch (e) {}
      });
    }
    return;
  }

  // ==================== 9. CLEARQUEUE ====================
  if (cmdName === 'clearqueue') {
    const initiatorId = player.sessionInitiatorId;
    const initiatorInVoice = initiatorId && voiceChannel?.members ? voiceChannel.members.has(initiatorId) : false;
    const isInitiator = !initiatorId || user.id === initiatorId;

    if (!isInitiator && initiatorInVoice && !isSolo) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf43f5e)
            .setDescription(t('queue_initiator_only_clear', lang, { initiator: initiatorId }))
        ]
      });
    }

    if (!isDJ && !isSolo && !isInitiator) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
    }
    const count = player.queue.tracks.length;
    player.queue.tracks = [];
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('queue_cleared', lang, { count }))]
    });
  }

  // ==================== 10. REMOVE ====================
  if (cmdName === 'remove') {
    const initiatorId = player.sessionInitiatorId;
    const initiatorInVoice = initiatorId && voiceChannel?.members ? voiceChannel.members.has(initiatorId) : false;
    const isInitiator = !initiatorId || user.id === initiatorId;

    const tracks = player.queue.tracks || [];
    if (!tracks.length) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(lang === 'en' ? '⚠️ The queue is currently empty!' : '⚠️ Antrean lagu saat ini sedang kosong!')]
      });
    }

    let rawInput = (args.position !== undefined && args.position !== null ? String(args.position) : '') ||
                   (args.query || args.subcommand || (args.rawArgs ? args.rawArgs.join(' ') : '') || '').trim();

    if (!rawInput) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b82f6)
            .setTitle(lang === 'en' ? '🗑️ Remove Track from Queue' : '🗑️ Hapus Lagu dari Antrean')
            .setDescription(
              lang === 'en'
                ? `**Usage:** \`on remove <position | range | song name>\`\n\n**Examples:**\n• \`on remove 2\` (removes song #2)\n• \`on remove 2-5\` or \`on remove 2 5\` (removes songs 2 to 5)\n• \`on remove ${getTrackTitle(tracks[0]).slice(0, 20)}\` (removes by title)\n• \`on remove last\` (removes the last song)`
                : `**Format:** \`on remove <urutan | rentang | judul lagu>\`\n\n**Contoh:**\n• \`on remove 2\` (menghapus antrean ke-2)\n• \`on remove 2-5\` atau \`on remove 2 5\` (menghapus urutan 2 s/d 5)\n• \`on remove ${getTrackTitle(tracks[0]).slice(0, 20)}\` (menghapus berdasarkan judul)\n• \`on remove last\` (menghapus lagu paling terakhir)`
            )
        ]
      });
    }

    const checkPerms = (trackToCheck = null) => {
      if (isDJ || isSolo || isInitiator) return true;
      if (trackToCheck && trackToCheck.requester && (trackToCheck.requester.id === user.id || trackToCheck.requester === user.id)) {
        return true;
      }
      return false;
    };

    // Case 1: 'last' or 'akhir'
    if (rawInput.toLowerCase() === 'last' || rawInput.toLowerCase() === 'akhir') {
      const targetIndex = tracks.length - 1;
      const targetTrack = tracks[targetIndex];
      if (!checkPerms(targetTrack)) {
        if (!isInitiator && initiatorInVoice && !isSolo) {
          return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('queue_initiator_only_remove', lang, { initiator: initiatorId }))] });
        }
        return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
      }

      let removed;
      if (typeof player.queue.remove === 'function') {
        const res = await player.queue.remove(targetIndex);
        removed = (res && res.removed && res.removed[0]) ? res.removed[0] : targetTrack;
      } else {
        removed = tracks.splice(targetIndex, 1)[0];
      }

      if (typeof syncPlayerState === 'function') syncPlayerState(player);
      if (typeof syncAllGuildsState === 'function') syncAllGuildsState(botClient);
      return reply({
        embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(`🗑️ ${lang === 'en' ? 'Removed last track' : 'Dihapus lagu terakhir'}: **${getTrackTitle(removed || targetTrack)}**`)]
      });
    }

    // Case 2: Range (e.g. 2-5, 2 to 5, 2 5)
    const rangeMatch = rawInput.match(/^(\d+)\s*(?:-|to|\s+)\s*(\d+)$/i);
    if (rangeMatch) {
      if (!checkPerms()) {
        if (!isInitiator && initiatorInVoice && !isSolo) {
          return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('queue_initiator_only_remove', lang, { initiator: initiatorId }))] });
        }
        return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
      }

      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) [start, end] = [end, start];

      if (start < 1 || end > tracks.length) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('skipto_invalid', lang, { max: tracks.length }))]
        });
      }

      const count = end - start + 1;
      const indicesToRemove = [];
      for (let i = start - 1; i < end; i++) indicesToRemove.push(i);

      if (typeof player.queue.remove === 'function') {
        await player.queue.remove(indicesToRemove);
      } else {
        tracks.splice(start - 1, count);
      }

      if (typeof syncPlayerState === 'function') syncPlayerState(player);
      if (typeof syncAllGuildsState === 'function') syncAllGuildsState(botClient);
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setDescription(`🗑️ ${lang === 'en' ? `Removed **${count}** tracks (positions #${start} - #${end}) from queue` : `Berhasil menghapus **${count}** lagu (urutan #${start} - #${end}) dari antrean`}`)
        ]
      });
    }

    // Case 3: Single number index (e.g. 2)
    const singleNum = parseInt(rawInput, 10);
    if (!isNaN(singleNum) && /^\d+$/.test(rawInput)) {
      if (singleNum < 1 || singleNum > tracks.length) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('skipto_invalid', lang, { max: tracks.length }))]
        });
      }

      const targetIndex = singleNum - 1;
      const targetTrack = tracks[targetIndex];

      if (!checkPerms(targetTrack)) {
        if (!isInitiator && initiatorInVoice && !isSolo) {
          return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('queue_initiator_only_remove', lang, { initiator: initiatorId }))] });
        }
        return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
      }

      let removed;
      if (typeof player.queue.remove === 'function') {
        const res = await player.queue.remove(targetIndex);
        removed = (res && res.removed && res.removed[0]) ? res.removed[0] : targetTrack;
      } else {
        removed = tracks.splice(targetIndex, 1)[0];
      }

      if (typeof syncPlayerState === 'function') syncPlayerState(player);
      if (typeof syncAllGuildsState === 'function') syncAllGuildsState(botClient);
      return reply({
        embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(`🗑️ ${lang === 'en' ? 'Removed' : 'Dihapus'} (#${singleNum}): **${getTrackTitle(removed || targetTrack)}**`)]
      });
    }

    // Case 4: Search by title / keyword
    const searchLow = rawInput.toLowerCase();
    const foundIndex = tracks.findIndex(t => {
      const title = String(getTrackTitle(t) || '').toLowerCase();
      const author = String(getTrackAuthor(t) || '').toLowerCase();
      return title.includes(searchLow) || author.includes(searchLow);
    });

    if (foundIndex === -1) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf43f5e)
            .setDescription(
              lang === 'en'
                ? `❌ No track matching **"${rawInput}"** found in the queue!`
                : `❌ Tidak ditemukan lagu yang cocok dengan **"${rawInput}"** di dalam antrean!`
            )
        ]
      });
    }

    const targetTrack = tracks[foundIndex];
    if (!checkPerms(targetTrack)) {
      if (!isInitiator && initiatorInVoice && !isSolo) {
        return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('queue_initiator_only_remove', lang, { initiator: initiatorId }))] });
      }
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
    }

    let removed;
    if (typeof player.queue.remove === 'function') {
      const res = await player.queue.remove(foundIndex);
      removed = (res && res.removed && res.removed[0]) ? res.removed[0] : targetTrack;
    } else {
      removed = tracks.splice(foundIndex, 1)[0];
    }

    if (typeof syncPlayerState === 'function') syncPlayerState(player);
    if (typeof syncAllGuildsState === 'function') syncAllGuildsState(botClient);
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(`🗑️ ${lang === 'en' ? 'Removed' : 'Dihapus'} (#${foundIndex + 1}): **${getTrackTitle(removed || targetTrack)}**`)]
    });
  }

  // ==================== 11. SKIPTO ====================
  if (cmdName === 'skipto') {
    if (!isDJ && !isSolo) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
    }
    const rawPos = args.position !== undefined && args.position !== null ? args.position : (args.query || args.subcommand || (args.rawArgs && args.rawArgs[0]));
    const pos = parseInt(rawPos, 10);
    const tracks = player.queue.tracks || [];
    if (isNaN(pos) || pos < 1 || pos > tracks.length) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('skipto_invalid', lang, { max: tracks.length }))]
      });
    }
    const targetTrack = tracks[pos - 1];
    player.queue.tracks.splice(0, pos - 1);
    await player.skip();
    if (typeof syncPlayerState === 'function') syncPlayerState(player);
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('skipto_success', lang, { pos, title: getTrackTitle(targetTrack) }))]
    });
  }

  // ==================== 12. MOVE ====================
  if (cmdName === 'move') {
    if (!isDJ && !isSolo) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
    }
    const tokens = (args.query || '').split(/\s+/).filter(Boolean);
    const from = parseInt(args.from !== undefined ? args.from : (args.subArg1 || (args.rawArgs && args.rawArgs[0]) || tokens[0]), 10);
    const to = parseInt(args.to !== undefined ? args.to : (args.subArg2 || (args.rawArgs && args.rawArgs[1]) || tokens[1]), 10);
    const tracks = player.queue.tracks || [];
    if (isNaN(from) || isNaN(to) || from < 1 || to < 1 || from > tracks.length || to > tracks.length) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('move_invalid', lang))] });
    }
    const [target] = player.queue.tracks.splice(from - 1, 1);
    player.queue.tracks.splice(to - 1, 0, target);
    if (typeof syncPlayerState === 'function') syncPlayerState(player);
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('move_success', lang, { from, to }))]
    });
  }

  // ==================== 13. SWAP ====================
  if (cmdName === 'swap') {
    if (!isDJ && !isSolo) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
    }
    const tokens = (args.query || '').split(/\s+/).filter(Boolean);
    const pos1 = parseInt(args.pos1 !== undefined ? args.pos1 : (args.subArg1 || (args.rawArgs && args.rawArgs[0]) || tokens[0]), 10);
    const pos2 = parseInt(args.pos2 !== undefined ? args.pos2 : (args.subArg2 || (args.rawArgs && args.rawArgs[1]) || tokens[1]), 10);
    const tracks = player.queue.tracks || [];
    if (isNaN(pos1) || isNaN(pos2) || pos1 < 1 || pos2 < 1 || pos1 > tracks.length || pos2 > tracks.length) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('swap_invalid', lang))] });
    }
    const temp = tracks[pos1 - 1];
    tracks[pos1 - 1] = tracks[pos2 - 1];
    tracks[pos2 - 1] = temp;
    if (typeof syncPlayerState === 'function') syncPlayerState(player);
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('swap_success', lang, { pos1, pos2 }))]
    });
  }

  // ==================== 14. LOOP ====================
  if (cmdName === 'loop') {
    const currentMode = player.repeatMode || 'off';
    let nextMode = 'track';

    const inputMode = (args.mode || args.query || args.subcommand || (args.rawArgs && args.rawArgs[0]) || '').toLowerCase().trim();
    if (inputMode && ['off', 'track', 'queue'].includes(inputMode)) {
      nextMode = inputMode;
    } else {
      if (currentMode === 'track') nextMode = 'queue';
      else if (currentMode === 'queue') nextMode = 'off';
    }

    player.setRepeatMode(nextMode);
    const modeLabel = nextMode === 'track' ? t('loop_track', lang) : nextMode === 'queue' ? t('loop_queue', lang) : t('loop_off', lang);
    if (typeof syncPlayerState === 'function') syncPlayerState(player);

    return reply({
      embeds: [new EmbedBuilder().setColor(0x8b5cf6).setDescription(t('loop_status', lang, { mode: modeLabel }))]
    });
  }

  // ==================== 15. VOLUME ====================
  if (cmdName === 'volume') {
    const rawLevel = args.level !== undefined && args.level !== null ? args.level : (args.query || args.subcommand || (args.rawArgs && args.rawArgs[0]));
    if (!rawLevel) {
      const slider = createProgressBar(player.volume, 100, 10);
      return reply({
        embeds: [new EmbedBuilder().setColor(0x6366f1).setDescription(t('volume_current', lang, { slider, level: player.volume }))]
      });
    }

    if (!isDJ && !isSolo) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
    }

    const vol = parseInt(rawLevel, 10);
    if (isNaN(vol) || vol < 1 || vol > 100) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription('❌ Volume must be 1-100.')]
      });
    }

    await player.setVolume(vol);
    if (typeof syncPlayerState === 'function') syncPlayerState(player);
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('volume_set', lang, { level: vol }))]
    });
  }

  // ==================== 16. SHUFFLE ====================
  if (cmdName === 'shuffle') {
    if (!player?.queue?.tracks || player.queue.tracks.length < 2) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(lang === 'en' ? '⚠️ At least 2 tracks needed to shuffle!' : '⚠️ Minimal perlu 2 lagu untuk diacak!')]
      });
    }
    player.queue.shuffle();
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('shuffled', lang, { count: player.queue.tracks.length }))]
    });
  }

  // ==================== 17. NOW PLAYING ====================
  if (cmdName === 'nowplaying' || cmdName === 'np') {
    const track = player?.queue?.current;
    if (!track) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('no_current_track', lang))] });
    }

    const durMs = getTrackDuration(track);

    const buildNpEmbed = (currentPosMs, activeP = player) => {
      const bar = createProgressBar(currentPosMs, durMs, 10);
      const isPaused = Boolean(activeP?.paused);
      const emb = new EmbedBuilder()
        .setColor(isPaused ? 0xf59e0b : 0x10b981)
        .setAuthor({ name: 'On Ao Music Studio', iconURL: client.user.displayAvatarURL() })
        .setTitle(isPaused ? `Sedang Dijeda ⏸️` : `Sedang Diputar 🎵`)
        .setDescription(`**[${getTrackTitle(track)}](${getTrackUri(track)})**\n${lang === 'en' ? 'Artist' : 'Artis'}: **${getTrackAuthor(track)}**`)
        .addFields(
          { name: 'Progress', value: bar },
          { name: 'Volume', value: `${activeP?.volume || 100}%`, inline: true },
          { name: 'Loop', value: (activeP?.repeatMode || 'off').toUpperCase(), inline: true },
          { name: lang === 'en' ? 'Remaining Queue' : 'Sisa Antrian', value: `${activeP?.queue?.tracks?.length || 0} ${lang === 'en' ? 'songs' : 'lagu'}`, inline: true }
        )
        .setTimestamp();

      const artwork = getTrackArtwork(track);
      if (artwork && typeof artwork === 'string' && artwork.startsWith('http')) {
        emb.setThumbnail(artwork);
      }
      return emb;
    };

    const initialPos = player?.position || 0;
    const sentMsg = await reply({
      embeds: [buildNpEmbed(initialPos, player)],
      components: createMusicControlButtons(player)
    });

    if (sentMsg) {
      // Dynamic real-time moving progress bar
      if (global._npUpdaters && global._npUpdaters.has(guild.id)) {
        clearInterval(global._npUpdaters.get(guild.id));
      }
      if (!global._npUpdaters) global._npUpdaters = new Map();

      const initialTrackUri = getTrackUri(track);
      let editCount = 0;
      const MAX_EDITS = 60; // 3 minutes of continuous live movement

      const updaterTimer = setInterval(async () => {
        try {
          editCount++;
          const curPlayer = client.lavalink?.getPlayer(guild.id) || client.nativeVoice?.getPlayer(guild.id);
          const curTrack = curPlayer?.queue?.current;

          if (!curPlayer || !curTrack || getTrackUri(curTrack) !== initialTrackUri || editCount >= MAX_EDITS) {
            clearInterval(updaterTimer);
            global._npUpdaters.delete(guild.id);
            return;
          }

          const currentLivePos = curPlayer.position || 0;
          const updatedEmbed = buildNpEmbed(currentLivePos, curPlayer);

          if (isSlash && ctx.editReply) {
            await ctx.editReply({ embeds: [updatedEmbed], components: createMusicControlButtons(curPlayer) }).catch(() => {
              clearInterval(updaterTimer);
            });
          } else if (sentMsg.edit) {
            await sentMsg.edit({ embeds: [updatedEmbed], components: createMusicControlButtons(curPlayer) }).catch(() => {
              clearInterval(updaterTimer);
            });
          }
        } catch (e) {
          clearInterval(updaterTimer);
          global._npUpdaters.delete(guild.id);
        }
      }, 3000);

      global._npUpdaters.set(guild.id, updaterTimer);
    }

    return sentMsg;
  }

  // ==================== 18. SEEK & FORWARD & REWIND ====================
  if (cmdName === 'seek') {
    let rawSec = args.seconds !== undefined && args.seconds !== null ? args.seconds : (args.query || args.subcommand || (args.rawArgs ? args.rawArgs.join(' ') : ''));
    if (rawSec === undefined || rawSec === null || String(rawSec).trim() === '') {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(lang === 'en' ? '❌ Please specify time in seconds, MM:SS, or 1m30s (e.g. `on seek 30` or `on seek 1:30`)' : '❌ Harap tentukan waktu dalam detik, MM:SS, atau 1m30s (contoh: `on seek 30` atau `on seek 1:30`)')] });
    }

    const parseTimeToSeconds = (inputStr) => {
      const clean = String(inputStr).trim().toLowerCase();
      if (!clean) return NaN;

      // 1. Matches formats like 1h30m20s, 1h 30m 20s, 1h, 30m, 20s, 1m30s, etc.
      let totalSeconds = 0;
      let matched = false;

      const hourMatch = clean.match(/(\d+)\s*h/);
      const minMatch = clean.match(/(\d+)\s*m/);
      const secMatch = clean.match(/(\d+)\s*s/);

      if (hourMatch || minMatch || secMatch) {
        if (hourMatch) { totalSeconds += parseInt(hourMatch[1], 10) * 3600; matched = true; }
        if (minMatch) { totalSeconds += parseInt(minMatch[1], 10) * 60; matched = true; }
        if (secMatch) { totalSeconds += parseInt(secMatch[1], 10); matched = true; }
        if (matched) return totalSeconds;
      }

      // 2. Matches HH:MM:SS
      if (/^\d+:\d+:\d+$/.test(clean)) {
        const parts = clean.split(':').map(Number);
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }

      // 3. Matches MM:SS or M:SS
      if (/^\d+:\d+$/.test(clean)) {
        const parts = clean.split(':').map(Number);
        return parts[0] * 60 + parts[1];
      }

      // 4. Pure number
      if (/^\d+$/.test(clean)) {
        return parseInt(clean, 10);
      }

      return NaN;
    };

    const sec = parseTimeToSeconds(rawSec);

    if (isNaN(sec) || sec < 0) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription('❌ Invalid seconds or format. Example: `on seek 30`, `on seek 1:30`, or `on seek 1m30s`')] });
    }

    const curTrack = player.queue.current;
    const maxDurSec = curTrack ? Math.floor(getTrackDuration(curTrack) / 1000) : 86400;
    if (maxDurSec > 0 && sec > maxDurSec) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(`❌ Seek time exceed track duration (${formatDuration(maxDurSec * 1000)}).`)] });
    }

    player.position = sec * 1000;
    await player.seek(sec * 1000);
    if (typeof syncPlayerState === 'function') {
      try { syncPlayerState(player); } catch (e) {}
    }
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('seek_success', lang, { time: formatDuration(sec * 1000) }))]
    });
  }

  if (cmdName === 'forward') {
    const rawVal = args.seconds !== undefined && args.seconds !== null ? args.seconds : (args.query || args.subcommand || (args.rawArgs && args.rawArgs[0]));
    const sec = parseInt(rawVal || 15, 10);
    const curPos = player.position || 0;
    const curTrack = player.queue.current;
    const maxDur = curTrack ? getTrackDuration(curTrack) : 86400000;
    const newPos = Math.min(maxDur, curPos + (sec * 1000));
    player.position = newPos;
    await player.seek(newPos);
    if (typeof syncPlayerState === 'function') {
      try { syncPlayerState(player); } catch (e) {}
    }
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('forward_success', lang, { seconds: sec, pos: formatDuration(newPos) }))]
    });
  }

  if (cmdName === 'rewind') {
    const rawVal = args.seconds !== undefined && args.seconds !== null ? args.seconds : (args.query || args.subcommand || (args.rawArgs && args.rawArgs[0]));
    const sec = parseInt(rawVal || 15, 10);
    const curPos = player.position || 0;
    const newPos = Math.max(0, curPos - (sec * 1000));
    player.position = newPos;
    await player.seek(newPos);
    if (typeof syncPlayerState === 'function') {
      try { syncPlayerState(player); } catch (e) {}
    }
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('rewind_success', lang, { seconds: sec, pos: formatDuration(newPos) }))]
    });
  }

  // ==================== 19. REPLAY & PREVIOUS ====================
  if (cmdName === 'replay') {
    player.position = 0;
    await player.seek(0);
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('replay_success', lang))]
    });
  }

  if (cmdName === 'previous') {
    const history = player.get('history') || [];
    if (history.length === 0) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('previous_empty', lang))] });
    }
    const prevTrack = history.shift();
    player.set('history', history);
    player.queue.tracks.unshift(prevTrack);
    await player.skip();
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('previous_success', lang, { title: getTrackTitle(prevTrack) }))]
    });
  }

  // ==================== 20. GRAB ====================
  if (cmdName === 'grab') {
    const track = player.queue.current;
    if (!track) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('no_current_track', lang))] });
    }

    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x6366f1)
        .setTitle(`🎵 ${getTrackTitle(track)}`)
        .setURL(getTrackUri(track))
        .setDescription(`**${lang === 'en' ? 'Artist' : 'Artis'}:** ${getTrackAuthor(track)}\n**${lang === 'en' ? 'Duration' : 'Durasi'}:** \`${formatDuration(getTrackDuration(track))}\`\n**${lang === 'en' ? 'Played In' : 'Diputar Di'}:** ${guild.name}`)
        .setFooter({ text: 'Saved via On Ao Music Studio' })
        .setTimestamp();

      const artwork = getTrackArtwork(track);
      if (artwork) dmEmbed.setThumbnail(artwork);

      await user.send({ embeds: [dmEmbed] });
      return reply({
        embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('grab_sent', lang))]
      });
    } catch (e) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('grab_fail', lang))]
      });
    }
  }

  // ==================== 21. RADIO ====================
  if (cmdName === 'radio') {
    const stationKey = (args.station || 'lofi').toLowerCase().trim();
    const station = RADIO_STATIONS[stationKey] || RADIO_STATIONS.lofi;

    player = await getOrCreatePlayer();

    // Clear upcoming queue for seamless stream
    player.queue.tracks = [];

    let searchRes;
    try {
      searchRes = await player.search({ query: station.url, source: undefined }, user);
    } catch (e) {}

    if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
      const radioTrack = searchRes.tracks[0];
      radioTrack.info.title = station.name;
      await player.queue.add(radioTrack);
      player._skipTrackStartNotification = Date.now() + 10000;
      if (player.set) player.set('skipTrackStartNotification', Date.now() + 10000);
      if (player.playing) await player.skip();
      else await player.play();
    } else {
      // Fallback to youtube lofi stream search
      const fb = await safePlayerSearch(player, `${station.name} live stream`, user);
      if (fb && fb.tracks && fb.tracks.length > 0) {
        await player.queue.add(fb.tracks[0]);
        player._skipTrackStartNotification = Date.now() + 10000;
        if (player.set) player.set('skipTrackStartNotification', Date.now() + 10000);
        if (player.playing) await player.skip();
        else await player.play();
      }
    }

    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x10b981)
          .setTitle('📻 24/7 Live Radio Streaming')
          .setDescription(t('radio_playing', lang, { station: station.name }))
          .addFields({ name: 'Genre', value: station.desc, inline: true })
      ]
    });
  }

  // ==================== 22. JOIN & LEAVE ====================
  if (cmdName === 'join') {
    player = await getOrCreatePlayer();
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('join_success', lang, { channel: voiceChannel.name }))]
    });
  }

  if (cmdName === 'leave') {
    if (player) {
      // Anti-Disconnect Protection: Only session initiator who ran 'on play' can disconnect the bot
      const initiatorId = player.sessionInitiatorId;
      const initiatorInVoice = initiatorId && voiceChannel?.members ? voiceChannel.members.has(initiatorId) : false;
      const isInitiator = !initiatorId || user.id === initiatorId;

      if (!isInitiator && initiatorInVoice && !isSolo) {
        return reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf43f5e)
              .setTitle(lang === 'en' ? '🛡️ Anti-Disconnect Guard' : '🛡️ Anti-Disconnect Guard Aktif')
              .setDescription(t('anti_disconnect_blocked', lang, { initiator: initiatorId }))
          ]
        });
      }

      player.manualDisconnect = true;
      player.sessionInitiatorId = null;
      player.queue.tracks = [];
      await player.destroy();
    }
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('leave_success', lang))]
    });
  }

  // ==================== 23. DJ & SETDJ ====================
  if (cmdName === 'dj') {
    const action = (args.action || 'status').toLowerCase();
    const settings = getGuildSettings(guild.id);

    if (action === 'toggle') {
      if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
      }
      const newStatus = !settings.djMode;
      updateGuildSettings(guild.id, { djMode: newStatus });
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setDescription(t('dj_mode_toggled', lang, { status: newStatus ? 'ACTIVE 🟢' : 'DISABLED 🔴' }))
        ]
      });
    }

    const roleName = settings.djRoleId ? `<@&${settings.djRoleId}>` : (lang === 'en' ? 'None (Admin Only)' : 'Belum Ditentukan');
    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6366f1)
          .setTitle('🎧 Sistem & Konfigurasi DJ')
          .setDescription(`Status Mode DJ: **${settings.djMode ? 'AKTIF 🟢' : 'NON-AKTIF ⚪'}**\nRole DJ Terdaftar: **${roleName}**`)
          .addFields(
            { name: '💡 Cara Mengatur Role DJ', value: 'Gunakan `/setdj role:@NamaRole` atau `on setdj @NamaRole` (Administrator).' },
            { name: '⚡ Toggle Mode DJ', value: 'Gunakan `/dj action:toggle` atau `on dj toggle`.' }
          )
      ]
    });
  }

  if (cmdName === 'setdj') {
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('dj_only', lang))] });
    }
    const role = args.role || ctx.mentions?.roles?.first();
    if (!role) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription('❌ Please mention a valid role: `on setdj @Role`')] });
    }

    updateGuildSettings(guild.id, { djRoleId: role.id, djMode: true });
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('dj_set', lang, { role: role.name }))]
    });
  }

  // ==================== 24. AUDIO FILTERS ====================
  if (cmdName === 'bassboost') {
    const rawVal = args.level !== undefined && args.level !== null ? args.level : (args.query || args.subcommand || (args.rawArgs && args.rawArgs[0]) || (args._ && args._[0]) || 2);
    const rawLevel = parseInt(rawVal, 10);
    const level = (rawLevel >= 1 && rawLevel <= 3) ? rawLevel : 2;
    try {
      if (player.set) player.set('filter_bassboost', level);
      await applyUnifiedAudioFilters(player);
    } catch (e) {
      console.warn('[BASSBOOST FILTER WARN]', e.message);
    }
    return reply({
      embeds: [new EmbedBuilder().setColor(0x8b5cf6).setDescription(`🔊 **Bassboost Level ${level}** ${lang === 'en' ? 'Applied!' : 'Diterapkan!'} (Tingkat 1 - 3)`)]
    });
  }

  if (cmdName === 'nightcore') {
    const currentNightcore = player.get ? Boolean(player.get('filter_nightcore')) : false;
    const newState = !currentNightcore;
    try {
      if (player.set) {
        player.set('filter_nightcore', newState);
        if (newState) player.set('filter_vaporwave', false);
      }
      await applyUnifiedAudioFilters(player);
    } catch (e) {
      console.warn('[NIGHTCORE FILTER WARN]', e.message);
    }
    return reply({
      embeds: [new EmbedBuilder().setColor(0x8b5cf6).setDescription(`🌙 Nightcore: **${newState ? 'AKTIF ⚡ (Speed & Pitch +25%)' : 'NONAKTIF (Normal)'}**`)]
    });
  }

  if (cmdName === 'vaporwave') {
    const currentVaporwave = player.get ? Boolean(player.get('filter_vaporwave')) : false;
    const newState = !currentVaporwave;
    try {
      if (player.set) {
        player.set('filter_vaporwave', newState);
        if (newState) player.set('filter_nightcore', false);
      }
      await applyUnifiedAudioFilters(player);
    } catch (e) {
      console.warn('[VAPORWAVE FILTER WARN]', e.message);
    }
    return reply({
      embeds: [new EmbedBuilder().setColor(0x8b5cf6).setDescription(`🌴 Vaporwave: **${newState ? 'AKTIF ☕ (Slowed & Reverb Vibe)' : 'NONAKTIF (Normal)'}**`)]
    });
  }

  if (cmdName === '8d') {
    const current8D = player.get ? Boolean(player.get('filter_8d')) : false;
    const newState = !current8D;
    try {
      if (player.set) player.set('filter_8d', newState);
      await applyUnifiedAudioFilters(player);
    } catch (e) {
      console.warn('[8D FILTER WARN]', e.message);
    }
    return reply({
      embeds: [new EmbedBuilder().setColor(0x8b5cf6).setDescription(`🎧 8D Surround Audio: **${newState ? 'AKTIF 🌀 (Rotasi Suara 360°)' : 'NONAKTIF'}**`)]
    });
  }

  if (cmdName === 'equalizer') {
    const rawPreset = String(args.preset || args.query || args.subcommand || (args.rawArgs && args.rawArgs[0]) || (args._ && args._[0]) || 'hifi').toLowerCase().trim();
    const presetsMap = {
      hifi: 'hifi',
      studio: 'studio',
      bass: 'deep bass',
      'deep bass': 'deep bass',
      deepbass: 'deep bass',
      deep: 'deep bass',
      gaming: 'gaming',
      game: 'gaming',
      treble: 'treble',
      vocal: 'vocal',
      vocalboost: 'vocal',
      flat: 'flat'
    };
    const activePresetName = presetsMap[rawPreset] || 'hifi';

    try {
      if (player.set) {
        player.set('filter_eq', activePresetName);
        if (activePresetName === 'vocal') player.set('filter_vocalboost', true);
        else player.set('filter_vocalboost', false);
      }
      await applyUnifiedAudioFilters(player);
    } catch (e) {
      console.warn('[EQUALIZER FILTER WARN]', e.message);
    }

    return reply({
      embeds: [new EmbedBuilder().setColor(0x8b5cf6).setDescription(`🎚️ **Equalizer Preset Diterapkan:** \`${activePresetName.toUpperCase()}\` (Pilihan: \`hifi\`, \`studio\`, \`deep bass\`, \`gaming\`, \`treble\`, \`vocal\`, \`flat\`)`)]
    });
  }

  // ==================== 24B. INTERACTIVE FILTERS MENU ====================
  if (cmdName === 'filters' || cmdName === 'effects' || cmdName === 'fx') {
    const curBass = player.get ? (player.get('filter_bassboost') || 0) : 0;
    const isNightcore = player.get ? Boolean(player.get('filter_nightcore')) : false;
    const isVaporwave = player.get ? Boolean(player.get('filter_vaporwave')) : false;
    const is8D = player.get ? Boolean(player.get('filter_8d')) : false;
    const isVocal = player.get ? Boolean(player.get('filter_vocalboost')) : false;
    const curEq = player.get ? (player.get('filter_eq') || 'flat') : 'flat';
    const crossfadeSec = player.get ? (player.get('crossfade_seconds') || 0) : 0;

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setAuthor({ name: 'On Ao Audio Studio FX & Equalizer', iconURL: client.user.displayAvatarURL() })
      .setTitle('🎛️ Equalizer & Lavalink Real-Time Filters')
      .setDescription('Pilih filter audio di menu pilihan bawah untuk mengubah karakter suara musik secara langsung (real-time tanpa jeda).')
      .addFields(
        {
          name: '🔊 Bass Boost',
          value: curBass ? `**Tingkat ${curBass}** (${curBass === 1 ? 'Low +20%' : curBass === 2 ? 'Medium +40%' : 'Extreme +65%'})` : '`OFF (Normal)`',
          inline: true
        },
        {
          name: '🌙 Nightcore',
          value: isNightcore ? '**AKTIF ⚡ (Speed & Pitch +25%)**' : '`OFF`',
          inline: true
        },
        {
          name: '🌊 Vaporwave',
          value: isVaporwave ? '**AKTIF ☕ (Slowed & Reverb)**' : '`OFF`',
          inline: true
        },
        {
          name: '🎧 8D Spatial Audio',
          value: is8D ? '**AKTIF 🌀 (Rotasi Suara 360°)**' : '`OFF`',
          inline: true
        },
        {
          name: '🎤 Vocal Booster',
          value: isVocal ? '**AKTIF ✨ (Vokal Jernih & Crispy)**' : '`OFF`',
          inline: true
        },
        {
          name: '🎚️ EQ Preset',
          value: `\`${curEq.toUpperCase()}\``,
          inline: true
        },
        {
          name: '🔀 Crossfade / Gapless',
          value: crossfadeSec > 0 ? `**${crossfadeSec} Detik** (Transisi Halus Tanpa Silence Gap)` : '`OFF`',
          inline: true
        },
        {
          name: '⚡ Status Node',
          value: player.node?.options?.id ? `Connected (${player.node.options.id})` : 'Connected',
          inline: true
        }
      )
      .setFooter({ text: 'On Ao Music Studio • Real-Time Audio DSP Engine', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    return reply({
      embeds: [embed],
      components: createAudioFilterComponents(player, lang)
    });
  }

  // ==================== 24C. VOCAL BOOSTER COMMAND ====================
  if (cmdName === 'vocalboost' || cmdName === 'vocal') {
    const cur = player.get ? Boolean(player.get('filter_vocalboost')) : false;
    const next = !cur;
    try {
      if (player.set) {
        player.set('filter_vocalboost', next);
        if (next) player.set('filter_eq', 'vocal');
        else if (player.get('filter_eq') === 'vocal') player.set('filter_eq', 'flat');
      }
      await applyUnifiedAudioFilters(player);
    } catch (e) {
      console.warn('[VOCAL BOOST FILTER WARN]', e.message);
    }
    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setDescription(`🎤 Vocal Booster: **${next ? 'AKTIF ✨ (Vokal Penyanyi Diperjelas & Mid-Treble Ditingkatkan)' : 'NONAKTIF (Normal)'}**`)
      ]
    });
  }

  // ==================== 24D. CROSSFADE / GAPLESS PLAYBACK ====================
  if (cmdName === 'crossfade') {
    const rawVal = args.seconds !== undefined && args.seconds !== null ? args.seconds : (args.query || args.subcommand || (args.rawArgs && args.rawArgs[0]) || (args._ && args._[0]));
    const rawSec = parseInt(rawVal, 10);
    let newSec = isNaN(rawSec) ? (player.get && player.get('crossfade_seconds') ? 0 : 1) : rawSec;
    if (newSec < 0) newSec = 0;
    if (newSec > 5) newSec = 5;

    if (player.set) {
      player.set('crossfade_seconds', newSec);
    }

    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x10b981)
          .setTitle('🔀 Transisi Antar Lagu (Crossfade / Gapless Playback)')
          .setDescription(
            newSec > 0
              ? `✅ **Crossfade diatur ke ${newSec} detik.**\nSaat lagu berganti, musik akan bertransisi halus tanpa ada jeda sunyi (*silence gap*) kaku!`
              : '⏹️ **Crossfade dinonaktifkan.** Lagu berganti normal.'
          )
      ]
    });
  }

  if (cmdName === 'resetfilter') {
    try {
      if (player.set) {
        player.set('filter_bassboost', null);
        player.set('filter_nightcore', false);
        player.set('filter_vaporwave', false);
        player.set('filter_8d', false);
        player.set('filter_vocalboost', false);
        player.set('filter_eq', 'flat');
      }
      await applyUnifiedAudioFilters(player);
    } catch (e) {
      console.warn('[RESET FILTER WARN]', e.message);
    }
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription('🔄 Semua efek dan filter audio telah direset ke suara standar/flat.')]
    });
  }

  // ==================== 25. AUTOPLAY & 24/7 ====================
  if (cmdName === 'autoplay') {
    const cur = player ? Boolean(player.get('autoplay')) : false;
    const next = !cur;
    if (player) {
      player.set('autoplay', next);
      if (typeof syncPlayerState === 'function') syncPlayerState(player);
      if (next && (!player.queue.tracks || player.queue.tracks.length === 0) && player.queue.current) {
        if (typeof fetchAutoplayRecommendation === 'function') {
          fetchAutoplayRecommendation(player, player.queue.current).then(rec => {
            if (rec && player.get('autoplay') && (!player.queue.tracks || player.queue.tracks.length === 0)) {
              player.queue.add(rec);
              console.log(`[AUTOPLAY] 📻 Pre-buffered recommendation in queue: "${getTrackTitle(rec)}" by ${getTrackAuthor(rec)}`);
              if (typeof syncPlayerState === 'function') syncPlayerState(player);
            }
          }).catch(() => {});
        }
      }
    }
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(next ? t('autoplay_enabled', lang) : t('autoplay_disabled', lang))]
    });
  }

  if (cmdName === '247') {
    const cur = player ? Boolean(player.get('is247')) : false;
    const next = !cur;
    if (player) player.set('is247', next);
    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(next ? t('mode_247_enabled', lang) : t('mode_247_disabled', lang))]
    });
  }

  // ==================== 25.5. PLAYLIST (CUSTOM USER/GUILD PLAYLISTS) ====================
  if (cmdName === 'playlist') {
    const rawQuery = (args.query || '').trim();
    const queryTokens = rawQuery ? rawQuery.split(/\s+/) : [];

    let sub = (args.subcommand || args.action || queryTokens[0] || '').toLowerCase().trim();
    let plName = (args.name || queryTokens[1] || '').trim();
    let subArg = (args.song || args.item || queryTokens.slice(2).join(' ') || '').trim();

    // If only one token is provided and it's not a known subcommand keyword, treat it as view or play if playlist exists
    const knownSubs = ['create', 'buat', 'save', 'simpan', 'load', 'play', 'putar', 'add', 'tambah', 'remove', 'hapus', 'del', 'delete', 'view', 'lihat', 'info', 'list', 'daftar', 'help', 'bantuan'];
    if (!sub || sub === 'list' || sub === 'daftar') {
      const userPlaylists = getUserPlaylists(user.id);
      if (userPlaylists.length === 0) {
        return reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x6366f1)
              .setAuthor({ name: 'On Ao Playlist Studio', iconURL: client.user.displayAvatarURL() })
              .setTitle(lang === 'en' ? '📂 Custom Playlists' : '📂 Daftar Playlist Tersimpan')
              .setDescription(lang === 'en'
                ? `You don't have any saved playlists yet!\n\n**Quick Start:**\n• Save current queue: \`on playlist save <name>\`\n• Create new playlist: \`on playlist create <name>\`\n• Play external link: \`on play <Spotify/YouTube playlist URL>\``
                : `Kamu belum memiliki playlist tersimpan!\n\n**Cara Cepat:**\n• Simpan antrean saat ini: \`on playlist save <nama>\`\n• Buat playlist baru: \`on playlist create <nama>\`\n• Putar link eksternal: \`on play <link Spotify/YouTube playlist>\``
              )
              .setFooter({ text: 'On Ao Music Studio • on playlist help' })
          ]
        });
      }

      const listFields = userPlaylists.map((p, idx) => ({
        name: `${idx + 1}. 📑 ${p.name}`,
        value: `${lang === 'en' ? 'Tracks' : 'Total Lagu'}: **${p.trackCount}** | \`on playlist play ${p.name}\``,
        inline: false
      }));

      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setAuthor({ name: 'On Ao Playlist Studio', iconURL: client.user.displayAvatarURL() })
            .setTitle(lang === 'en' ? `📂 Your Saved Playlists (${userPlaylists.length})` : `📂 Daftar Playlist Kamu (${userPlaylists.length})`)
            .setDescription(lang === 'en' ? 'Here are all your saved personal playlists:' : 'Berikut adalah playlist musik yang telah kamu simpan:')
            .addFields(listFields)
            .setFooter({ text: 'Gunakan on playlist play <nama> untuk memutar playlist' })
        ]
      });
    }

    // Auto-detect if user typed `on playlist MyFavorites` without subcommand keyword
    if (!knownSubs.includes(sub) && queryTokens.length > 0) {
      plName = rawQuery;
      sub = 'view';
    }

    // 1. CREATE SUBCOMMAND
    if (sub === 'create' || sub === 'buat') {
      if (!plName) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(lang === 'en' ? '❌ Please provide a playlist name! Example: `on playlist create My Rock Hits`' : '❌ Harap masukkan nama playlist! Contoh: `on playlist create Lagu Santai`')]
        });
      }

      const created = createPlaylist(user.id, plName, []);
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setTitle(lang === 'en' ? '✅ Playlist Created' : '✅ Playlist Berhasil Dibuat')
            .setDescription(lang === 'en' ? `Playlist **${plName}** has been created! Add songs using \`on playlist add ${plName} <song>\`.` : `Playlist **${plName}** telah berhasil dibuat! Tambahkan lagu dengan \`on playlist add ${plName} <judul lagu>\`.`)
        ]
      });
    }

    // 2. SAVE ACTIVE QUEUE TO PLAYLIST
    if (sub === 'save' || sub === 'simpan') {
      if (!plName) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(lang === 'en' ? '❌ Please provide a playlist name to save to! Example: `on playlist save CurrentParty`' : '❌ Masukkan nama playlist untuk disimpan! Contoh: `on playlist save LaguNongkrong`')]
        });
      }

      if (!player || (!player.queue?.current && (!player.queue?.tracks || player.queue.tracks.length === 0))) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(lang === 'en' ? '⚠️ There are no active tracks playing or in queue to save.' : '⚠️ Tidak ada lagu yang sedang diputar atau dalam antrean untuk disimpan.')]
        });
      }

      const allTracks = [];
      if (player.queue.current) allTracks.push(player.queue.current);
      if (player.queue.tracks) allTracks.push(...player.queue.tracks);

      createPlaylist(user.id, plName, allTracks);

      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setAuthor({ name: 'On Ao Playlist Studio', iconURL: client.user.displayAvatarURL() })
            .setTitle(lang === 'en' ? '💾 Queue Saved to Playlist' : '💾 Antrean Berhasil Disimpan ke Playlist')
            .setDescription(lang === 'en'
              ? `Saved **${allTracks.length} tracks** into playlist **${plName}**!\nPlay it anytime with \`on playlist play ${plName}\`.`
              : `Berhasil menyimpan **${allTracks.length} lagu** ke dalam playlist **${plName}**!\nPutar kapan saja dengan \`on playlist play ${plName}\`.`
            )
        ]
      });
    }

    // 3. PLAY / LOAD SUBCOMMAND
    if (sub === 'play' || sub === 'load' || sub === 'putar') {
      const targetName = plName || subArg;
      if (!targetName) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(lang === 'en' ? '❌ Please provide the playlist name to play! Example: `on playlist play MyFavorites`' : '❌ Masukkan nama playlist yang ingin diputar! Contoh: `on playlist play LaguSantai`')]
        });
      }

      // Check voice channel
      if (!voiceChannel) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('voice_required', lang))]
        });
      }

      const pl = getPlaylist(user.id, targetName);
      if (!pl || !pl.tracks || pl.tracks.length === 0) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(lang === 'en' ? `⚠️ Playlist **${targetName}** not found or is empty!` : `⚠️ Playlist **${targetName}** tidak ditemukan atau masih kosong!`)]
        });
      }

      player = await getOrCreatePlayer();

      const tracksToQueue = pl.tracks.map(t => (typeof createUniversalTrack === 'function' ? createUniversalTrack(t, user) : {
        ...t,
        requester: user,
        info: {
          title: t.title || 'Track',
          author: t.author || 'Artist',
          duration: t.duration || 180000,
          uri: t.uri || '',
          artworkUrl: t.artworkUrl || null,
          requester: user
        }
      }));

      await player.queue.add(tracksToQueue);
      recordPlaybackSession({ title: pl.name, duration: pl.tracks.length * 180000 }, user, guild, voiceChannel);

      if (!player.playing) {
        player._skipTrackStartNotification = Date.now() + 10000;
        if (player.set) player.set('skipTrackStartNotification', Date.now() + 10000);
        await player.play();
      }

      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setAuthor({ name: 'On Ao Music Studio', iconURL: client.user.displayAvatarURL() })
            .setTitle(t('playlist_added', lang))
            .setDescription(`**${pl.name}**\n${t('playlist_tracks', lang, { count: pl.tracks.length })}\n⚡ *${lang === 'en' ? 'Loaded from your saved playlists' : 'Dimuat dari playlist tersimpan kamu'}*`)
            .addFields(
              { name: t('requested_by', lang), value: user.username, inline: true },
              { name: t('channel', lang), value: voiceChannel.name, inline: true },
              { name: lang === 'en' ? 'Total Tracks' : 'Total Lagu', value: `🎶 ${pl.tracks.length} lagu`, inline: true }
            )
            .setTimestamp()
        ],
        components: createMusicControlButtons(player)
      });
    }

    // 4. ADD TRACK TO PLAYLIST
    if (sub === 'add' || sub === 'tambah') {
      if (!plName || !subArg) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(lang === 'en' ? '❌ Usage: `on playlist add <playlist_name> <song_name_or_url>`' : '❌ Penggunaan: `on playlist add <nama_playlist> <judul_lagu_atau_link>`')]
        });
      }

      const pl = getPlaylist(user.id, plName);
      if (!pl) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(lang === 'en' ? `⚠️ Playlist **${plName}** does not exist. Create it first using \`on playlist create ${plName}\`.` : `⚠️ Playlist **${plName}** belum ada. Buat terlebih dahulu dengan \`on playlist create ${plName}\`.`)]
        });
      }

      let foundTrack = null;
      try {
        const dummyPlayer = player || client.lavalink?.getPlayer(guild.id) || client.nativeVoice?.getPlayer(guild.id) || client.nativeVoice;
        const searchRes = await safePlayerSearch(dummyPlayer, subArg, user);
        if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
          foundTrack = searchRes.tracks[0];
        }
      } catch (e) {}

      if (!foundTrack) {
        foundTrack = {
          title: subArg,
          author: 'Unknown Artist',
          duration: 180000,
          uri: /^https?:\/\//i.test(subArg) ? subArg : '',
          artworkUrl: null
        };
      }

      addTrackToPlaylist(user.id, pl.name, foundTrack);

      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setTitle(lang === 'en' ? '✅ Track Added to Playlist' : '✅ Lagu Berhasil Ditambahkan')
            .setDescription(lang === 'en'
              ? `Added **${getTrackTitle(foundTrack)}** to playlist **${pl.name}**!`
              : `Berhasil menambahkan **${getTrackTitle(foundTrack)}** ke playlist **${pl.name}**!`
            )
        ]
      });
    }

    // 5. REMOVE TRACK FROM PLAYLIST
    if (sub === 'remove' || sub === 'hapus' || sub === 'deltrack') {
      if (!plName || !subArg) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(lang === 'en' ? '❌ Usage: `on playlist remove <playlist_name> <track_number_or_title>`' : '❌ Penggunaan: `on playlist remove <nama_playlist> <nomor_atau_judul_lagu>`')]
        });
      }

      const removed = removeTrackFromPlaylist(user.id, plName, subArg);
      if (!removed) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(lang === 'en' ? `⚠️ Could not find track "${subArg}" in playlist **${plName}**.` : `⚠️ Lagu "${subArg}" tidak ditemukan di playlist **${plName}**.`)]
        });
      }

      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setDescription(lang === 'en'
              ? `🗑️ Removed **${removed.title}** from playlist **${plName}**.`
              : `🗑️ Berhasil menghapus **${removed.title}** dari playlist **${plName}**.`
            )
        ]
      });
    }

    // 6. VIEW / INFO PLAYLIST
    if (sub === 'view' || sub === 'info' || sub === 'lihat' || sub === 'show') {
      const targetName = plName || subArg || queryTokens.join(' ');
      const pl = getPlaylist(user.id, targetName);
      if (!pl) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(lang === 'en' ? `⚠️ Playlist **${targetName}** not found!` : `⚠️ Playlist **${targetName}** tidak ditemukan!`)]
        });
      }

      if (!pl.tracks || pl.tracks.length === 0) {
        return reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x6366f1)
              .setTitle(`📑 Playlist: ${pl.name}`)
              .setDescription(lang === 'en' ? 'This playlist is empty. Add songs using `on playlist add <name> <song>`!' : 'Playlist ini masih kosong. Tambahkan lagu dengan `on playlist add <nama> <lagu>`!')
          ]
        });
      }

      const trackListPreview = pl.tracks.slice(0, 15).map((t, idx) => `\`${idx + 1}.\` **${t.title}** - *${t.author}* (\`${formatDuration(t.duration || 180000)}\`)`).join('\n');
      const overflow = pl.tracks.length > 15 ? `\n*...dan ${pl.tracks.length - 15} lagu lainnya.*` : '';

      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x6366f1)
            .setAuthor({ name: 'On Ao Playlist Studio', iconURL: client.user.displayAvatarURL() })
            .setTitle(`📑 Playlist: ${pl.name} (${pl.tracks.length} ${lang === 'en' ? 'tracks' : 'lagu'})`)
            .setDescription(`${trackListPreview}${overflow}\n\n▶️ *Ketik \`on playlist play ${pl.name}\` untuk memutar.*`)
            .setFooter({ text: 'On Ao Music Studio' })
        ]
      });
    }

    // 7. DELETE PLAYLIST
    if (sub === 'delete' || sub === 'del' || sub === 'hapus_pl') {
      if (!plName) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(lang === 'en' ? '❌ Please provide the playlist name to delete!' : '❌ Harap masukkan nama playlist yang ingin dihapus!')]
        });
      }

      const deleted = deletePlaylist(user.id, plName);
      if (!deleted) {
        return reply({
          embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(lang === 'en' ? `⚠️ Playlist **${plName}** not found.` : `⚠️ Playlist **${plName}** tidak ditemukan.`)]
        });
      }

      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setDescription(lang === 'en' ? `🗑️ Playlist **${plName}** has been deleted.` : `🗑️ Playlist **${plName}** berhasil dihapus.`)
        ]
      });
    }

    // 8. HELP GUIDE
    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6366f1)
          .setAuthor({ name: 'On Ao Playlist Studio', iconURL: client.user.displayAvatarURL() })
          .setTitle(lang === 'en' ? '📑 On Ao Playlist Commands Guide' : '📑 Panduan Lengkap Perintah Playlist On Ao')
          .setDescription(lang === 'en'
            ? `• \`on playlist list\` - View your saved playlists\n• \`on playlist create <name>\` - Create a new empty playlist\n• \`on playlist save <name>\` - Save the active music queue to a playlist\n• \`on playlist play <name>\` - Play a saved playlist in voice channel\n• \`on playlist add <name> <song/url>\` - Add a song to a playlist\n• \`on playlist remove <name> <index>\` - Remove a song from a playlist\n• \`on playlist view <name>\` - View songs inside a playlist\n• \`on playlist delete <name>\` - Delete a saved playlist\n• \`on play <URL>\` - Directly plays Spotify, YouTube, or SoundCloud playlist links!`
            : `• \`on playlist list\` - Lihat daftar playlist tersimpan kamu\n• \`on playlist create <nama>\` - Buat playlist baru\n• \`on playlist save <nama>\` - Simpan antrean musik yang sedang diputar ke playlist\n• \`on playlist play <nama>\` - Putar playlist tersimpan di voice channel\n• \`on playlist add <nama> <lagu/link>\` - Tambah lagu ke playlist\n• \`on playlist remove <nama> <nomor/judul>\` - Hapus lagu dari playlist\n• \`on playlist view <nama>\` - Lihat daftar lagu dalam playlist\n• \`on playlist delete <nama>\` - Hapus playlist tersimpan\n• \`on play <link>\` - Langsung putar link playlist Spotify, YouTube, atau SoundCloud!`
          )
          .setFooter({ text: 'On Ao Music Studio' })
      ]
    });
  }

  // ==================== 26. PROFILE & SETPROFILE ====================
  if (cmdName === 'profile' || cmdName === 'setprofile') {
    const rawQuery = (args.query || '').trim();
    const queryTokens = rawQuery ? rawQuery.split(/\s+/) : [];

    let sub = (args.subcommand || args.action || queryTokens[0] || '').toLowerCase().trim();
    let rawVal = (args.value || args.subArg1 || queryTokens[1] || '').trim();
    let rawVal2 = (args.subArg2 || queryTokens[2] || '').trim();

    // Refine argument extraction for specific subcommands
    if (['color', 'warna', 'theme', 'tema'].includes(sub)) {
      if (args.color) rawVal = args.color;
      else if (queryTokens.length > 1) rawVal = queryTokens.slice(1).join(' ').trim();
    } else if (['bg', 'background', 'latar', 'reset_bg'].includes(sub)) {
      if (args.url) rawVal = args.url;
      else if (queryTokens.length > 1) rawVal = queryTokens.slice(1).join(' ').trim();
    } else if (['privacy', 'privasi'].includes(sub)) {
      if (args.section) rawVal = args.section;
      if (args.status) rawVal2 = args.status;
    }

    // 1. HELP SUBCOMMAND
    if (sub === 'help' || sub === 'bantuan') {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x6366f1)
            .setTitle(lang === 'en' ? '👤 On Ao Profile Settings & Privacy' : '👤 Pengaturan & Privasi Profil On Ao')
            .setDescription(t('profile_help', lang))
            .addFields(
              {
                name: lang === 'en' ? '🎨 Color Theme Presets' : '🎨 Preset Tema Warna',
                value: '`merah` (Red), `biru` (Blue), `pink` (Pink), `oranye` (Orange), `ungu` (Purple), `hijau` (Green), `cyan` (Aqua), `kuning` (Yellow)\n' + (lang === 'en' ? 'Or any 6-digit hex code, e.g. `#ff007f`, `#3b82f6`' : 'Atau kode hex kustom, contoh: `#ff007f`, `#3b82f6`'),
                inline: false
              },
              {
                name: lang === 'en' ? '🖼️ Custom Background' : '🖼️ Latar Belakang Gambar',
                value: '`on profile bg <url_gambar>` / upload attachment\n`on profile bg reset` (' + (lang === 'en' ? 'Reset to default theme' : 'Reset ke tema bawaan') + ')',
                inline: false
              },
              {
                name: lang === 'en' ? '🔒 Privacy Controls' : '🔒 Kontrol Privasi Musik',
                value: '`on profile privacy servers <public|private>`\n`on profile privacy friends <public|private>`\n`on profile privacy tracks <public|private>`\n`on profile privacy all <public|private>`',
                inline: false
              },
              {
                name: lang === 'en' ? '✨ Reset All' : '✨ Reset Semua Kustomisasi',
                value: '`on profile reset` (' + (lang === 'en' ? 'Revert color, background, and privacy to defaults' : 'Kembalikan warna, background, dan privasi ke awal') + ')',
                inline: false
              }
            )
            .setFooter({ text: 'On Ao Music Studio • Music Passport' })
        ]
      });
    }

    // 2. COLOR SUBCOMMAND
    if (sub === 'color' || sub === 'warna' || sub === 'theme' || sub === 'tema') {
      let chosenColor = rawVal.toLowerCase();
      if (!chosenColor) {
        return reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf43f5e)
              .setDescription(lang === 'en'
                ? '⚠️ Please specify a color: `red`, `blue`, `pink`, `orange`, `purple`, `green`, `cyan`, `yellow`, or a hex code like `#e11d48`.\nExample: `on profile color pink` or `on profile color #3b82f6`'
                : '⚠️ Masukkan pilihan warna: `merah`, `biru`, `pink`, `oranye`, `ungu`, `hijau`, `cyan`, `kuning`, atau kode hex seperti `#e11d48`.\nContoh: `on profile color pink` atau `on profile color #3b82f6`')
          ]
        });
      }

      // Map color names
      if (['merah', 'red', 'crimson'].includes(chosenColor)) chosenColor = 'red';
      else if (['biru', 'blue', 'ocean'].includes(chosenColor)) chosenColor = 'blue';
      else if (['merahmuda', 'merah muda', 'pink', 'rose'].includes(chosenColor)) chosenColor = 'pink';
      else if (['oranye', 'orange', 'jingga', 'amber'].includes(chosenColor)) chosenColor = 'orange';
      else if (['ungu', 'purple', 'violet'].includes(chosenColor)) chosenColor = 'purple';
      else if (['hijau', 'green', 'emerald'].includes(chosenColor)) chosenColor = 'green';
      else if (['cyan', 'aqua'].includes(chosenColor)) chosenColor = 'cyan';
      else if (['kuning', 'yellow'].includes(chosenColor)) chosenColor = 'yellow';
      else if (/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(chosenColor)) {
        if (!chosenColor.startsWith('#')) chosenColor = `#${chosenColor}`;
      } else {
        return reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf43f5e)
              .setDescription(lang === 'en'
                ? '❌ Invalid color format. Choose `red`, `blue`, `pink`, `orange`, `purple`, `green`, `cyan`, `yellow`, or a 6-digit hex code `#rrggbb`.'
                : '❌ Format warna tidak dikenal. Pilih `merah`, `biru`, `pink`, `oranye`, `ungu`, `hijau`, `cyan`, `kuning`, atau kode hex 6 digit `#rrggbb`.')
          ]
        });
      }

      if (updateUserProfileSettings) {
        updateUserProfileSettings(user.id, { color: chosenColor });
      }

      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setDescription(t('profile_color_updated', lang, { color: chosenColor.toUpperCase() }))
        ]
      });
    }

    // 3. BACKGROUND IMAGE SUBCOMMAND
    if (sub === 'bg' || sub === 'background' || sub === 'latar' || sub === 'reset_bg') {
      const isReset = sub === 'reset_bg' || ['reset', 'hapus', 'clear', 'none', 'default'].includes(rawVal.toLowerCase());
      if (isReset) {
        if (updateUserProfileSettings) {
          updateUserProfileSettings(user.id, { background: null });
        }
        return reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x10b981)
              .setDescription(t('profile_bg_reset', lang))
          ]
        });
      }

      const imgUrl = rawVal || args.attachmentUrl || (ctx.attachments?.first?.() ? ctx.attachments.first().url : null);
      if (!imgUrl || (!imgUrl.startsWith('http://') && !imgUrl.startsWith('https://'))) {
        return reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf43f5e)
              .setDescription(lang === 'en'
                ? '⚠️ Please provide a direct image link (e.g. `on profile bg https://example.com/image.png`) or upload an image attachment with your command.'
                : '⚠️ Berikan URL gambar langsung (contoh: `on profile bg https://example.com/gambar.png`) atau upload gambar bersama pesan `on profile bg`.')
          ]
        });
      }

      if (updateUserProfileSettings) {
        updateUserProfileSettings(user.id, { background: imgUrl });
      }

      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setDescription(t('profile_bg_updated', lang))
            .setImage(imgUrl)
        ]
      });
    }

    // 4. PRIVACY SUBCOMMAND
    if (sub === 'privacy' || sub === 'privasi' || sub.startsWith('privacy_')) {
      let targetSection = '';
      let targetStatus = '';

      if (sub.startsWith('privacy_')) {
        targetSection = sub.replace('privacy_', '').trim();
        targetStatus = rawVal.toLowerCase();
      } else {
        targetSection = rawVal.toLowerCase();
        targetStatus = rawVal2.toLowerCase();
      }

      // Map target section
      if (['server', 'servers', 'guild', 'guilds'].includes(targetSection)) targetSection = 'servers';
      else if (['friend', 'friends', 'teman', 'kawan'].includes(targetSection)) targetSection = 'friends';
      else if (['track', 'tracks', 'song', 'songs', 'lagu', 'trek'].includes(targetSection)) targetSection = 'tracks';
      else if (['all', 'semua'].includes(targetSection)) targetSection = 'all';

      // Map status
      if (['private', 'privat', 'hide', 'hidden', 'sembunyi', 'tertutup'].includes(targetStatus)) targetStatus = 'private';
      else if (['public', 'publik', 'show', 'buka', 'terbuka'].includes(targetStatus)) targetStatus = 'public';

      if (!targetSection || !['servers', 'friends', 'tracks', 'all'].includes(targetSection) || !['public', 'private'].includes(targetStatus)) {
        return reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf43f5e)
              .setDescription(lang === 'en'
                ? '⚠️ Usage: `on profile privacy <servers|friends|tracks|all> <public|private>`\nExample: `on profile privacy tracks private` or `on profile privacy all private`'
                : '⚠️ Format: `on profile privacy <servers|friends|tracks|all> <public|private>`\nContoh: `on profile privacy tracks private` atau `on profile privacy all private`')
          ]
        });
      }

      const privacyUpdate = {};
      if (targetSection === 'all') {
        privacyUpdate.servers = targetStatus;
        privacyUpdate.friends = targetStatus;
        privacyUpdate.tracks = targetStatus;
      } else {
        privacyUpdate[targetSection] = targetStatus;
      }

      if (updateUserProfileSettings) {
        updateUserProfileSettings(user.id, { privacy: privacyUpdate });
      }

      const sectionLabel = targetSection === 'all'
        ? (lang === 'en' ? 'All Sections (Servers, Friends, Tracks)' : 'Semua Bagian (Server, Teman & Trek)')
        : (targetSection === 'servers'
          ? (lang === 'en' ? 'Servers' : 'Daftar Server')
          : (targetSection === 'friends'
            ? (lang === 'en' ? 'Friends' : 'Riwayat Teman')
            : (lang === 'en' ? 'Tracks' : 'Riwayat Lagu / Trek')));

      const statusLabel = targetStatus === 'private'
        ? (lang === 'en' ? 'Private 🔒 (Hidden on public cards)' : 'Privat 🔒 (Disembunyikan dari publik)')
        : (lang === 'en' ? 'Public 🌐 (Visible to all)' : 'Publik 🌐 (Dapat dilihat semua orang)');

      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setDescription(t('profile_privacy_updated', lang, { target: sectionLabel, status: statusLabel }))
        ]
      });
    }

    // 5. RESET SUBCOMMAND
    if (sub === 'reset' || sub === 'reset_all' || sub === 'default') {
      if (updateUserProfileSettings) {
        updateUserProfileSettings(user.id, { resetAll: true });
      }
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setDescription(t('profile_reset_done', lang))
        ]
      });
    }

    // 6. DEFAULT: DISPLAY PROFILE CARD
    let targetUser = args.user;
    if (!targetUser && sub && !['view', 'lihat'].includes(sub)) {
      // Check if sub is a member mention or username query
      const cleanSub = sub.replace(/[<@!>]/g, '');
      const foundMember = guild?.members?.cache?.find(m =>
        m.user.id === cleanSub ||
        m.user.username.toLowerCase() === sub.toLowerCase() ||
        m.displayName.toLowerCase() === sub.toLowerCase() ||
        m.user.tag?.toLowerCase() === sub.toLowerCase()
      );
      if (foundMember) targetUser = foundMember.user;
    }
    if (!targetUser) targetUser = user;

    const profile = getFormattedUserProfile
      ? getFormattedUserProfile(targetUser, guild, voiceChannel, user)
      : (getUserProfile(targetUser.id) || {});

    let canvasBuffer = null;
    try {
      canvasBuffer = await generateOnAoProfileCard({
        username: profile.username || targetUser.username,
        avatarUrl: profile.avatarUrl || (targetUser.displayAvatarURL ? targetUser.displayAvatarURL({ extension: 'png', size: 256 }) : null),
        color: profile.color || 'red',
        background: profile.background || null,
        privacy: profile.privacy || { servers: 'public', friends: 'public', tracks: 'public' },
        servers: profile.servers || [],
        friends: profile.friends || [],
        tracks: profile.tracks || [],
        favSong: profile.favSong,
        favCount: profile.favCount,
        totalHours: profile.totalHours || Math.round(((profile.seconds || 0) / 3600) * 10) / 10,
        isOwner: Boolean(user && user.id === targetUser.id),
        lang
      });
    } catch (e) {
      console.warn('[PROFILE CANVAS FALLBACK]', e.message);
    }

    if (canvasBuffer) {
      const attachment = new AttachmentBuilder(canvasBuffer, { name: 'onao-profile.png' });
      return reply({
        files: [attachment]
      });
    }

    // Fallback embed if canvas fails
    const totalSec = profile.seconds || 0;
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const formattedListeningTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6366f1)
          .setTitle(t('profile_title', lang, { user: targetUser.username }))
          .addFields(
            { name: lang === 'en' ? 'Total Songs' : 'Total Lagu Didengarkan', value: `${profile.songs || 0} lagu`, inline: true },
            { name: lang === 'en' ? 'Listening Time (HH:MM)' : 'Total Waktu Mendengar (HH:MM)', value: formattedListeningTime, inline: true },
            { name: lang === 'en' ? 'Commands Run' : 'Perintah Dijalankan', value: `${profile.commands || 0}x`, inline: true }
          )
      ]
    });
  }

  // ==================== 27. LANGUAGE ====================
  if (cmdName === 'language') {
    const choice = (args.choice || '').toLowerCase().trim();
    const scope = (args.scope || 'server').toLowerCase().trim();
    const currentServerLang = getLanguage(guild?.id, null);
    const currentUserLang = getLanguage(null, user?.id);

    if (!choice || !['id', 'en', 'indo', 'indonesia', 'english', 'eng'].includes(choice)) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x6366f1)
            .setTitle('🌐 Multi-Language Settings / Pengaturan Multi-Bahasa')
            .setDescription(t('lang_info', currentServerLang, {
              serverLang: currentServerLang === 'en' ? 'English 🇬🇧' : 'Bahasa Indonesia 🇮🇩',
              userLang: currentUserLang === 'en' ? 'English 🇬🇧' : 'Bahasa Indonesia 🇮🇩'
            }))
        ]
      });
    }

    const appliedLang = setLanguage({
      guildId: guild?.id,
      userId: user?.id,
      language: choice,
      scope: scope === 'user' ? 'user' : 'server'
    });

    const scopeLabel = scope === 'user'
      ? (appliedLang === 'en' ? 'Personal Account' : 'Akun Pribadi')
      : (appliedLang === 'en' ? 'This Server' : 'Server Ini');

    return reply({
      embeds: [new EmbedBuilder().setColor(0x10b981).setDescription(t('lang_changed', appliedLang, { scope: scopeLabel }))]
    });
  }

  // ==================== 27.5 PREFIX & SETPREFIX ====================
  if (cmdName === 'prefix' || cmdName === 'setprefix') {
    const currentSettings = getGuildSettings(guild?.id);
    const activePrefix = currentSettings.prefix || 'on ';
    const newPrefix = (args.prefix || args.new_prefix || '').trim();

    if (!newPrefix) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x6366f1)
            .setTitle(lang === 'en' ? '⚡ Server Command Prefix' : '⚡ Prefix Perintah Server')
            .setDescription(t('prefix_info', lang, { prefix: activePrefix, botId: client.user.id }))
            .addFields(
              {
                name: lang === 'en' ? '💡 How to Change Prefix' : '💡 Cara Mengubah Prefix',
                value: lang === 'en'
                  ? '`/prefix new_prefix:!` or `on prefix !` (Administrator only)'
                  : '`/prefix new_prefix:!` atau `on prefix !` (Khusus Administrator)'
              },
              {
                name: lang === 'en' ? 'Universal Prefixes (Always Active)' : 'Prefix Universal (Selalu Aktif)',
                value: '`on <cmd>`, `onao <cmd>`, `!<cmd>`, or `@On Ao <cmd>`'
              }
            )
        ]
      });
    }

    if (!member.permissions.has(PermissionsBitField.Flags.Administrator) && !member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(t('prefix_admin_only', lang))]
      });
    }

    if (newPrefix.length > 5) {
      return reply({
        embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(lang === 'en' ? '❌ Prefix maximum length is 5 characters.' : '❌ Panjang prefix maksimal 5 karakter.')]
      });
    }

    updateGuildSettings(guild.id, { prefix: newPrefix });
    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x10b981)
          .setDescription(t('prefix_changed', lang, { prefix: newPrefix }))
      ]
    });
  }

  // ==================== 28. LYRICS ====================
  if (cmdName === 'lyrics') {
    let queryTitle = args.title;
    let queryArtist = '';
    let artworkUrl = null;

    if (!queryTitle && player?.queue?.current) {
      queryTitle = getTrackTitle(player.queue.current);
      queryArtist = getTrackAuthor ? getTrackAuthor(player.queue.current) : (player.queue.current.author || player.queue.current.info?.author || '');
      artworkUrl = getTrackArtwork ? getTrackArtwork(player.queue.current) : (player.queue.current.artworkUrl || player.queue.current.info?.artworkUrl);
    } else if (queryTitle && queryTitle.includes(' - ')) {
      const parts = queryTitle.split(' - ');
      queryArtist = parts[0].trim();
      queryTitle = parts[1].trim();
    }

    if (!queryTitle) {
      return reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(t('lyrics_no_track', lang))] });
    }

    if (isSlash && !ctx.deferred && !ctx.replied) {
      await ctx.deferReply();
    }

    const lyricsData = await fetchSongLyrics(queryTitle, queryArtist);
    if (!lyricsData || !lyricsData.lyrics) {
      return reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf43f5e)
            .setDescription(`${t('lyrics_not_found', lang, { query: queryTitle })}\n\n${t('lyrics_tips', lang)}`)
        ]
      });
    }

    // Resolve thumbnail artwork if not already from current player
    if (!artworkUrl && lyricsData.artworkUrl) {
      artworkUrl = lyricsData.artworkUrl;
    }
    if (!artworkUrl && typeof searchSpotifyArtwork === 'function') {
      try {
        const spotArt = await searchSpotifyArtwork(lyricsData.title, lyricsData.artist);
        if (spotArt) artworkUrl = spotArt;
      } catch (e) {}
    }
    if (!artworkUrl) {
      try {
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(`${lyricsData.title} ${lyricsData.artist}`)}&entity=song&limit=1`);
        if (itunesRes.ok) {
          const itunesData = await itunesRes.json();
          if (itunesData.results && itunesData.results.length > 0) {
            const art100 = itunesData.results[0].artworkUrl100;
            if (art100) {
              artworkUrl = art100.replace('100x100bb', '600x600bb');
            }
          }
        }
      } catch (e) {}
    }

    const fullLyrics = lyricsData.lyrics;
    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle(`🎶 ${lyricsData.title} — ${lyricsData.artist}`)
      .setDescription(fullLyrics.slice(0, 4000))
      .setFooter({ text: t('lyrics_footer', lang, { source: lyricsData.source }) })
      .setTimestamp();

    if (artworkUrl) {
      embed.setThumbnail(artworkUrl);
    }

    return reply({ embeds: [embed] });
  }

  // ==================== 29. QUALITY ====================
  if (cmdName === 'quality') {
    const bitrate = voiceChannel?.bitrate ? Math.round(voiceChannel.bitrate / 1000) : 64;
    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x10b981)
          .setTitle('📊 Bitrate & Kualitas Suara Voice Channel')
          .setDescription(`Voice channel saat ini: **${voiceChannel?.name || 'Unknown'}**\nBitrate aktif: **${bitrate} kbps**`)
          .addFields(
            { name: '💡 Rekomendasi Bitrate', value: '• **96 kbps** untuk suara bersih standar\n• **128 - 256 kbps** untuk kualitas musik studio\n• **384 kbps** (Server Boost Tier 3) untuk pengalaman Hi-Fi terbaik' },
            { name: 'Cara Mengubah Bitrate', value: 'Klik kanan Voice Channel > Edit Channel > Atur slider **Bitrate** ke posisi maksimal server kamu.' }
          )
      ]
    });
  }

  // ==================== 30. PING & STATS & INVITE ====================
  if (cmdName === 'ping') {
    const wsPing = client.ws.ping;
    const connectedNodes = client.lavalink?.nodeManager?.nodes ? [...client.lavalink.nodeManager.nodes.values()].filter(n => n.connected).length : 0;
    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x10b981)
          .setTitle('🏓 Pong! Latensi Bot & Audio Engine')
          .addFields(
            { name: 'WebSocket Discord', value: `\`${wsPing} ms\``, inline: true },
            { name: 'Lavalink Engine Node', value: `\`${connectedNodes > 0 ? '🟢 Terhubung (' + connectedNodes + ' node)' : '🔴 Menghubungkan'}\``, inline: true }
          )
          .setFooter({ text: 'On Ao Music Studio Engine' })
      ]
    });
  }

  if (cmdName === 'stats') {
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const uptimeSec = Math.floor(process.uptime());
    const uptimeStr = `${Math.floor(uptimeSec / 3600)}j ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}d`;
    const totalGuilds = client.guilds.cache.size;
    const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6366f1)
          .setTitle('📊 Statistik On Ao Music Studio')
          .addFields(
            { name: 'Server / Guild', value: `${totalGuilds} server`, inline: true },
            { name: 'Total User', value: `${totalUsers} pengguna`, inline: true },
            { name: 'Uptime', value: uptimeStr, inline: true },
            { name: 'Penggunaan RAM', value: `${memory} MB`, inline: true },
            { name: 'Node.js', value: process.version, inline: true },
            { name: 'Discord.js', value: 'v14.18.0', inline: true }
          )
      ]
    });
  }

  if (cmdName === 'invite' || rawCommand === 'invite') {
    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle('🔒 Akses Privat (Undangan Dinonaktifkan)')
          .setDescription('Perintah undangan publik telah dinonaktifkan.\nBot ini bersifat privat dan **tidak dapat ditambahkan ke server lain tanpa izin langsung dari Pemilik Bot (Owner)**.')
      ]
    });
  }

  // ==================== 31. HELP ====================
  if (cmdName === 'help') {
    const { buildHelpEmbed, buildSelectMenu, buildButtonRow, TOTAL_PAGES } = require('./bot-help.cjs');
    return reply({
      embeds: [buildHelpEmbed(1, lang, client)],
      components: [buildSelectMenu(1, lang), buildButtonRow(1, TOTAL_PAGES)]
    });
  }

  // Fallback for unknown prefix command
  if (!isSlash && rawCommand) {
    return reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf59e0b)
          .setDescription(`⚠️ Perintah \`${rawCommand}\` tidak dikenali.\nKetik **\`on help\`** atau gunakan slash command **\`/\`** untuk melihat daftar perintah.`)
      ]
    });
  }
}

module.exports = {
  handleMusicCommand,
  applyUnifiedAudioFilters,
  getBandsForPreset,
  createAudioFilterComponents
};
