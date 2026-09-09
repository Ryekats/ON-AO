/**
 * On Ao Discord Music Bot - Profile Card Canvas Generator
 * Professional rendition of Discord Music profile card with world-class typography,
 * custom color themes (Red, Blue, Pink, Orange, Hex), custom background image,
 * privacy controls (Hidden Tracks, Servers, Friends), and fancy unicode font normalization.
 */
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// Try registering standard fonts if available
try {
  const fontPaths = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'
  ];
  for (const fp of fontPaths) {
    if (fs.existsSync(fp)) {
      GlobalFonts.registerFromPath(fp, 'OnAoFont');
      break;
    }
  }
} catch (e) {}

/**
 * Clean & normalize aesthetic / fancy Unicode math alphanumeric fonts often used in Discord server names
 * Supports: Bold, Italic, Script, Fraktur, Double-struck, Sans-serif, Fullwidth, Circled, and Math Digits
 * Falls back to "©©©" for unreadable, broken glyphs, or corrupted unicode sequences.
 */
function cleanFancyUnicode(str) {
  if (!str || typeof str !== 'string') return '©©©';
  let res = '';
  
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    // If surrogate pair, skip the second code unit in length iteration
    if (cp > 0xFFFF) i++;

    // Math Bold capital A-Z (0x1D400 - 0x1D419)
    if (cp >= 0x1D400 && cp <= 0x1D419) res += String.fromCharCode(65 + cp - 0x1D400);
    // Math Bold small a-z (0x1D41A - 0x1D433)
    else if (cp >= 0x1D41A && cp <= 0x1D433) res += String.fromCharCode(97 + cp - 0x1D41A);
    // Math Italic A-Z (0x1D434 - 0x1D44D)
    else if (cp >= 0x1D434 && cp <= 0x1D44D) res += String.fromCharCode(65 + cp - 0x1D434);
    // Math Italic a-z (0x1D44E - 0x1D467)
    else if (cp >= 0x1D44E && cp <= 0x1D467) res += String.fromCharCode(97 + cp - 0x1D44E);
    // Math Bold Italic A-Z (0x1D468 - 0x1D481)
    else if (cp >= 0x1D468 && cp <= 0x1D481) res += String.fromCharCode(65 + cp - 0x1D468);
    // Math Bold Italic a-z (0x1D482 - 0x1D49B)
    else if (cp >= 0x1D482 && cp <= 0x1D49B) res += String.fromCharCode(97 + cp - 0x1D482);
    // Script A-Z (0x1D49C - 0x1D4B5)
    else if (cp >= 0x1D49C && cp <= 0x1D4B5) res += String.fromCharCode(65 + cp - 0x1D49C);
    // Script a-z (0x1D4B6 - 0x1D4CF)
    else if (cp >= 0x1D4B6 && cp <= 0x1D4CF) res += String.fromCharCode(97 + cp - 0x1D4B6);
    // Bold Script A-Z (0x1D4D0 - 0x1D4E9)
    else if (cp >= 0x1D4D0 && cp <= 0x1D4E9) res += String.fromCharCode(65 + cp - 0x1D4D0);
    // Bold Script a-z (0x1D4EA - 0x1D503)
    else if (cp >= 0x1D4EA && cp <= 0x1D503) res += String.fromCharCode(97 + cp - 0x1D4EA);
    // Fraktur A-Z (0x1D504 - 0x1D51D)
    else if (cp >= 0x1D504 && cp <= 0x1D51D) res += String.fromCharCode(65 + cp - 0x1D504);
    // Fraktur a-z (0x1D51E - 0x1D537)
    else if (cp >= 0x1D51E && cp <= 0x1D537) res += String.fromCharCode(97 + cp - 0x1D51E);
    // Bold Fraktur A-Z (0x1D56C - 0x1D585)
    else if (cp >= 0x1D56C && cp <= 0x1D585) res += String.fromCharCode(65 + cp - 0x1D56C);
    // Bold Fraktur a-z (0x1D586 - 0x1D59F)
    else if (cp >= 0x1D586 && cp <= 0x1D59F) res += String.fromCharCode(97 + cp - 0x1D586);
    // Double struck A-Z (0x1D538 - 0x1D551)
    else if (cp >= 0x1D538 && cp <= 0x1D551) res += String.fromCharCode(65 + cp - 0x1D538);
    // Double struck a-z (0x1D552 - 0x1D56B)
    else if (cp >= 0x1D552 && cp <= 0x1D56B) res += String.fromCharCode(97 + cp - 0x1D552);
    // Sans-serif A-Z (0x1D5A0 - 0x1D5B9)
    else if (cp >= 0x1D5A0 && cp <= 0x1D5B9) res += String.fromCharCode(65 + cp - 0x1D5A0);
    // Sans-serif a-z (0x1D5BA - 0x1D5D3)
    else if (cp >= 0x1D5BA && cp <= 0x1D5D3) res += String.fromCharCode(97 + cp - 0x1D5BA);
    // Sans-serif Bold A-Z (0x1D5D4 - 0x1D5ED)
    else if (cp >= 0x1D5D4 && cp <= 0x1D5ED) res += String.fromCharCode(65 + cp - 0x1D5D4);
    // Sans-serif Bold a-z (0x1D5EE - 0x1D607)
    else if (cp >= 0x1D5EE && cp <= 0x1D607) res += String.fromCharCode(97 + cp - 0x1D5EE);
    // Fullwidth A-Z (0xFF21 - 0xFF3A)
    else if (cp >= 0xFF21 && cp <= 0xFF3A) res += String.fromCharCode(65 + cp - 0xFF21);
    // Fullwidth a-z (0xFF41 - 0xFF5A)
    else if (cp >= 0xFF41 && cp <= 0xFF5A) res += String.fromCharCode(97 + cp - 0xFF41);
    // Circled A-Z (0x24B6 - 0x24CF)
    else if (cp >= 0x24B6 && cp <= 0x24CF) res += String.fromCharCode(65 + cp - 0x24B6);
    // Circled a-z (0x24D0 - 0x24E9)
    else if (cp >= 0x24D0 && cp <= 0x24E9) res += String.fromCharCode(97 + cp - 0x24D0);
    // Math Digits 0-9 (Bold, Double-Struck, Sans-Serif, Monospace)
    else if (cp >= 0x1D7CE && cp <= 0x1D7D7) res += String.fromCharCode(48 + cp - 0x1D7CE);
    else if (cp >= 0x1D7D8 && cp <= 0x1D7E1) res += String.fromCharCode(48 + cp - 0x1D7D8);
    else if (cp >= 0x1D7E2 && cp <= 0x1D7EB) res += String.fromCharCode(48 + cp - 0x1D7E2);
    else if (cp >= 0x1D7EC && cp <= 0x1D7F5) res += String.fromCharCode(48 + cp - 0x1D7EC);
    else if (cp >= 0x1D7F6 && cp <= 0x1D7FF) res += String.fromCharCode(48 + cp - 0x1D7F6);
    // Fullwidth Digits 0-9 (0xFF10 - 0xFF19)
    else if (cp >= 0xFF10 && cp <= 0xFF19) res += String.fromCharCode(48 + cp - 0xFF10);
    // Standard ASCII Printable (space to ~)
    else if (cp >= 0x20 && cp <= 0x7E) {
      res += String.fromCharCode(cp);
    }
    // Latin-1 Supplement & Common punctuation / Symbols (e.g. •, ©, ®, ™, etc.)
    else if ((cp >= 0xA0 && cp <= 0xFF) || cp === 0x2022 || cp === 0x2013 || cp === 0x2014 || cp === 0x00A9) {
      res += String.fromCodePoint(cp);
    }
    // Broken / Unreadable / Replacement Character (\uFFFD or unprintable)
    else if (cp === 0xFFFD || cp < 0x20 || (cp >= 0x7F && cp < 0xA0)) {
      res += '©©©';
    }
    else {
      // Safe unicode pass-through with valid character check
      try {
        const charStr = String.fromCodePoint(cp);
        res += charStr;
      } catch (e) {
        res += '©©©';
      }
    }
  }

  const trimmed = res.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : '©©©';
}

