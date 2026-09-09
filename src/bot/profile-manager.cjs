/**
 * On Ao Discord Music Bot - User Profile & Listening Analytics Engine
 * Strictly tracks real-time listening seconds when bot is actively playing audio in voice channels.
 * No fake data, no simulated fallback durations.
 */
const fs = require('fs');
const path = require('path');

const PROFILES_PATH = path.resolve(process.cwd(), 'profiles.json');
let profilesCache = null;
let profilesDirty = false;
let lastProfilesSaveTime = Date.now();

function getLoadedProfiles() {
  if (!profilesCache) {
    if (fs.existsSync(PROFILES_PATH)) {
      try {
        profilesCache = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
      } catch (e) {
        profilesCache = {};
      }
    } else {
      profilesCache = {};
    }
  }
  return profilesCache;
}

function flushProfilesToDisk(force = false) {
  const now = Date.now();
  if (profilesDirty && (force || now - lastProfilesSaveTime >= 3000)) {
    try {
      const data = getLoadedProfiles();
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(data, null, 2), 'utf8');
      profilesDirty = false;
      lastProfilesSaveTime = now;
    } catch (e) {
      console.error('[PROFILES FLUSH ERROR]', e.message);
    }
  }
}

/**
 * Record a requested song for the requester.
 * Increases song count without adding artificial time.
 */
function recordUserProfile(user, trackTitle, guild = null, voiceChannel = null) {
  try {
    const userId = typeof user === 'string' ? user : user?.id;
    if (!userId) return;
    const username = (typeof user === 'object' && user?.username) ? user.username : `user_${userId.slice(0, 5)}`;
    const avatarUrl = user?.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 256 }) : null;

    const data = getLoadedProfiles();
    if (!data[userId]) {
      data[userId] = {
        username: username,
        avatarUrl: avatarUrl,
        songs: 0,
        seconds: 0,
        commands: 0,
        favSong: trackTitle || null,
        favCount: 1,
        servers: {},
        friends: {},
        tracks: {}
      };
    }
    const prof = data[userId];
    prof.username = username;
    if (avatarUrl) prof.avatarUrl = avatarUrl;
    prof.songs = (prof.songs || 0) + 1;
    if (!prof.servers || typeof prof.servers !== 'object') prof.servers = {};
    if (!prof.friends || typeof prof.friends !== 'object') prof.friends = {};
    if (!prof.tracks || typeof prof.tracks !== 'object') prof.tracks = {};

    if (trackTitle) {
      if (!prof.tracks[trackTitle]) {
        prof.tracks[trackTitle] = { title: trackTitle, seconds: 0, count: 0 };
      }
      prof.tracks[trackTitle].count = (prof.tracks[trackTitle].count || 0) + 1;

      let bestTrack = null;
      let bestWeight = 0;
      for (const t of Object.values(prof.tracks)) {
        const weight = (t.count || 1) * 100 + (t.seconds || 0);
        if (weight > bestWeight) {
          bestWeight = weight;
          bestTrack = t.title;
        }
      }
      if (bestTrack) {
        prof.favSong = bestTrack;
        prof.favCount = prof.tracks[bestTrack]?.count || 1;
      }
    }
    profilesDirty = true;
    flushProfilesToDisk();
  } catch (err) {
    console.error('[PROFILES ERROR]', err.message);
  }
}

function recordUserCommand(user, guild = null) {
  try {
    const userId = typeof user === 'string' ? user : user?.id;
    if (!userId) return;
    const username = (typeof user === 'object' && user?.username) ? user.username : `user_${userId.slice(0, 5)}`;
    const avatarUrl = user?.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 256 }) : null;

    const data = getLoadedProfiles();
    if (!data[userId]) {
      data[userId] = {
        username: username,
        avatarUrl: avatarUrl,
        songs: 0,
        seconds: 0,
        commands: 0,
        favSong: null,
        favCount: 0,
        servers: {},
        friends: {},
        tracks: {}
      };
    }
    data[userId].username = username;
    if (avatarUrl) data[userId].avatarUrl = avatarUrl;
    data[userId].commands = (data[userId].commands || 0) + 1;
    profilesDirty = true;
    flushProfilesToDisk();
  } catch (e) {}
}

