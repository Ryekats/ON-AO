/**
 * On Ao Discord Music Bot - Lyrics Scraper & Provider
 * Fetches lyrics from LRCLIB and LyricsOVH with clean title formatting
 */

async function fetchSongLyrics(rawTitle, rawArtist = '') {
  if (!rawTitle) return null;

  const cleanTitle = String(rawTitle)
    .replace(/\s*[\(\[](official\s*(music\s*)?video|official\s*audio|lyrics?|lyric\s*video|mv|audio|remix|hd|4k|1080p|visualizer|clip\s*officiel)[\)\]]/gi, '')
    .replace(/\s*[\(\[]ft\.?.*[\)\]]/gi, '')
    .replace(/\s*[\(\[]feat\.?.*[\)\]]/gi, '')
    .replace(/\|\s*.*$/g, '')
    .trim();

  const cleanArtist = String(rawArtist || '')
    .replace(/ - Topic/gi, '')
    .replace(/VEVO/gi, '')
    .replace(/Unknown Artist|Discord User|Streaming Audio/gi, '')
    .trim();

  const parseLrcText = (item) => {
    if (!item) return null;
    if (item.plainLyrics && item.plainLyrics.trim().length > 15) {
      return item.plainLyrics.trim();
    }
    if (item.syncedLyrics && item.syncedLyrics.trim().length > 15) {
      return item.syncedLyrics.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
    }
    return null;
  };

  // 1. Direct LRCLIB get by track_name & artist_name
  if (cleanArtist) {
    try {
      const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'OnAoMusicBot/2.0' } });
      if (res.ok) {
        const data = await res.json();
        const lyrics = parseLrcText(data);
        if (lyrics) {
          return {
            title: data.trackName || cleanTitle,
            artist: data.artistName || cleanArtist,
            lyrics,
            album: data.albumName || null,
            source: 'LRCLIB'
          };
        }
      }
    } catch (e) {}
  }

  // 2. LRCLIB Search with Title + Artist
  try {
    const q = cleanArtist ? `${cleanTitle} ${cleanArtist}` : cleanTitle;
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'OnAoMusicBot/2.0' } });
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const lyrics = parseLrcText(item);
          if (lyrics) {
            return {
              title: item.trackName || cleanTitle,
              artist: item.artistName || cleanArtist || 'Artist',
              lyrics,
              album: item.albumName || null,
              source: 'LRCLIB'
            };
          }
        }
      }
    }
  } catch (e) {}

  // 3. LRCLIB Search with Title only
  try {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'OnAoMusicBot/2.0' } });
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const lyrics = parseLrcText(item);
          if (lyrics) {
            return {
              title: item.trackName || cleanTitle,
              artist: item.artistName || 'Artist',
              lyrics,
              album: item.albumName || null,
              source: 'LRCLIB'
            };
          }
        }
      }
    }
  } catch (e) {}

  // 4. LyricsOVH Fallback
  if (cleanArtist) {
    try {
      const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`;
      const res = await fetch(ovhUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.lyrics && data.lyrics.trim().length > 20) {
          return {
            title: cleanTitle,
            artist: cleanArtist,
            lyrics: data.lyrics.trim(),
            album: null,
            source: 'LyricsOVH'
          };
        }
      }
    } catch (e) {}
  }

  // 5. Title with " - " split
  if (cleanTitle.includes(' - ')) {
    const [p1, p2] = cleanTitle.split(' - ').map(s => s.trim());
    if (p1 && p2) {
      try {
        const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(p1)}/${encodeURIComponent(p2)}`;
        const res = await fetch(ovhUrl);
        if (res.ok) {
          const data = await res.json();
          if (data && data.lyrics && data.lyrics.trim().length > 20) {
            return {
              title: p2,
              artist: p1,
              lyrics: data.lyrics.trim(),
              album: null,
              source: 'LyricsOVH'
            };
          }
        }
      } catch (e) {}
    }
  }

  return null;
}

module.exports = {
  fetchSongLyrics
};
