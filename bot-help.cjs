/**
 * On Ao Discord Music Bot - Help System & Unlimited Navigation Handler
 * Provides permanent, circular, unrestricted interactive help navigation
 */
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const { getLanguage, t } = require('./bot-i18n.cjs');

const TOTAL_PAGES = 4;

/**
 * Builds the Embed for a given help page
 */
function buildHelpEmbed(page, langCode, client) {
  const isIndo = langCode === 'id';
  const validPage = Math.max(1, Math.min(TOTAL_PAGES, Number(page) || 1));
  const avatarUrl = client?.user?.displayAvatarURL ? client.user.displayAvatarURL() : null;

  const embed = new EmbedBuilder()
    .setColor(0x10b981)
    .setAuthor({
      name: 'On Ao Music Studio',
      iconURL: avatarUrl || undefined
    })
    .setDescription(
      isIndo
        ? '💡 **Navigasi Tanpa Batas:** Gunakan tombol `<` dan `>` di bawah untuk berpindah halaman secara terus-menerus (looping).'
        : '💡 **Limitless Navigation:** Use the `<` and `>` buttons below to browse pages continuously (looping).'
    );

  if (validPage === 1) {
    embed
      .setTitle(`🎵 ${isIndo ? 'Ringkasan & Panduan' : 'Overview & Quick Start'} — Page 1/${TOTAL_PAGES}`)
      .addFields(
        {
          name: '✨ ' + (isIndo ? 'Tentang Bot' : 'About Bot'),
          value: isIndo
            ? 'On Ao Music Studio adalah bot musik Discord resolusi tinggi berbasis Lavalink Engine dengan kontrol audio profesional, proteksi Anti-Drag & Anti-Disconnect, dan sistem audio stabil.'
            : 'On Ao Music Studio is a high-resolution Discord music bot powered by Lavalink Engine with professional audio controls, Anti-Drag & Anti-Disconnect protection, and rock-solid playback.'
        },
        {
          name: '⚡ ' + (isIndo ? 'Cara Penggunaan' : 'How to Use'),
          value: isIndo
            ? '• **Slash Commands**: Ketik `/` diikuti nama perintah (contoh: `/play`, `/queue`, `/equalizer`)\n• **Prefix Commands**: Ketik `on <perintah>` (contoh: `on play`, `on q`, `on seek 1:30`)'
            : '• **Slash Commands**: Type `/` followed by command (e.g. `/play`, `/queue`, `/equalizer`)\n• **Prefix Commands**: Type `on <command>` (e.g. `on play`, `on q`, `on seek 1:30`)'
        },
        {
          name: '📂 ' + (isIndo ? 'Kategori Perintah' : 'Command Categories'),
          value: isIndo
            ? '• **Halaman 1**: Ringkasan & Panduan Utama\n• **Halaman 2**: 🎛️ Perintah Utama Musik (Play, Skip, Seek, Radio, dll)\n• **Halaman 3**: 📜 Manajemen Antrian & Playlist (Queue, Move, Loop, Autoplay)\n• **Halaman 4**: 🎚️ Efek Audio, Equalizer & Utilitas (Bass, EQ, Profile, Lyrics)'
            : '• **Page 1**: Overview & Getting Started\n• **Page 2**: 🎛️ Core Music Controls (Play, Skip, Seek, Radio, etc)\n• **Page 3**: 📜 Queue & Playlist (Queue, Move, Loop, Autoplay)\n• **Page 4**: 🎚️ Audio Effects, Equalizer & Utilities (Bass, EQ, Profile, Lyrics)'
        }
      );
  } else if (validPage === 2) {
    embed
      .setTitle(`🎛️ ${isIndo ? 'Perintah Utama Musik' : 'Core Music Controls'} — Page 2/${TOTAL_PAGES}`)
      .addFields(
        { name: '🎵 /play <query|url>', value: isIndo ? 'Putar lagu dari YouTube, Spotify, atau SoundCloud.' : 'Play music from YouTube, Spotify, or SoundCloud.' },
        { name: '⏭️ /playnext <query>', value: isIndo ? 'Sisipkan lagu langsung ke posisi paling depan antrian.' : 'Insert song to the very top of the queue.' },
        { name: '⚡ /playskip <query>', value: isIndo ? 'Lewati lagu saat ini dan langsung memutar lagu baru.' : 'Skip current song and instantly play new song.' },
        { name: '🔍 /search <query>', value: isIndo ? 'Cari 10 hasil lagu dengan menu pemilih interaktif.' : 'Search 10 song choices with interactive selection.' },
        { name: '⏸️ /pause & /resume', value: isIndo ? 'Jeda dan lanjutkan kembali pemutaran musik.' : 'Pause and resume music playback.' },
        { name: '⏩ /skip & /forceskip', value: isIndo ? 'Lewati lagu yang sedang diputar saat ini.' : 'Skip the currently playing song.' },
        { name: '⏹️ /stop', value: isIndo ? 'Hentikan musik, bersihkan antrian, dan keluar voice (hanya inisiator).' : 'Stop music, clear queue, and leave voice channel (initiator only).' },
        { name: '🔄 /replay & /previous', value: isIndo ? 'Putar ulang dari awal / putar lagu sebelumnya.' : 'Replay current track / play previous track.' },
        { name: '⏩ /forward & /rewind', value: isIndo ? 'Maju atau mundur beberapa detik durasi.' : 'Fast forward or rewind song duration.' },
        { name: '📍 /seek <mm:ss|sec>', value: isIndo ? 'Lompat langsung ke posisi detik/menit spesifik.' : 'Jump directly to specific time position.' },
        { name: '🎶 /nowplaying atau on np', value: isIndo ? 'Lihat lagu yang sedang diputar beserta moving progress bar & tombol kontrol.' : 'View current playing track with dynamic progress bar & controls.' },
        { name: '📻 /radio <stasiun>', value: isIndo ? 'Streaming radio 24/7 (Lofi, Jazz, Synthwave, Pop).' : '24/7 radio streaming (Lofi, Jazz, Synthwave, Pop).' }
      );
  } else if (validPage === 3) {
    embed
      .setTitle(`📜 ${isIndo ? 'Manajemen Antrian & Playlist' : 'Queue & Playlist Controls'} — Page 3/${TOTAL_PAGES}`)
      .addFields(
        { name: '📜 /queue', value: isIndo ? 'Lihat daftar antrian lagu interaktif dengan tombol navigasi.' : 'View interactive queue list with navigation buttons.' },
        { name: '🗑️ /clearqueue', value: isIndo ? 'Hapus semua lagu dari antrian sekaligus.' : 'Clear all tracks from queue at once.' },
        { name: '❌ /remove <nomor>', value: isIndo ? 'Hapus lagu nomor tertentu dari antrian.' : 'Remove specific track number from queue.' },
        { name: '⏭️ /skipto <nomor>', value: isIndo ? 'Lompat langsung memutar lagu nomor X di antrian.' : 'Skip directly to track number X in queue.' },
        { name: '🔀 /move <dari> <ke>', value: isIndo ? 'Pindahkan posisi lagu dari urutan A ke urutan B.' : 'Move track position from order A to B.' },
        { name: '🔄 /swap <pos1> <pos2>', value: isIndo ? 'Tukar posisi dua lagu dalam antrian.' : 'Swap positions of two tracks in queue.' },
        { name: '🔀 /shuffle', value: isIndo ? 'Acak urutan seluruh lagu dalam antrian.' : 'Shuffle order of all tracks in queue.' },
        { name: '🔁 /loop [off|track|queue]', value: isIndo ? 'Atur mode perulangan (mati/lagu/antrian).' : 'Set repeat mode (off/track/queue).' },
        { name: '♾️ /autoplay', value: isIndo ? 'Putar otomatis lagu rekomendasi tanpa lagu kembar.' : 'Smart continuous autoplay without duplicate tracks.' }
      );
  } else if (validPage === 4) {
    embed
      .setTitle(`🎚️ ${isIndo ? 'Efek Audio & Utilitas' : 'Audio Effects & Utilities'} — Page 4/${TOTAL_PAGES}`)
      .addFields(
        { name: '🔊 /bassboost <1-3>', value: isIndo ? 'Aktifkan dentuman bass HD (Low, Medium, High).' : 'Enable HD bass boost filter (Low, Medium, High).' },
        { name: '🎛️ /equalizer <preset>', value: isIndo ? 'Preset EQ (Hi-Fi, Studio, Deep Bass, Gaming, Treble).' : 'Equalizer presets (Hi-Fi, Studio, Deep Bass, Gaming).' },
        { name: '⚡ /nightcore & /vaporwave', value: isIndo ? 'Efek ubah tempo & pitch nada audio.' : 'Audio speed & pitch modulation filters.' },
        { name: '🌀 /8d', value: isIndo ? 'Efek audio surround 360° berputar.' : '360° rotating surround sound audio filter.' },
        { name: '🧹 /resetfilter', value: isIndo ? 'Reset semua efek audio kembali ke standar murni.' : 'Reset all sound filters back to crystal clean.' },
        { name: '👤 /profile [@user]', value: isIndo ? 'Kartu profil musik On Ao (`on profile`).' : 'Display On Ao music passport card (`on profile`).' },
        { name: '🎨 /setprofile & on profile ...', value: isIndo ? 'Kustomisasi: `color <warna|#hex>`, `bg <url>`, `privacy <servers|friends|tracks> <public|private>`, `reset`.' : 'Customize: `color <color|#hex>`, `bg <url>`, `privacy <section> <public|private>`, `reset`.' },
        { name: '🎤 /lyrics [judul]', value: isIndo ? 'Cari lirik lagu lengkap di internet.' : 'Search song lyrics online.' },
        { name: '📬 /grab', value: isIndo ? 'Kirim detail lagu yang diputar ke Direct Message.' : 'Send currently playing track details to your DMs.' },
        { name: '🎧 /dj & /setdj <role>', value: isIndo ? 'Kelola hak akses perintah khusus DJ.' : 'Manage DJ role permissions and access.' },
        { name: '🔊 /volume <1-150>', value: isIndo ? 'Ubah tingkat volume pemutaran musik.' : 'Change music playback volume level.' },
        { name: '📌 /247', value: isIndo ? 'Bot selalu aktif di voice channel tanpa disconnect.' : 'Keep bot 24/7 connected in voice channel.' },
        { name: '🌐 /language <id|en>', value: isIndo ? 'Ubah bahasa pengantar bot (ID / EN).' : 'Change bot system language (ID / EN).' }
      );
  }

  embed.setFooter({
    text: `On Ao Music Studio • Page ${validPage}/${TOTAL_PAGES}`,
    iconURL: avatarUrl || undefined
  });

  return embed;
}

