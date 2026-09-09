/**
 * Spotify API Integration for On Ao Music Discord Bot
 * Uses official Spotify Web API Client Credentials Flow with provided credentials.
 * Handles single tracks, albums, playlists, high-resolution artwork fetching, and search fallback.
 */

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'c78db4641df546c987fc89b25e0e7b9a';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '8c995b72c09946658f1b3e73096fa261';

let cachedAccessToken = null;
let tokenExpiresAt = 0;
const artworkCache = new Map();

/**
 * Obtain a valid Spotify API Access Token via Client Credentials flow
 */
async function getSpotifyToken() {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  try {
    const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[SPOTIFY AUTH ERROR]', res.status, errText);
      return null;
    }

    const data = await res.json();
    cachedAccessToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in * 1000);
    return cachedAccessToken;
  } catch (err) {
    console.error('[SPOTIFY TOKEN FETCH ERROR]', err.message);
    return null;
  }
}

/**
 * Check if a URL or query is a Spotify reference
 */
function isSpotifyUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist)\/([a-zA-Z0-9]+))|(?:spotify:(track|album|playlist):([a-zA-Z0-9]+))/i.test(url);
}

/**
 * Extract all Spotify items (type, id, url) from input string
 */
function parseAllSpotifyUrls(url) {
  if (!url || typeof url !== 'string') return [];
  const regex = /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist)\/([a-zA-Z0-9]+)|spotify:(track|album|playlist):([a-zA-Z0-9]+)/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(url)) !== null) {
    const type = (match[1] || match[3]).toLowerCase();
    const id = match[2] || match[4];
    const fullUrl = match[0].startsWith('spotify:') ? match[0] : `https://open.spotify.com/${type}/${id}`;
    matches.push({ type, id, url: fullUrl });
  }
  return matches;
}

/**
 * Extract type and ID from a single Spotify link
 */