function recordPlaybackSession(track, requester, guild = null, voiceChannel = null, getTrackTitleFn) {
  if (!track || !requester) return;
  const trackTitle = typeof track === 'string' ? track : (getTrackTitleFn ? getTrackTitleFn(track) : (track.title || track.info?.title || 'Unknown Track'));
  recordUserProfile(requester, trackTitle, guild, voiceChannel);
}

/**
 * Real-Time Voice Presence Ticker:
 * Strictly counts listening seconds only when:
 * 1. Bot is actively in voice channel.
 * 2. Audio is playing (not paused, not idle, track actively running).
 * 3. Human members are in the voice channel listening.
 */
function startVoicePresenceTracker(getClientFn, getGuildPlayerFn) {
  setInterval(() => {
    try {
      const client = getClientFn ? getClientFn() : null;
      if (!client || !client.isReady()) return;

      const data = getLoadedProfiles();
      let activityOccurred = false;

      client.guilds.cache.forEach(guild => {
        const botVoiceChannel = guild.members.me?.voice?.channel;
        if (!botVoiceChannel) return;

        const humanMembers = botVoiceChannel.members.filter(m => !m.user.bot);
        if (humanMembers.size === 0) return;

        const player = getGuildPlayerFn ? getGuildPlayerFn(guild.id) : null;
        const currentTrack = player?.queue?.current || player?.get?.('currentTrack') || null;
        const trackTitle = currentTrack ? (typeof currentTrack === 'string' ? currentTrack : (currentTrack.title || currentTrack.info?.title || null)) : null;
        
        // Audio MUST be actively playing
        const isPlaying = Boolean(player && player.playing && !player.paused && currentTrack);
        if (!isPlaying) return;

        humanMembers.forEach(member => {
          const userId = member.user.id;
          const username = member.user.username;
          const avatarUrl = member.user.displayAvatarURL ? member.user.displayAvatarURL({ extension: 'png', size: 256 }) : null;

          if (!data[userId]) {
            data[userId] = {
              username,
              avatarUrl,
              songs: 0,
              seconds: 0,
              commands: 0,
              favSong: trackTitle || null,
              favCount: 1,
              servers: {},
              friends: {},
              tracks: {}
            };
          }

          const prof = data[userId];
          prof.username = username;
          if (avatarUrl) prof.avatarUrl = avatarUrl;
          if (!prof.servers || typeof prof.servers !== 'object') prof.servers = {};
          if (!prof.friends || typeof prof.friends !== 'object') prof.friends = {};
          if (!prof.tracks || typeof prof.tracks !== 'object') prof.tracks = {};

          // Increment real listening seconds
          prof.seconds = (prof.seconds || 0) + 1;

          if (guild.name) {
            prof.servers[guild.name] = (prof.servers[guild.name] || 0) + 1;
          }

          // Count friends who are in VC listening together
          humanMembers.forEach(otherMember => {
            if (otherMember.user.id !== userId) {
              const friendUser = otherMember.user.username;
              prof.friends[friendUser] = (prof.friends[friendUser] || 0) + 1;
            }
          });

          if (trackTitle) {
            if (!prof.tracks[trackTitle]) {
              prof.tracks[trackTitle] = { title: trackTitle, seconds: 0, count: 1 };
            }
            prof.tracks[trackTitle].seconds = (prof.tracks[trackTitle].seconds || 0) + 1;
          }

          activityOccurred = true;
        });
      });

      if (activityOccurred) {
        profilesDirty = true;
        flushProfilesToDisk();
      }
    } catch (presenceErr) {
      // Keep resilient
    }
  }, 1000);
}