/**
 * Builds the interactive select menu
 */
function buildSelectMenu(currPage, langCode) {
  const isIndo = langCode === 'id';
  const page = Math.max(1, Math.min(TOTAL_PAGES, Number(currPage) || 1));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('help_select')
    .setPlaceholder(isIndo ? 'Pilih kategori halaman atau detail perintah...' : 'Select a page category or command detail...')
    .addOptions([
      {
        label: isIndo ? 'Halaman 1: Ringkasan & Panduan' : 'Page 1: Overview & Quick Start',
        description: isIndo ? 'Panduan umum, pengenalan & cara pakai' : 'General guide & how to use',
        value: 'cat_1',
        emoji: '🎵',
        default: page === 1
      },
      {
        label: isIndo ? 'Halaman 2: Kontrol Utama Musik' : 'Page 2: Core Music Controls',
        description: 'Play, Skip, Pause, Seek, Radio',
        value: 'cat_2',
        emoji: '🎛️',
        default: page === 2
      },
      {
        label: isIndo ? 'Halaman 3: Antrian & Playlist' : 'Page 3: Queue & Playlist',
        description: 'Queue, Move, Loop, Autoplay',
        value: 'cat_3',
        emoji: '📜',
        default: page === 3
      },
      {
        label: isIndo ? 'Halaman 4: Efek Audio & Utilitas' : 'Page 4: Effects & Utilities',
        description: 'Bassboost, EQ, 8D, Profile, Lyrics',
        value: 'cat_4',
        emoji: '🎚️',
        default: page === 4
      },
      {
        label: 'Info Perintah: /play',
        description: isIndo ? 'Detail penggunaan perintah /play' : 'Detail usage for /play',
        value: 'cmd_play',
        emoji: '🔍'
      },
      {
        label: 'Info Perintah: /seek',
        description: isIndo ? 'Detail penggunaan perintah /seek' : 'Detail usage for /seek',
        value: 'cmd_seek',
        emoji: '🔍'
      },
      {
        label: 'Info Perintah: /equalizer',
        description: isIndo ? 'Detail penggunaan perintah /equalizer' : 'Detail usage for /equalizer',
        value: 'cmd_equalizer',
        emoji: '🔍'
      },
      {
        label: 'Info Perintah: /profile',
        description: isIndo ? 'Detail penggunaan perintah /profile' : 'Detail usage for /profile',
        value: 'cmd_profile',
        emoji: '🔍'
      }
    ]);

  return new ActionRowBuilder().addComponents(menu);
}