/**
 * Format duration as readable time (e.g. "4d 21h", "5d 3h", "11h 5m", "5h 41m", "12m 30s", "45s", "0m")
 */
function formatDurationOnAo(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  if (s >= 86400) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    return `${d}d ${h}h`;
  }
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const remS = s % 60;
    return remS > 0 ? `${m}m ${remS}s` : `${m}m`;
  }
  if (s > 0) {
    return `${s}s`;
  }
  return '0m';
}

/**
 * Helper to draw rounded rectangles
 */
function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Helper to truncate text with ellipsis if exceeding max width
 */
function truncateText(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.trim() + '...';
}

/**
 * Color Theme Presets for On Ao Music Bot:
 * Vibrant, rich base tones (never pitch dark or muddy black)
 */
const COLOR_PRESETS = {
  red: {
    name: 'Merah (Red)',
    primary: '#e11d48',
    pill: '#8a2432',
    pillText: '#ffffff',
    gradient: ['#6a1a24', '#52131b', '#3d0c13', '#28070d'],
    glow: 'rgba(225, 29, 72, 0.28)',
    cardBg: 'rgba(25, 6, 10, 0.52)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    rankPillBg: 'rgba(255, 255, 255, 0.07)'
  },
  blue: {
    name: 'Biru (Blue)',
    primary: '#3b82f6',
    pill: '#2563eb',
    pillText: '#ffffff',
    gradient: ['#1e3a8a', '#172554', '#1e293b', '#0f172a'],
    glow: 'rgba(59, 130, 246, 0.28)',
    cardBg: 'rgba(15, 23, 42, 0.52)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    rankPillBg: 'rgba(255, 255, 255, 0.07)'
  },
  pink: {
    name: 'Merah Muda (Pink)',
    primary: '#ec4899',
    pill: '#db2777',
    pillText: '#ffffff',
    gradient: ['#831843', '#500724', '#3d051c', '#240210'],
    glow: 'rgba(236, 72, 153, 0.28)',
    cardBg: 'rgba(30, 4, 15, 0.52)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    rankPillBg: 'rgba(255, 255, 255, 0.07)'
  },
  orange: {
    name: 'Oranye (Orange)',
    primary: '#f97316',
    pill: '#ea580c',
    pillText: '#ffffff',
    gradient: ['#7c2d12', '#541c0a', '#3c1306', '#250b03'],
    glow: 'rgba(249, 115, 22, 0.28)',
    cardBg: 'rgba(30, 10, 4, 0.52)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    rankPillBg: 'rgba(255, 255, 255, 0.07)'
  },
  purple: {
    name: 'Ungu (Purple)',
    primary: '#a855f7',
    pill: '#9333ea',
    pillText: '#ffffff',
    gradient: ['#581c87', '#3b0764', '#2a0448', '#1a022d'],
    glow: 'rgba(168, 85, 247, 0.28)',
    cardBg: 'rgba(25, 4, 40, 0.52)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    rankPillBg: 'rgba(255, 255, 255, 0.07)'
  },
  green: {
    name: 'Hijau (Green)',
    primary: '#10b981',
    pill: '#059669',
    pillText: '#ffffff',
    gradient: ['#065f46', '#064e3b', '#042f24', '#021a14'],
    glow: 'rgba(16, 185, 129, 0.28)',
    cardBg: 'rgba(4, 30, 22, 0.52)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    rankPillBg: 'rgba(255, 255, 255, 0.07)'
  },
  cyan: {
    name: 'Cyan (Aqua)',
    primary: '#06b6d4',
    pill: '#0891b2',
    pillText: '#ffffff',
    gradient: ['#155e75', '#0e3f4f', '#092b36', '#051920'],
    glow: 'rgba(6, 182, 212, 0.28)',
    cardBg: 'rgba(6, 35, 45, 0.52)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    rankPillBg: 'rgba(255, 255, 255, 0.07)'
  },
  yellow: {
    name: 'Kuning (Yellow)',
    primary: '#eab308',
    pill: '#d97706',
    pillText: '#000000',
    gradient: ['#713f12', '#502c0b', '#3a2007', '#221203'],
    glow: 'rgba(234, 179, 8, 0.28)',
    cardBg: 'rgba(35, 18, 4, 0.52)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    rankPillBg: 'rgba(255, 255, 255, 0.07)'
  }
};

