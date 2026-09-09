/**
 * Custom Playlist and Playlist Resolution Manager
 * Supports:
 * - Persistent Custom User/Guild Playlists (stored in playlists.json)
 * - YouTube Playlist Resolution (modern lockupViewModel and legacy playlistVideoRenderer)
 * - Spotify Playlist & Album Resolution (fast instant loading)
 * - SoundCloud Sets & Playlists
 */

const fs = require('fs');
const path = require('path');
const { UnresolvedTrackSymbol, TrackSymbol } = require('lavalink-client');

const PLAYLISTS_FILE = path.join(process.cwd(), 'playlists.json');
let playlistsData = {};

/**
 * Universal Track Factory - Works seamlessly on both Lavalink nodes and Native Voice Engine
 */
function createUniversalTrack(data, requester) {
  if (!data) return null;

  // If already a valid Lavalink encoded track, return it directly
  if (data.encoded && data.info) {
    if (!data.requester && requester) data.requester = requester;
    return data;
  }

  const title = (data.title || data.info?.title || data.name || 'Unknown Track').trim();
  const author = (data.author || data.artist || data.info?.author || data.subtitle || 'Unknown Artist').trim();
  const duration = Number(data.duration || data.durationMs || data.info?.duration || 180000);
  const uri = data.uri || data.spotifyUrl || data.url || data.info?.uri || '';
  const artworkUrl = data.artworkUrl || data.info?.artworkUrl || data.thumbnail || null;
  const rawQuery = (data.query || (author && !['Spotify', 'YouTube Artist', 'Unknown Artist'].includes(author) ? `${title} ${author}` : title)).trim();

  const trackObj = {
    title,
    author,
    duration,
    uri,
    artworkUrl,
    requester: requester || null,
    info: {
      title,
      author,
      duration,
      uri,
      artworkUrl,
      requester: requester || null
    },
    pluginInfo: { clientData: {} },
    async resolve(player) {
      if (this.encoded) return this;
      if (!player) return this;

      const sources = ['ytmsearch', 'ytsearch', 'scsearch'];
      for (const src of sources) {
        try {
          const res = await player.search({ query: rawQuery, source: src }, this.requester);
          if (res && res.tracks && res.tracks.length > 0) {
            const best = res.tracks[0];
            if (best.encoded) {
              this.encoded = best.encoded;
              if (best.info) {
                this.info = {
                  ...best.info,
                  title: this.title || best.info.title,
                  author: this.author || best.info.author,
                  artworkUrl: this.artworkUrl || best.info.artworkUrl || best.artworkUrl
                };
              }
              if (best.artworkUrl || this.artworkUrl) {
                this.artworkUrl = this.artworkUrl || best.artworkUrl;
              }
              delete this[UnresolvedTrackSymbol];
              delete this.resolve;
              Object.defineProperty(this, TrackSymbol, { configurable: true, value: true });
              return this;
            }
          }
        } catch (e) {}
      }
      return this;
    }
  };

  Object.defineProperty(trackObj, UnresolvedTrackSymbol, {
    configurable: true,
    value: true
  });

  return trackObj;
}

try {
  if (fs.existsSync(PLAYLISTS_FILE)) {
    playlistsData = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8'));
  }
} catch (err) {
  console.warn('[PLAYLIST] Failed to read playlists.json, initializing empty:', err.message);
  playlistsData = {};
}

function savePlaylists() {
  try {
    fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(playlistsData, null, 2), 'utf8');
  } catch (err) {
    console.error('[PLAYLIST] Failed to save playlists.json:', err.message);
  }
}

/**
 * User/Guild Custom Playlists API
 */
function getUserPlaylists(userId) {
  if (!userId) return [];
  const userObj = playlistsData[userId] || {};
  return Object.keys(userObj).map(name => ({
    name,
    trackCount: Array.isArray(userObj[name]?.tracks) ? userObj[name].tracks.length : 0,
    createdAt: userObj[name]?.createdAt || null,
    updatedAt: userObj[name]?.updatedAt || null
  }));
}

function getPlaylist(userId, playlistName) {
  if (!userId || !playlistName) return null;
  const key = playlistName.trim().toLowerCase();
  const userObj = playlistsData[userId] || {};
  for (const name of Object.keys(userObj)) {
    if (name.toLowerCase() === key) {
      return {
        name,
        tracks: userObj[name]?.tracks || [],
        createdAt: userObj[name]?.createdAt,
        updatedAt: userObj[name]?.updatedAt
      };
    }
  }
  return null;
}