/**
 * Builds the button row with unlimited circular navigation
 * NOTICE: Buttons are NEVER disabled so user can toggle without limitation!
 */
function buildButtonRow(currPage, totalPgs = TOTAL_PAGES) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('help_first')
      .setLabel('<<')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false),
    new ButtonBuilder()
      .setCustomId('help_prev')
      .setLabel('<')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(false), // Limitless: wraps around smoothly
    new ButtonBuilder()
      .setCustomId('help_next')
      .setLabel('>')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(false), // Limitless: wraps around smoothly
    new ButtonBuilder()
      .setCustomId('help_last')
      .setLabel('>>')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false),
    new ButtonBuilder()
      .setCustomId('help_cancel')
      .setLabel('✖')
      .setStyle(ButtonStyle.Danger)
  );
}

/**
 * Builds detail embed for a specific command
 */
function getDetailEmbed(cmdKey, langCode, client) {
  const isIndo = langCode === 'id';
  const avatarUrl = client?.user?.displayAvatarURL ? client.user.displayAvatarURL() : null;
  const detail = new EmbedBuilder().setColor(0x10b981);

  if (cmdKey === 'play') {
    detail
      .setTitle('🔍 Perintah: /play (`on play` / `on p`)')
      .setDescription(isIndo ? 'Memutar musik dari nama lagu atau tautan (YouTube, Spotify, SoundCloud).' : 'Play audio from track name or link (YouTube, Spotify, SoundCloud).')
      .addFields(
        { name: isIndo ? 'Penggunaan' : 'Usage', value: '`/play <judul lagu / URL>`' },
        { name: isIndo ? 'Contoh Prefix' : 'Prefix Example', value: '`on play Starfall hero`\n`on p https://open.spotify.com/track/...`' },
        { name: isIndo ? 'Fitur Pendukung' : 'Features', value: isIndo ? 'High-bitrate audio otomatis, Spotify album/playlist resolution, Anti-Disconnect protection.' : 'Automatic high-bitrate audio, Spotify resolution, Anti-Disconnect protection.' }
      );
  } else if (cmdKey === 'seek') {
    detail
      .setTitle('🔍 Perintah: /seek (`on seek`)')
      .setDescription(isIndo ? 'Lompat langsung ke posisi waktu spesifik lagu.' : 'Jump directly to a specific timestamp in the song.')
      .addFields(
        { name: isIndo ? 'Penggunaan' : 'Usage', value: '`/seek <detik / mm:ss>`' },
        { name: isIndo ? 'Contoh Prefix' : 'Prefix Example', value: '`on seek 1:30` (Lompat ke menit 1:30)\n`on seek 90` (Lompat ke detik ke-90)' }
      );
  } else if (cmdKey === 'equalizer') {
    detail
      .setTitle('🔍 Perintah: /equalizer (`on eq`)')
      .setDescription(isIndo ? 'Mengatur preset equalizer audio studio.' : 'Configure studio audio equalizer presets.')
      .addFields(
        { name: isIndo ? 'Penggunaan' : 'Usage', value: '`/equalizer <preset>`' },
        { name: isIndo ? 'Preset Tersedia' : 'Available Presets', value: '`hifi`, `studio`, `bassboost`, `deepbass`, `gaming`, `treble`, `flat`' }
      );
  } else if (cmdKey === 'profile') {
    detail
      .setTitle('🔍 Perintah: /profile & on profile (`setprofile`)')
      .setDescription(isIndo
        ? 'Menampilkan kartu paspor profil musik pengguna dalam bentuk render canvas HD On Ao beserta kustomisasi visual & privasi.'
        : 'Displays user music profile statistics as an HD On Ao passport canvas card with full visual and privacy customizations.')
      .addFields(
        {
          name: isIndo ? '📖 Perintah Dasar' : '📖 Basic Command',
          value: '`on profile` — ' + (isIndo ? 'Tampilkan kartu profil musik kamu' : 'Show your music profile card') + '\n`on profile @user` — ' + (isIndo ? 'Lihat profil pengguna lain' : 'View another user\'s profile card')
        },
        {
          name: isIndo ? '🎨 Ganti Tema Warna' : '🎨 Change Color Theme',
          value: '`on profile color <warna|#hex>`\n' + (isIndo ? 'Pilihan: `merah`, `biru`, `pink`, `oranye`, `ungu`, `hijau`, `cyan`, `kuning` atau kode hex `#rrggbb`.\n*Contoh:* `on profile color pink` atau `on profile color #3b82f6`' : 'Options: `red`, `blue`, `pink`, `orange`, `purple`, `green`, `cyan`, `yellow` or hex `#rrggbb`.\n*Example:* `on profile color pink` or `on profile color #3b82f6`')
        },
        {
          name: isIndo ? '🖼️ Latar Belakang (Background)' : '🖼️ Custom Background',
          value: '`on profile bg <url>` ' + (isIndo ? 'atau kirim gambar dengan pesan `on profile bg`\n`on profile bg reset` untuk menghapus background' : 'or upload image with caption `on profile bg`\n`on profile bg reset` to remove custom background')
        },
        {
          name: isIndo ? '🔒 Kontrol Privasi Musik' : '🔒 Privacy Controls',
          value: '`on profile privacy <servers|friends|tracks|all> <public|private>`\n*Contoh:* `on profile privacy tracks private` ' + (isIndo ? '(Sembunyikan riwayat lagu dari publik)' : '(Hide track history from public cards)')
        },
        {
          name: isIndo ? '✨ Reset Pengaturan' : '✨ Reset Settings',
          value: '`on profile reset` — ' + (isIndo ? 'Kembalikan warna, background, dan privasi ke standar' : 'Reset theme color, background, and privacy to defaults')
        }
      );
  } else {
    return buildHelpEmbed(1, langCode, client);
  }

  detail.setFooter({
    text: `On Ao Music Studio • Detail Mode • Page 1/${TOTAL_PAGES}`,
    iconURL: avatarUrl || undefined
  });
  return detail;
}