/**
 * Resolve theme color configurations from name or custom hex code
 */
function resolveThemeConfig(colorInput = 'red') {
  const clean = String(colorInput || 'red').toLowerCase().trim();

  if (clean === 'red' || clean === 'merah' || clean === 'crimson') return COLOR_PRESETS.red;
  if (clean === 'blue' || clean === 'biru' || clean === 'ocean') return COLOR_PRESETS.blue;
  if (clean === 'pink' || clean === 'merah muda' || clean === 'merahmuda' || clean === 'rose') return COLOR_PRESETS.pink;
  if (clean === 'orange' || clean === 'oranye' || clean === 'jingga' || clean === 'amber') return COLOR_PRESETS.orange;
  if (clean === 'purple' || clean === 'ungu' || clean === 'violet') return COLOR_PRESETS.purple;
  if (clean === 'green' || clean === 'hijau' || clean === 'emerald') return COLOR_PRESETS.green;
  if (clean === 'cyan' || clean === 'aqua') return COLOR_PRESETS.cyan;
  if (clean === 'yellow' || clean === 'kuning') return COLOR_PRESETS.yellow;

  // Custom Hex pattern: #RRGGBB or #RGB
  const hexMatch = clean.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i) ||
                   clean.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);

  if (hexMatch) {
    let r, g, b;
    if (hexMatch[1].length === 1) {
      r = parseInt(hexMatch[1] + hexMatch[1], 16);
      g = parseInt(hexMatch[2] + hexMatch[2], 16);
      b = parseInt(hexMatch[3] + hexMatch[3], 16);
    } else {
      r = parseInt(hexMatch[1], 16);
      g = parseInt(hexMatch[2], 16);
      b = parseInt(hexMatch[3], 16);
    }
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

    return {
      name: `Custom (${hex})`,
      primary: hex,
      pill: hex,
      pillText: (r * 0.299 + g * 0.587 + b * 0.114) > 160 ? '#000000' : '#ffffff',
      gradient: [
        `rgba(${Math.floor(r * 0.45)}, ${Math.floor(g * 0.45)}, ${Math.floor(b * 0.45)}, 1)`,
        `rgba(${Math.floor(r * 0.32)}, ${Math.floor(g * 0.32)}, ${Math.floor(b * 0.32)}, 1)`,
        `rgba(${Math.floor(r * 0.22)}, ${Math.floor(g * 0.22)}, ${Math.floor(b * 0.22)}, 1)`,
        `rgba(${Math.floor(r * 0.14)}, ${Math.floor(g * 0.14)}, ${Math.floor(b * 0.14)}, 1)`
      ],
      glow: `rgba(${r}, ${g}, ${b}, 0.28)`,
      cardBg: `rgba(${Math.floor(r * 0.15)}, ${Math.floor(g * 0.15)}, ${Math.floor(b * 0.15)}, 0.52)`,
      cardBorder: 'rgba(255, 255, 255, 0.08)',
      rankPillBg: 'rgba(255, 255, 255, 0.07)'
    };
  }

  // Fallback to default red
  return COLOR_PRESETS.red;
}