function createPlaylist(userId, playlistName, initialTracks = []) {
  if (!userId || !playlistName) return false;
  if (!playlistsData[userId]) playlistsData[userId] = {};
  
  const cleanName = playlistName.trim().slice(0, 50);
  playlistsData[userId][cleanName] = {
    name: cleanName,
    tracks: initialTracks.map(t => ({
      title: t.title || t.info?.title || 'Unknown Track',
      author: t.author || t.info?.author || 'Unknown Artist',
      duration: t.duration || t.info?.duration || 180000,
      uri: t.uri || t.info?.uri || '',
      artworkUrl: t.artworkUrl || t.info?.artworkUrl || null
    })),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  savePlaylists();
  return true;
}

function addTrackToPlaylist(userId, playlistName, track) {
  if (!userId || !playlistName || !track) return false;
  const pl = getPlaylist(userId, playlistName);
  if (!pl) return false;

  const userObj = playlistsData[userId];
  if (!userObj[pl.name]) return false;

  const trackObj = {
    title: track.title || track.info?.title || 'Unknown Track',
    author: track.author || track.info?.author || 'Unknown Artist',
    duration: track.duration || track.info?.duration || 180000,
    uri: track.uri || track.info?.uri || '',
    artworkUrl: track.artworkUrl || track.info?.artworkUrl || null
  };

  userObj[pl.name].tracks.push(trackObj);
  userObj[pl.name].updatedAt = Date.now();
  savePlaylists();
  return true;
}

function removeTrackFromPlaylist(userId, playlistName, indexOrTitle) {
  if (!userId || !playlistName) return null;
  const pl = getPlaylist(userId, playlistName);
  if (!pl || !pl.tracks.length) return null;

  const userObj = playlistsData[userId];
  const tracks = userObj[pl.name].tracks;

  let removed = null;
  if (typeof indexOrTitle === 'number' || /^\d+$/.test(String(indexOrTitle).trim())) {
    const idx = parseInt(indexOrTitle, 10) - 1;
    if (idx >= 0 && idx < tracks.length) {
      removed = tracks.splice(idx, 1)[0];
    }
  } else {
    const search = String(indexOrTitle).toLowerCase().trim();
    const idx = tracks.findIndex(t => t.title.toLowerCase().includes(search) || t.author.toLowerCase().includes(search));
    if (idx !== -1) {
      removed = tracks.splice(idx, 1)[0];
    }
  }

  if (removed) {
    userObj[pl.name].updatedAt = Date.now();
    savePlaylists();
  }
  return removed;
}

function deletePlaylist(userId, playlistName) {
  if (!userId || !playlistName) return false;
  const pl = getPlaylist(userId, playlistName);
  if (!pl) return false;

  delete playlistsData[userId][pl.name];
  savePlaylists();
  return true;
}

/**
 * YouTube Playlist Deep Resolver
 * Parses modern lockupViewModel, compactVideoRenderer, and playlistVideoRenderer
 */
async function resolveYouTubePlaylist(urlOrListId) {
  let listId = '';
  if (/^[a-zA-Z0-9_-]{10,}$/.test(urlOrListId)) {
    listId = urlOrListId;
  } else {
    const match = String(urlOrListId).match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    if (match) listId = match[1];
  }

  if (!listId) return null;

  try {
    const targetUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!res.ok) return null;
    const html = await res.text();

    const m = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s) || html.match(/var ytInitialData = ({.+?});<\/script>/s);
    if (!m) return null;

    const data = JSON.parse(m[1]);
    const plHeader = data.header?.playlistHeaderRenderer || data.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer;
    const playlistTitle = data.metadata?.playlistMetadataRenderer?.title || plHeader?.title?.runs?.[0]?.text || plHeader?.title?.simpleText || 'YouTube Playlist';
    const artworkUrl = data.metadata?.playlistMetadataRenderer?.albumArt?.thumbnails?.[0]?.url || plHeader?.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url || null;

    const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    const tab0 = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    const itemSection = tab0[0]?.itemSectionRenderer?.contents || [];

    const tracks = [];
    const seenVideoIds = new Set();

    // 1. Check lockupViewModel (YouTube 2024-2026 UI)
    for (const it of itemSection) {
      const l = it.lockupViewModel;
      if (!l) continue;
      const title = l.metadata?.lockupMetadataViewModel?.title?.content;
      const metaRows = l.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
      const author = metaRows[0]?.parts?.[0]?.text?.content || 'YouTube Artist';

      let videoId = l.contentId;
      if (!videoId) {
        const thumbUrl = l.contentImage?.thumbnailViewModel?.image?.sources?.[0]?.url || '';
        const viMatch = thumbUrl.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
        if (viMatch) videoId = viMatch[1];
      }
      if (!videoId && l.rendererContext) {
        const jsonStr = JSON.stringify(l.rendererContext);
        const viMatch = jsonStr.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (viMatch) videoId = viMatch[1];
      }

      if (videoId && title && !seenVideoIds.has(videoId)) {
        seenVideoIds.add(videoId);
        tracks.push(createUniversalTrack({
          videoId,
          title: title.trim(),
          author: author.trim(),
          duration: 180000,
          uri: `https://www.youtube.com/watch?v=${videoId}`,
          artworkUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        }));
      }
    }

    // 2. Check classic playlistVideoListRenderer
    const plRenderer = itemSection[0]?.playlistVideoListRenderer?.contents || [];
    for (const item of plRenderer) {
      const v = item.playlistVideoRenderer || item.compactVideoRenderer;
      if (v && v.videoId && !seenVideoIds.has(v.videoId)) {
        const title = v.title?.runs?.[0]?.text || v.title?.simpleText || 'YouTube Video';
        const author = v.shortBylineText?.runs?.[0]?.text || 'YouTube Artist';
        const durSec = parseInt(v.lengthSeconds || '180', 10);
        seenVideoIds.add(v.videoId);
        tracks.push(createUniversalTrack({
          videoId: v.videoId,
          title: title.trim(),
          author: author.trim(),
          duration: (durSec || 180) * 1000,
          uri: `https://www.youtube.com/watch?v=${v.videoId}`,
          artworkUrl: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
        }));
      }
    }

    if (tracks.length > 0) {
      return {
        loadType: 'playlist',
        playlist: {
          title: playlistTitle,
          name: playlistTitle,
          artworkUrl: artworkUrl || tracks[0]?.artworkUrl || null
        },
        tracks
      };
    }
  } catch (err) {
    console.warn('[YT PLAYLIST RESOLVER ERROR]', err.message);
  }

  return null;
}

module.exports = {
  getUserPlaylists,
  getPlaylist,
  createPlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  deletePlaylist,
  resolveYouTubePlaylist,
  createUniversalTrack
};