/**
 * Handles button or select menu interactions for Help globally without restrictions
 */
async function handleHelpInteraction(interaction, client) {
  try {
    const lang = getLanguage(interaction.guildId, interaction.user?.id);
    const customId = interaction.customId;

    // Parse current page from footer if available
    let currentPage = 1;
    const footerText = interaction.message?.embeds?.[0]?.footer?.text || '';
    const match = footerText.match(/Page\s+(\d+)\/(\d+)/i);
    if (match) {
      currentPage = parseInt(match[1], 10) || 1;
    }

    if (interaction.isButton()) {
      if (customId === 'help_first') {
        currentPage = 1;
      } else if (customId === 'help_last') {
        currentPage = TOTAL_PAGES;
      } else if (customId === 'help_prev') {
        // Limitless navigation: Circular wrapping! Page 1 wraps to Page 4
        currentPage = currentPage > 1 ? currentPage - 1 : TOTAL_PAGES;
      } else if (customId === 'help_next') {
        // Limitless navigation: Circular wrapping! Page 4 wraps to Page 1
        currentPage = currentPage < TOTAL_PAGES ? currentPage + 1 : 1;
      } else if (customId === 'help_cancel') {
        await interaction.message.delete().catch(() => {});
        return;
      }

      await interaction.update({
        embeds: [buildHelpEmbed(currentPage, lang, client)],
        components: [buildSelectMenu(currentPage, lang), buildButtonRow(currentPage, TOTAL_PAGES)]
      }).catch(err => console.warn('[HELP BTN UPDATE ERR]', err.message));
      return;
    }

    if (interaction.isStringSelectMenu() && customId === 'help_select') {
      const selected = interaction.values?.[0] || '';
      if (selected.startsWith('cat_')) {
        currentPage = parseInt(selected.replace('cat_', ''), 10) || 1;
        await interaction.update({
          embeds: [buildHelpEmbed(currentPage, lang, client)],
          components: [buildSelectMenu(currentPage, lang), buildButtonRow(currentPage, TOTAL_PAGES)]
        }).catch(err => console.warn('[HELP MENU UPDATE ERR]', err.message));
      } else if (selected.startsWith('cmd_')) {
        const cmdKey = selected.replace('cmd_', '');
        await interaction.update({
          embeds: [getDetailEmbed(cmdKey, lang, client)],
          components: [buildSelectMenu(currentPage, lang), buildButtonRow(currentPage, TOTAL_PAGES)]
        }).catch(err => console.warn('[HELP DETAIL UPDATE ERR]', err.message));
      }
      return;
    }
  } catch (err) {
    console.error('[HANDLE HELP INTERACTION ERR]', err.message);
  }
}

module.exports = {
  TOTAL_PAGES,
  buildHelpEmbed,
  buildSelectMenu,
  buildButtonRow,
  getDetailEmbed,
  handleHelpInteraction
};