function getUserProfile(userId) {
  try {
    const data = getLoadedProfiles();
    return data[userId] || null;
  } catch (e) {}
  return null;
}

function updateUserProfileSettings(userId, updates = {}) {
  try {
    if (!userId) return null;
    const data = getLoadedProfiles();
    if (!data[userId]) {
      data[userId] = {
        songs: 0,
        seconds: 0,
        commands: 0,
        servers: {},
        friends: {},
        tracks: {}
      };
    }
    const prof = data[userId];
    if (updates.color !== undefined) {
      prof.color = updates.color;
    }
    if (updates.background !== undefined) {
      prof.background = updates.background;
    }
    if (updates.privacy !== undefined) {
      if (!prof.privacy || typeof prof.privacy !== 'object') {
        prof.privacy = { servers: 'public', friends: 'public', tracks: 'public' };
      }
      if (typeof updates.privacy === 'object') {
        prof.privacy = { ...prof.privacy, ...updates.privacy };
      }
    }
    if (updates.resetAll) {
      prof.color = 'red';
      prof.background = null;
      prof.privacy = { servers: 'public', friends: 'public', tracks: 'public' };
    }
    profilesDirty = true;
    flushProfilesToDisk(true);
    return prof;
  } catch (err) {
    console.error('[PROFILE UPDATE ERROR]', err.message);
    return null;
  }
}

function getFormattedUserProfile(targetUser, guild = null, voiceChannel = null, viewerUser = null) {
  const userId = targetUser.id;
  const raw = getUserProfile(userId) || {};
  const isOwner = Boolean(viewerUser && viewerUser.id === targetUser.id);

  let servers = [];
  if (raw.servers && typeof raw.servers === 'object') {
    servers = Object.entries(raw.servers)
      .map(([name, sec]) => ({
        name,
        durationSec: Math.max(0, Number(sec) || 0)
      }))
      .filter(s => s.durationSec > 0)
      .sort((a, b) => b.durationSec - a.durationSec);
  }

  let friends = [];
  if (raw.friends && typeof raw.friends === 'object') {
    friends = Object.entries(raw.friends)
      .map(([username, sec]) => ({
        username,
        name: username,
        durationSec: Math.max(0, Number(sec) || 0)
      }))
      .filter(f => f.durationSec > 0)
      .sort((a, b) => b.durationSec - a.durationSec);
  }

  let tracks = [];
  if (raw.tracks && typeof raw.tracks === 'object') {
    tracks = Object.values(raw.tracks)
      .map(t => ({
        title: t.title,
        name: t.title,
        durationSec: Math.max(0, Number(t.seconds) || 0),
        count: t.count || 1
      }))
      .filter(t => t.durationSec > 0 || t.count > 0)
      .sort((a, b) => (b.durationSec || 0) - (a.durationSec || 0) || (b.count || 0) - (a.count || 0));
  }

  const totalSec = Math.max(0, Number(raw.seconds) || 0);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const formattedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  return {
    username: targetUser.username,
    avatarUrl: targetUser.displayAvatarURL ? targetUser.displayAvatarURL({ extension: 'png', size: 256 }) : raw.avatarUrl,
    songs: raw.songs || 0,
    seconds: totalSec,
    commands: raw.commands || 0,
    favSong: raw.favSong || tracks[0]?.title || null,
    favCount: raw.favCount || (tracks[0]?.count || 0),
    totalHours: Math.round((totalSec / 3600) * 10) / 10,
    formattedTime,
    color: raw.color || 'red',
    background: raw.background || null,
    privacy: raw.privacy || { servers: 'public', friends: 'public', tracks: 'public' },
    isOwner,
    servers,
    friends,
    tracks
  };
}

module.exports = {
  recordUserProfile,
  recordUserCommand,
  recordPlaybackSession,
  startVoicePresenceTracker,
  getUserProfile,
  updateUserProfileSettings,
  getFormattedUserProfile,
  flushProfilesToDisk
};