function parseSpotifyUrl(url) {
  const matches = parseAllSpotifyUrls(url);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Resolve a single parsed Spotify item
 */
async function resolveSingleSpotifyUrl({ type, id, url }) {
  try {
    // 1. Fetch oEmbed metadata (fast, official, zero-auth)
    const oembedUrl = 'https://open.spotify.com/oembed?url=' + encodeURIComponent(url);
    const ores = await fetch(oembedUrl).catch(() => null);
    const odata = ores && ores.ok ? await ores.json().catch(() => null) : null;

    if (type === 'track') {
      const embedUrl = `https://open.spotify.com/embed/track/${id}`;
      const eres = await fetch(embedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }).catch(() => null);
      const html = eres && eres.ok ? await eres.text().catch(() => '') : '';
      const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);

      let title = odata?.title || 'Spotify Track';
      let artist = 'Spotify';
      let artworkUrl = odata?.thumbnail_url || null;

      if (scriptMatch) {
        try {
          const nextData = JSON.parse(scriptMatch[1]);
          const entity = nextData.props?.pageProps?.state?.data?.entity;
          if (entity) {
            title = entity.name || title;
            artist = (entity.artists || []).map(a => a.name).join(', ') || entity.subtitle || artist;
            artworkUrl = entity.coverArt?.sources?.[0]?.url || artworkUrl;
          }
        } catch (e) {}
      }

      const query = (artist && artist !== 'Spotify' ? `${title} ${artist}` : title).trim();

      if (artworkUrl) {
        artworkCache.set(id, artworkUrl);
        artworkCache.set(query.toLowerCase(), artworkUrl);
      }

      return {
        type: 'track',
        id,
        title,
        artist,
        query,
        artworkUrl,
        durationMs: 180000,
        spotifyUrl: url
      };
    }

    if (type === 'playlist' || type === 'album') {
      const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
      const eres = await fetch(embedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }).catch(() => null);
      const html = eres && eres.ok ? await eres.text().catch(() => '') : '';
      const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);

      const playlistTitle = odata?.title || (type === 'playlist' ? 'Spotify Playlist' : 'Spotify Album');
      const artworkUrl = odata?.thumbnail_url || null;
      let tracks = [];

      if (scriptMatch) {
        try {
          const nextData = JSON.parse(scriptMatch[1]);
          const entity = nextData.props?.pageProps?.state?.data?.entity;
          const trackList = entity?.trackList || entity?.tracks?.items || entity?.trackList?.items || [];
          tracks = trackList.map(t => {
            const itemObj = t.track || t;
            const itemTitle = itemObj.title || itemObj.name || 'Unknown Track';
            const itemArtist = itemObj.subtitle || (itemObj.artists || []).map(a => a.name).join(', ') || '';
            const itemQuery = (itemArtist ? `${itemTitle} ${itemArtist}` : itemTitle).trim();
            const itemArt = itemObj.coverArt?.sources?.[0]?.url || itemObj.album?.coverArt?.sources?.[0]?.url || artworkUrl;
            const spotifyTrackUrl = itemObj.uri ? `https://open.spotify.com/track/${itemObj.uri.split(':').pop()}` : url;
            return {
              title: itemTitle,
              artist: itemArtist,
              query: itemQuery,
              artworkUrl: itemArt || artworkUrl,
              spotifyUrl: spotifyTrackUrl
            };
          }).filter(t => t.title && t.title !== 'Unknown Track');
        } catch (e) {}
      }

      if (tracks.length > 0) {
        return {
          type,
          id,
          title: playlistTitle,
          artworkUrl,
          tracks,
          totalTracks: tracks.length
        };
      }
    }
  } catch (err) {
    console.warn('[SPOTIFY SCRAPER ERROR]', err.message);
  }

  // 2. Fallback to API with pagination support
  const token = await getSpotifyToken();
  if (!token) return null;

  try {
    if (type === 'track') {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();

      const artist = (data.artists || []).map(a => a.name).join(', ');
      const title = data.name;
      const artworkUrl = data.album?.images?.[0]?.url || null;
      const durationMs = data.duration_ms || 180000;
      const query = `${title} ${data.artists?.[0]?.name || ''}`.trim();

      if (artworkUrl) {
        artworkCache.set(id, artworkUrl);
        artworkCache.set(query.toLowerCase(), artworkUrl);
      }

      return {
        type: 'track',
        id,
        title,
        artist,
        query,
        artworkUrl,
        durationMs,
        album: data.album?.name || null,
        spotifyUrl: data.external_urls?.spotify || url
      };
    }

    if (type === 'playlist') {
      const res = await fetch(`https://api.spotify.com/v1/playlists/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      
      const playlistTitle = data.name || 'Spotify Playlist';
      const artworkUrl = data.images?.[0]?.url || null;
      
      let items = data.tracks?.items || [];
      const totalTracks = data.tracks?.total || items.length;
      const limit = 100;

      // Parallel batch-fetch strategy for remaining playlist pages
      if (totalTracks > items.length) {
        const pageOffsets = [];
        const maxLimit = Math.min(totalTracks, 500); // Cap at 500 tracks for optimal render time
        for (let offset = items.length; offset < maxLimit; offset += limit) {
          pageOffsets.push(offset);
        }

        const pageResults = await Promise.all(
          pageOffsets.map(offset =>
            fetch(`https://api.spotify.com/v1/playlists/${id}/tracks?offset=${offset}&limit=${limit}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
              .then(r => r.ok ? r.json() : null)
              .then(pData => pData?.items || [])
              .catch(() => [])
          )
        );

        for (const pageItems of pageResults) {
          items = items.concat(pageItems);
        }
      }

      const tracks = items.map(item => {
        const t = item.track;
        if (!t) return null;
        const itemTitle = t.name || 'Unknown Track';
        const itemArtist = (t.artists || []).map(a => a.name).join(', ') || '';
        const itemQuery = `${itemTitle} ${itemArtist}`.trim();
        return {
          title: itemTitle,
          artist: itemArtist,
          query: itemQuery,
          artworkUrl: t.album?.images?.[0]?.url || artworkUrl,
          spotifyUrl: t.external_urls?.spotify || url
        };
      }).filter(Boolean);

      return {
        type,
        id,
        title: playlistTitle,
        artworkUrl,
        tracks,
        totalTracks: tracks.length
      };
    }

    if (type === 'album') {
      const res = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      
      const playlistTitle = data.name || 'Spotify Album';
      const artworkUrl = data.images?.[0]?.url || null;
      
      let items = data.tracks?.items || [];
      const totalTracks = data.tracks?.total || items.length;
      const limit = 50;

      // Parallel batch-fetch strategy for remaining album pages
      if (totalTracks > items.length) {
        const pageOffsets = [];
        const maxLimit = Math.min(totalTracks, 200);
        for (let offset = items.length; offset < maxLimit; offset += limit) {
          pageOffsets.push(offset);
        }

        const pageResults = await Promise.all(
          pageOffsets.map(offset =>
            fetch(`https://api.spotify.com/v1/albums/${id}/tracks?offset=${offset}&limit=${limit}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
              .then(r => r.ok ? r.json() : null)
              .then(pData => pData?.items || [])
              .catch(() => [])
          )
        );

        for (const pageItems of pageResults) {
          items = items.concat(pageItems);
        }
      }

      const tracks = items.map(t => {
        const itemTitle = t.name || 'Unknown Track';
        const itemArtist = (t.artists || []).map(a => a.name).join(', ') || '';
        const itemQuery = `${itemTitle} ${itemArtist}`.trim();
        return {
          title: itemTitle,
          artist: itemArtist,
          query: itemQuery,
          artworkUrl,
          spotifyUrl: t.external_urls?.spotify || url
        };
      });

      return {
        type,
        id,
        title: playlistTitle,
        artworkUrl,
        tracks,
        totalTracks: tracks.length
      };
    }
  } catch (err) {
    console.error('[SPOTIFY RESOLVER EXCEPTION]', err.message);
  }

  return null;
}

/**
 * Resolve a Spotify query/URL (supports multiple Spotify URLs in one query string)
 */
async function resolveSpotify(url) {
  const matches = parseAllSpotifyUrls(url);
  if (matches.length === 0) return null;

  if (matches.length === 1) {
    return await resolveSingleSpotifyUrl(matches[0]);
  }

  // Handle multiple Spotify URLs provided in a single input!
  const results = await Promise.all(matches.map(m => resolveSingleSpotifyUrl(m)));
  const allTracks = [];
  let firstArtwork = null;
  let firstTitle = 'Spotify Playlist';

  for (const res of results) {
    if (!res) continue;
    if (res.type === 'track') {
      allTracks.push({
        title: res.title,
        artist: res.artist,
        query: res.query,
        artworkUrl: res.artworkUrl,
        spotifyUrl: res.spotifyUrl
      });
      if (!firstArtwork && res.artworkUrl) firstArtwork = res.artworkUrl;
    } else if (res.type === 'playlist' || res.type === 'album') {
      if (res.title) firstTitle = res.title;
      if (Array.isArray(res.tracks)) {
        for (const trk of res.tracks) {
          allTracks.push(trk);
          if (!firstArtwork && trk.artworkUrl) firstArtwork = trk.artworkUrl;
        }
      }
    }
  }

  if (allTracks.length === 0) return null;

  if (allTracks.length === 1) {
    return {
      type: 'track',
      ...allTracks[0]
    };
  }

  return {
    type: 'playlist',
    id: 'multi-spotify',
    title: matches.length > 1 ? `Spotify Queue (${allTracks.length} tracks)` : firstTitle,
    artworkUrl: firstArtwork,
    tracks: allTracks,
    totalTracks: allTracks.length
  };
}

/**
 * Search Spotify for track cover art given song title and artist
 */
async function searchSpotifyArtwork(title, artist = '') {
  if (!title) return null;
  const cleanTitle = title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/ft\..*|feat\..*/i, '')
    .replace(/official\s+(music\s+)?video/i, '')
    .replace(/lyrics?/i, '')
    .trim();

  const cacheKey = `${cleanTitle} ${artist}`.toLowerCase().trim();
  if (artworkCache.has(cacheKey)) {
    return artworkCache.get(cacheKey);
  }

  const token = await getSpotifyToken();
  if (!token) return null;

  try {
    const q = artist ? `track:${cleanTitle} artist:${artist}` : cleanTitle;
    const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      const firstTrack = data.tracks?.items?.[0];
      const img = firstTrack?.album?.images?.[0]?.url;
      if (img) {
        artworkCache.set(cacheKey, img);
        return img;
      }
    }

    // Fallback search with broader term
    if (artist) {
      const fallbackRes = await fetch(`https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(`${cleanTitle} ${artist}`)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        const firstTrack = data.tracks?.items?.[0];
        const img = firstTrack?.album?.images?.[0]?.url;
        if (img) {
          artworkCache.set(cacheKey, img);
          return img;
        }
      }
    }
  } catch (err) {
    // Non-fatal
  }

  return null;
}

/**
 * Universal synchronous track artwork extractor
 * Detects direct artworkUrl, YouTube video ID thumbnails, Spotify cache, and custom user data
 */
function getTrackArtwork(track) {
  if (!track) return null;

  // 1. Direct properties
  if (track.artworkUrl) return track.artworkUrl;
  if (track.thumbnail) return track.thumbnail;
  if (track.spotifyArtwork) return track.spotifyArtwork;
  if (track.info?.artworkUrl) return track.info.artworkUrl;
  if (track.info?.thumbnail) return track.info.thumbnail;
  if (track.userData?.artwork) return track.userData.artwork;

  const uri = track.info?.uri || track.uri || '';
  const identifier = track.info?.identifier || track.identifier || '';
  const sourceName = (track.info?.sourceName || track.sourceName || '').toLowerCase();

  // 2. YouTube identifier: standard 11-char alphanumeric string
  if (
    identifier &&
    /^[a-zA-Z0-9_-]{11}$/.test(identifier) &&
    (sourceName.includes('youtube') || sourceName === 'ytmsearch' || sourceName === 'ytsearch' || !sourceName)
  ) {
    return `https://i.ytimg.com/vi/${identifier}/hqdefault.jpg`;
  }

  // 3. YouTube URL extraction
  const ytMatch = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.exec(uri);
  if (ytMatch && ytMatch[1]) {
    return `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  // 4. Spotify identifier cached
  if (identifier && artworkCache.has(identifier)) {
    return artworkCache.get(identifier);
  }

  // 5. Title/Author cached
  const title = track.info?.title || track.title || '';
  if (title) {
    const key = title.toLowerCase().trim();
    if (artworkCache.has(key)) return artworkCache.get(key);
  }

  return null;
}

/**
 * Universal asynchronous track artwork resolver
 * Resolves synchronous artwork first; if null, queries Spotify Web API to find official album cover
 */
async function resolveTrackArtworkAsync(track) {
  const fast = getTrackArtwork(track);
  if (fast) return fast;

  const title = track.info?.title || track.title || '';
  const author = track.info?.author || track.author || '';

  if (title) {
    const spArt = await searchSpotifyArtwork(title, author);
    if (spArt) {
      if (track.info) track.info.artworkUrl = spArt;
      track.artworkUrl = spArt;
      return spArt;
    }
  }

  return null;
}

module.exports = {
  isSpotifyUrl,
  parseSpotifyUrl,
  resolveSpotify,
  searchSpotifyArtwork,
  getTrackArtwork,
  resolveTrackArtworkAsync,
  getSpotifyToken
};