/**
 * Generate On Ao Music Profile Card Image Buffer
 */
async function generateOnAoProfileCard(arg1, arg2 = {}) {
  let opts = {};
  if (arg1 && typeof arg1 === 'object') {
    if (arg1.username && (arg1.servers !== undefined || arg1.friends !== undefined || arg1.tracks !== undefined || arg1.songs !== undefined)) {
      opts = { ...arg1 };
    } else {
      const targetUser = arg1;
      const rawProfile = arg2 || {};
      opts = {
        username: targetUser.username || rawProfile.username,
        avatarUrl: targetUser.displayAvatarURL ? targetUser.displayAvatarURL({ extension: 'png', size: 256 }) : (rawProfile.avatarUrl || null),
        servers: rawProfile.servers,
        friends: rawProfile.friends,
        tracks: rawProfile.tracks,
        favSong: rawProfile.favSong,
        favCount: rawProfile.favCount,
        totalHours: Math.round(((rawProfile.seconds || 0) / 3600) * 10) / 10,
        lang: rawProfile.lang || 'id',
        color: rawProfile.color,
        background: rawProfile.background,
        privacy: rawProfile.privacy,
        isOwner: rawProfile.isOwner
      };
    }
  }

  const username = opts.username || 'User';
  const avatarUrl = opts.avatarUrl || null;
  const lang = opts.lang || 'id';
  const isIndo = lang === 'id';
  const isOwner = Boolean(opts.isOwner);

  // Theme & Visual Customization
  const theme = resolveThemeConfig(opts.color || 'red');
  const bgImageSource = opts.background || null;

  // Privacy Settings (Public vs Private)
  const privacy = {
    servers: (opts.privacy?.servers || 'public').toLowerCase() === 'private' ? 'private' : 'public',
    friends: (opts.privacy?.friends || 'public').toLowerCase() === 'private' ? 'private' : 'public',
    tracks: (opts.privacy?.tracks || 'public').toLowerCase() === 'private' ? 'private' : 'public'
  };

  // 1. Normalize servers
  let normalizedServers = [];
  if (Array.isArray(opts.servers)) {
    normalizedServers = opts.servers.map(s => ({
      name: cleanFancyUnicode(s.name || s.title || 'Server'),
      originalName: s.name || s.title || 'Server',
      durationSec: Number(s.durationSec || s.seconds || 0)
    }));
  } else if (opts.servers && typeof opts.servers === 'object') {
    normalizedServers = Object.entries(opts.servers).map(([name, sec]) => ({
      name: cleanFancyUnicode(name),
      originalName: name,
      durationSec: Number(sec) || 0
    })).sort((a, b) => b.durationSec - a.durationSec);
  }

  // 2. Normalize friends
  let normalizedFriends = [];
  if (Array.isArray(opts.friends)) {
    normalizedFriends = opts.friends.map(f => ({
      name: cleanFancyUnicode(f.name || f.username || 'Friend'),
      originalName: f.name || f.username || 'Friend',
      durationSec: Number(f.durationSec || f.seconds || 0)
    }));
  } else if (opts.friends && typeof opts.friends === 'object') {
    normalizedFriends = Object.entries(opts.friends).map(([u, sec]) => ({
      name: cleanFancyUnicode(u),
      originalName: u,
      durationSec: Number(sec) || 0
    })).sort((a, b) => b.durationSec - a.durationSec);
  }

  // 3. Normalize tracks
  let normalizedTracks = [];
  if (Array.isArray(opts.tracks)) {
    normalizedTracks = opts.tracks.map(t => ({
      name: cleanFancyUnicode(t.title || t.name || 'Unknown Track'),
      originalName: t.title || t.name || 'Unknown Track',
      durationSec: Number(t.durationSec || t.seconds || 0),
      count: t.count || 1
    }));
  } else if (opts.tracks && typeof opts.tracks === 'object') {
    normalizedTracks = Object.values(opts.tracks).map(t => ({
      name: cleanFancyUnicode(t.title || 'Unknown Track'),
      originalName: t.title || 'Unknown Track',
      durationSec: Number(t.seconds) || 0,
      count: t.count || 1
    })).sort((a, b) => b.durationSec - a.durationSec);
  }

  if (normalizedTracks.length === 0 && opts.favSong) {
    normalizedTracks.push({
      name: cleanFancyUnicode(opts.favSong),
      originalName: opts.favSong,
      durationSec: Number(opts.seconds || 0),
      count: opts.favCount || 1
    });
  }

  // Enlarge Canvas to 1400 x 940 for high definition readability
  const WIDTH = 1400;
  const HEIGHT = 940;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;

  // 1. BASE BACKGROUND (Image or Gradient)
  let bgDrawn = false;
  if (bgImageSource && typeof bgImageSource === 'string') {
    try {
      const bgImg = await loadImage(bgImageSource);

      const imgRatio = bgImg.width / bgImg.height;
      const canvasRatio = WIDTH / HEIGHT;
      let drawW = WIDTH;
      let drawH = HEIGHT;
      let drawX = 0;
      let drawY = 0;

      if (imgRatio > canvasRatio) {
        drawH = HEIGHT;
        drawW = HEIGHT * imgRatio;
        drawX = (WIDTH - drawW) / 2;
      } else {
        drawW = WIDTH;
        drawH = WIDTH / imgRatio;
        drawY = (HEIGHT - drawH) / 2;
      }

      ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);

      // Clean neutral dark gradient overlay to preserve wallpaper detail
      const cleanDarkOverlay = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      cleanDarkOverlay.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
      cleanDarkOverlay.addColorStop(0.4, 'rgba(0, 0, 0, 0.30)');
      cleanDarkOverlay.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
      ctx.fillStyle = cleanDarkOverlay;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      bgDrawn = true;
    } catch (e) {
      // Fallback
    }
  }

  if (!bgDrawn) {
    // Rich, warm, non-dark base gradient
    const bgGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bgGradient.addColorStop(0, theme.gradient[0]);
    bgGradient.addColorStop(0.35, theme.gradient[1]);
    bgGradient.addColorStop(0.7, theme.gradient[2]);
    bgGradient.addColorStop(1, theme.gradient[3]);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Subtle radial glow behind avatar
    const radialGlow = ctx.createRadialGradient(180, 130, 10, 180, 130, 480);
    radialGlow.addColorStop(0, theme.glow);
    radialGlow.addColorStop(0.6, 'rgba(0, 0, 0, 0.08)');
    radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // 3. BACKGROUND MUSIC WATERMARKS (Treble Clef & Musical Notes)
  ctx.save();
  ctx.strokeStyle = bgDrawn ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.05)';
  ctx.fillStyle = bgDrawn ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 20;

  // Treble clef curve in background
  ctx.beginPath();
  ctx.moveTo(380, 20);
  ctx.bezierCurveTo(460, 110, 580, 180, 550, 310);
  ctx.bezierCurveTo(500, 440, 340, 500, 320, 660);
  ctx.bezierCurveTo(290, 810, 430, 830, 510, 760);
  ctx.stroke();

  // Floating note heads
  const noteCircles = [
    { x: 570, y: 100, r: 36 },
    { x: 1040, y: 130, r: 50 },
    { x: 1220, y: 340, r: 38 },
    { x: 170, y: 740, r: 56 },
    { x: 910, y: 780, r: 46 }
  ];
  noteCircles.forEach(pt => {
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y, pt.r * 1.3, pt.r, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();

  // 4. TOP RIGHT ON AO MUSIC BRAND BADGE
  const badgeText = 'ON AO MUSIC';
  ctx.font = 'bold 32px sans-serif';
  const badgeWidth = 280;
  const badgeHeight = 64;
  const badgeX = WIDTH - badgeWidth - 52;
  const badgeY = 38;

  ctx.save();
  roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 10);
  if (bgDrawn) {
    ctx.fillStyle = 'rgba(15, 18, 26, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.fillStyle = theme.pill;
    ctx.fill();
    ctx.fillStyle = theme.pillText;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
  ctx.restore();

  // 5. USER AVATAR (Enlarged 170px diameter)
  const avatarX = 52;
  const avatarY = 40;
  const avatarRadius = 85;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius + 4, 0, Math.PI * 2);
  ctx.fillStyle = bgDrawn ? 'rgba(255, 255, 255, 0.40)' : 'rgba(255, 255, 255, 0.20)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  let avatarLoaded = false;
  if (avatarUrl) {
    try {
      const avatarImg = await loadImage(avatarUrl);
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarRadius * 2, avatarRadius * 2);
      avatarLoaded = true;
    } catch (e) {}
  }

  if (!avatarLoaded) {
    const avGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + 170, avatarY + 170);
    avGrad.addColorStop(0, bgDrawn ? '#334155' : theme.primary);
    avGrad.addColorStop(1, '#111827');
    ctx.fillStyle = avGrad;
    ctx.fillRect(avatarX, avatarY, avatarRadius * 2, avatarRadius * 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((username || 'U')[0].toUpperCase(), avatarX + avatarRadius, avatarY + avatarRadius);
  }
  ctx.restore();

  // 6. USERNAME (Enlarged 58px Bold Font)
  const userTextX = avatarX + avatarRadius * 2 + 36;
  const userTextY = avatarY + 54;

  ctx.save();
  ctx.font = 'bold 58px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 4;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const cleanUsername = cleanFancyUnicode(String(username || 'User')).replace(/^@/, '');
  const displayUser = truncateText(ctx, cleanUsername, WIDTH - userTextX - badgeWidth - 70);
  ctx.fillText(displayUser, userTextX, userTextY);
  ctx.restore();

  // 7. PLATFORM ICONS BELOW USERNAME
  const iconY = userTextY + 54;
  const iconRadius = 21;
  const iconPillBg = bgDrawn ? 'rgba(15, 18, 26, 0.85)' : theme.pill;
  const iconBorderColor = bgDrawn ? 'rgba(255, 255, 255, 0.25)' : null;

  // Icon 1: Spotify waves pill
  ctx.save();
  ctx.beginPath();
  ctx.arc(userTextX + 21, iconY, iconRadius, 0, Math.PI * 2);
  ctx.fillStyle = iconPillBg;
  ctx.fill();
  if (iconBorderColor) {
    ctx.strokeStyle = iconBorderColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  [-4, 0, 4].forEach((offset, idx) => {
    ctx.beginPath();
    const r = 12 - idx * 2.2;
    ctx.arc(userTextX + 20, iconY + offset + 3, r, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
  });
  ctx.restore();

  // Icon 2: Equalizer bars pill
  ctx.save();
  ctx.beginPath();
  ctx.arc(userTextX + 74, iconY, iconRadius, 0, Math.PI * 2);
  ctx.fillStyle = iconPillBg;
  ctx.fill();
  if (iconBorderColor) {
    ctx.strokeStyle = iconBorderColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  const barHeights = [10, 18, 25, 16, 10];
  barHeights.forEach((bh, idx) => {
    const bx = userTextX + 62 + idx * 5.8;
    const by = iconY - bh / 2;
    ctx.fillRect(bx, by, 3.2, bh);
  });
  ctx.restore();

  // Icon 3: Music Note pill
  ctx.save();
  ctx.beginPath();
  ctx.arc(userTextX + 126, iconY, iconRadius, 0, Math.PI * 2);
  ctx.fillStyle = iconPillBg;
  ctx.fill();
  if (iconBorderColor) {
    ctx.strokeStyle = iconBorderColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  const nx = userTextX + 116;
  const ny = iconY + 3;
  ctx.beginPath();
  ctx.ellipse(nx, ny, 4.8, 3.4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(nx + 12.5, ny - 2, 4.8, 3.4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(nx + 2.8, ny - 16, 2.8, 16);
  ctx.fillRect(nx + 15.2, ny - 18, 2.8, 16);
  ctx.beginPath();
  ctx.moveTo(nx + 2.8, ny - 16);
  ctx.lineTo(nx + 18, ny - 18);
  ctx.lineTo(nx + 18, ny - 14.5);
  ctx.lineTo(nx + 2.8, ny - 12.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ==================== PRIVACY DATA PROCESSOR ====================
  function buildDisplayItems(rawList, emptyPlaceholders, isPrivate, hiddenLabel) {
    const result = [];
    const valid = (Array.isArray(rawList) ? rawList : []).filter(item => item && item.name && item.name !== '-' && (Number(item.durationSec) > 0 || Number(item.count) > 0));

    for (let i = 0; i < 3; i++) {
      if (valid[i]) {
        const isHidden = isPrivate && !isOwner;
        const nameToUse = isHidden ? hiddenLabel : valid[i].name;

        result.push({
          isReal: true,
          isHidden,
          durationSec: Number(valid[i].durationSec) || 0,
          name: nameToUse,
          rawName: valid[i].name
        });
      } else {
        result.push({
          isReal: false,
          isHidden: false,
          durationSec: 0,
          name: emptyPlaceholders[i] || '-'
        });
      }
    }
    return result;
  }

  const serverPlaceholders = isIndo
    ? ['Belum ada riwayat server', '-', '-']
    : ['No server history yet', '-', '-'];

  const friendPlaceholders = isIndo
    ? ['Belum ada teman di voice', 'Dengar bareng teman di voice', '-']
    : ['No friends in voice yet', 'Listen together in voice', '-'];

  const trackPlaceholders = isIndo
    ? ['Belum ada lagu diputar', 'Putar lagu dengan "on play"', '-']
    : ['No tracks played yet', 'Play with "on play <title>"', '-'];

  const hiddenServerLabel = isIndo ? '🔒 Server Tersembunyi' : '🔒 Hidden Server';
  const hiddenFriendLabel = isIndo ? '🔒 Teman Tersembunyi' : '🔒 Hidden Friend';
  const hiddenTrackLabel = isIndo ? '🔒 Trek Tersembunyi' : '🔒 Hidden Track';

  const finalServers = buildDisplayItems(normalizedServers, serverPlaceholders, privacy.servers === 'private', hiddenServerLabel);
  const finalFriends = buildDisplayItems(normalizedFriends, friendPlaceholders, privacy.friends === 'private', hiddenFriendLabel);
  const finalTracks = buildDisplayItems(normalizedTracks, trackPlaceholders, privacy.tracks === 'private', hiddenTrackLabel);

  // Card Drawer Helper with Enlarged 32px Bold Typography
  function drawCardBox(x, y, w, h, title, items, isSectionPrivate = false) {
    ctx.save();
    // Card Box Background (clean, smooth translucent panel, not pitch black)
    roundRect(ctx, x, y, w, h, 14);
    if (bgDrawn) {
      ctx.fillStyle = 'rgba(10, 14, 22, 0.65)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      ctx.fillStyle = theme.cardBg;
      ctx.fill();
      ctx.strokeStyle = theme.cardBorder;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Card Header Title (32px Bold)
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 3;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let displayTitle = title;
    if (isSectionPrivate) {
      displayTitle += isIndo ? ' [🔒 PRIVAT]' : ' [🔒 PRIVATE]';
    }
    ctx.fillText(displayTitle, x + 30, y + 24);

    // 3 Ranked Rows (Spacious layout, 32px Bold fonts)
    const rowStartY = y + 78;
    const rowHeight = 68;

    items.forEach((item, idx) => {
      const rowY = rowStartY + idx * rowHeight;
      const rank = idx + 1;
      const pillSize = 46;
      const pillX = x + 30;
      const pillY = rowY + 2;

      // Rank Pill (32px Bold Number)
      ctx.save();
      roundRect(ctx, pillX, pillY, pillSize, pillSize, 10);
      if (bgDrawn) {
        if (item.isReal && rank === 1) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.50)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = 'rgba(15, 20, 30, 0.70)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = item.isReal ? '#e2e8f0' : '#64748b';
        }
      } else {
        if (item.isReal && rank === 1) {
          ctx.fillStyle = theme.pill;
          ctx.fill();
          ctx.fillStyle = theme.pillText;
        } else {
          ctx.fillStyle = theme.rankPillBg;
          ctx.fill();
          ctx.strokeStyle = theme.cardBorder;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = item.isReal ? '#e2e8f0' : '#64748b';
        }
      }
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(rank), pillX + pillSize / 2, pillY + pillSize / 2);
      ctx.restore();

      // Text Row: "<duration> • <name>" (Direct clean text with NO background box/shadow)
      const textX = pillX + pillSize + 20;
      const textY = pillY + pillSize / 2;

      ctx.save();
      if (item.isReal) {
        const durStr = formatDurationOnAo(item.durationSec);
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(durStr, textX, textY);
        const durWidth = ctx.measureText(durStr).width;

        // Dot separator
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText(' • ', textX + durWidth, textY);
        const dotWidth = ctx.measureText(' • ').width;

        // Item Name (Direct high-contrast text)
        const nameX = textX + durWidth + dotWidth;
        const availableWidth = (x + w) - nameX - 30;

        ctx.font = item.isHidden ? 'italic 500 30px sans-serif' : 'bold 32px sans-serif';
        const finalName = truncateText(ctx, item.name, availableWidth);

        ctx.fillStyle = item.isHidden ? '#94a3b8' : '#ffffff';
        ctx.fillText(finalName, nameX, textY);
      } else {
        // Placeholder row
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('-', textX, textY);
        const dashWidth = ctx.measureText('-').width;

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText(' • ', textX + dashWidth, textY);
        const dotWidth = ctx.measureText(' • ').width;

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'italic 30px sans-serif';
        const availableWidth = (x + w) - (textX + dashWidth + dotWidth) - 30;
        const finalName = truncateText(ctx, item.name, availableWidth);
        ctx.fillText(finalName, textX + dashWidth + dotWidth, textY);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  // Row 1: TOP SERVERS (Left) & TOP FRIENDS (Right)
  const cardY = 248;
  const cardHeight = 305;
  const halfWidth = 632;
  const leftX = 52;
  const rightX = WIDTH - halfWidth - 52;

  // 1. TOP SERVERS
  drawCardBox(leftX, cardY, halfWidth, cardHeight, 'TOP SERVERS', finalServers, privacy.servers === 'private');

  // 2. TOP FRIENDS
  drawCardBox(rightX, cardY, halfWidth, cardHeight, 'TOP FRIENDS', finalFriends, privacy.friends === 'private');

  // Row 2: TOP TRACKS (Full width bottom)
  const bottomCardY = cardY + cardHeight + 32;
  const fullWidth = WIDTH - 104;
  drawCardBox(leftX, bottomCardY, fullWidth, cardHeight, 'TOP TRACKS', finalTracks, privacy.tracks === 'private');

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateOnAoProfileCard,
  formatDurationOnAo,
  cleanFancyUnicode,
  resolveThemeConfig,
  COLOR_PRESETS
};
