/**
 * On Ao Discord Bot - Internationalization & Settings Management
 * Supports Indonesian (id) and English (en) with per-guild & per-user scopes
 */
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.resolve(__dirname, 'bot-settings.json');

// Default initial state
const defaultSettings = {
  defaultLanguage: 'id',
  guilds: {},
  users: {}
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      return {
        ...defaultSettings,
        ...parsed,
        guilds: parsed.guilds || {},
        users: parsed.users || {}
      };
    }
  } catch (err) {
    console.error('[I18N LOAD ERROR]', err.message);
  }
  return { ...defaultSettings };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('[I18N SAVE ERROR]', err.message);
  }
}

/**
 * Determine effective language for a context
 */
function getLanguage(guildId = null, userId = null) {
  const settings = loadSettings();
  if (userId && settings.users?.[userId]?.language) {
    return settings.users[userId].language;
  }
  if (guildId && settings.guilds?.[guildId]?.language) {
    return settings.guilds[guildId].language;
  }
  return settings.defaultLanguage || 'id';
}

/**
 * Update language for guild or user
 */
function setLanguage({ guildId = null, userId = null, language = 'id', scope = 'server' }) {
  const validLang = ['en', 'english', 'eng'].includes(String(language).toLowerCase()) ? 'en' : 'id';
  const settings = loadSettings();

  if (scope === 'user' && userId) {
    if (!settings.users[userId]) settings.users[userId] = {};
    settings.users[userId].language = validLang;
  } else if (guildId) {
    if (!settings.guilds[guildId]) settings.guilds[guildId] = {};
    settings.guilds[guildId].language = validLang;
  } else {
    settings.defaultLanguage = validLang;
  }

  saveSettings(settings);
  return validLang;
}

function getGuildSettings(guildId) {
  if (!guildId) return {};
  const settings = loadSettings();
  return (settings.guilds?.[guildId]) ? { ...settings.guilds[guildId] } : {};
}

function updateGuildSettings(guildId, updates = {}) {
  if (!guildId) return {};
  const settings = loadSettings();
  if (!settings.guilds[guildId]) settings.guilds[guildId] = {};
  settings.guilds[guildId] = { ...settings.guilds[guildId], ...updates };
  saveSettings(settings);
  return settings.guilds[guildId];
}

function isUserDJ(member, guild, currentTrackRequester = null) {
  if (!member || !guild) return true;
  if (member.permissions?.has('Administrator') || member.permissions?.has('ManageGuild')) {
    return true;
  }
  const guildSettings = getGuildSettings(guild.id);
  if (!guildSettings.djMode) {
    return true;
  }
  if (guildSettings.djRoleId && member.roles?.cache?.has(guildSettings.djRoleId)) {
    return true;
  }
  const hasNamedDJ = member.roles?.cache?.some(r => r.name.toLowerCase() === 'dj');
  if (hasNamedDJ) return true;
  const voiceChannel = member.voice?.channel;
  if (voiceChannel && voiceChannel.members) {
    const nonBots = voiceChannel.members.filter(m => !m.user.bot);
    if (nonBots.size <= 1) return true;
  }
  if (currentTrackRequester && (currentTrackRequester.id === member.id || currentTrackRequester === member.id)) {
    return true;
  }
  return false;
}

const TRANSLATIONS = {
  id: {
    lang_name: 'Bahasa Indonesia 🇮🇩',
    voice_required: '❌ **Kamu harus bergabung ke voice channel terlebih dahulu!**',
    voice_diff_channel: '⚠️ Kamu harus berada di voice channel yang sama dengan bot!',
    voice_no_perms: '❌ Bot tidak memiliki izin **Connect** atau **Speak** di channel {channel}!',
    play_no_query: '❌ Berikan judul lagu atau link YouTube/Spotify/SoundCloud! Contoh: `on play DJ Gaku Gaku` atau `/play query:...`',
    playnext_added: '⏭️ **Lagu Diprioritaskan:** "{title}" ditambahkan ke depan antrian dan akan diputar berikutnya!',
    playskip_success: '⏩ **Memutar Langsung:** Melewati lagu saat ini untuk memutar "{title}"!',
    search_error: '❌ Gagal Mencari Lagu',
    search_error_desc: 'Error saat menghubungi server audio: {msg}',
    not_found: '⚠️ Tidak ditemukan lagu untuk: **{query}**',
    search_select_title: '🔍 Hasil Pencarian Lagu',
    search_select_desc: 'Pilih lagu yang ingin kamu putar dari menu pilihan di bawah (berlaku 60 detik):',
    search_timeout: '⌛ Waktu pemilihan lagu telah habis.',
    playlist_added: '📑 Playlist Ditambahkan ke Antrian!',
    playlist_tracks: '({count} lagu)',
    requested_by: 'Diminta oleh',
    channel: 'Channel',
    queue_pos: 'Posisi Antrian',
    now_playing: 'Sedang Diputar 🎵',
    paused: '⏸️ **Musik Dijeda:** Gunakan `/resume` atau tombol di bawah untuk melanjutkan pemutaran.',
    already_paused: '⚠️ Musik sudah dalam keadaan jeda.',
    resumed: '▶️ **Musik Dilanjutkan:** Selamat mendengarkan kembali!',
    not_paused: '⚠️ Musik sedang berputar (tidak dijeda).',
    stopped: '⏹️ **Pemutaran Dihentikan:** Antrian dikosongkan dan bot keluar dari voice channel.',
    skipped: '⏭️ **Lagu Dilewati:** Memutar lagu berikutnya dalam antrian.',
    no_player: '⚠️ Tidak ada pemutar musik yang aktif saat ini.',
    no_current_track: '⚠️ Tidak ada lagu yang sedang diputar.',
    volume_set: '🔊 **Volume Diperbarui:** Volume diatur ke **{level}%**',
    volume_current: '🔊 **Volume Saat Ini:** [{slider}] **{level}%**',
    loop_off: 'Nonaktif ❌',
    loop_track: 'Ulang Lagu 🔂',
    loop_queue: 'Ulang Antrian 🔁',
    loop_status: '🔂 **Mode Putar Ulang:** {mode}',
    queue_empty: '📭 Antrian saat ini kosong.',
    queue_cleared: '🗑️ Semua lagu dalam antrian telah dibersihkan ({count} lagu dihapus).',
    shuffled: '🔀 **Antrian Diacak:** Urutan {count} lagu telah diacak!',
    seek_success: '⏩ Posisi musik diubah ke **{time}**',
    forward_success: '⏩ Maju **{seconds} detik** (posisi sekarang: **{pos}**)',
    rewind_success: '⏪ Mundur **{seconds} detik** (posisi sekarang: **{pos}**)',
    replay_success: '🔁 **Memutar Ulang:** Memulai kembali lagu saat ini dari awal.',
    previous_success: '⏮️ **Lagu Sebelumnya:** Memutar kembali "{title}".',
    previous_empty: '⚠️ Belum ada riwayat lagu sebelumnya yang dapat diputar.',
    skipto_success: '⏭️ **Lompat Antrian:** Melompati {skipped} lagu menuju lagu #{pos} (**{title}**)!',
    skipto_invalid: '❌ Nomor urutan antrian tidak valid. Masukkan angka antara 1 sampai {max}.',
    move_success: '↕️ **Lagu Dipindahkan:** Memindahkan lagu dari posisi #{from} ke #{to}.',
    move_invalid: '❌ Posisi urutan tidak valid. Berikan nomor urut yang benar.',
    swap_success: '🔄 **Posisi Ditukar:** Menukar posisi lagu #{pos1} dengan lagu #{pos2}.',
    swap_invalid: '❌ Nomor urutan antrian untuk ditukar tidak valid.',
    mode_247_enabled: '🛡️ **Mode 24/7 DIAKTIFKAN:** Bot tidak akan meninggalkan voice channel meski antrian kosong.',
    mode_247_disabled: '🚪 **Mode 24/7 DINONAKTIFKAN:** Bot otomatis keluar setelah 45 detik tidak ada lagu.',
    autoplay_enabled: '📻 **Autoplay DIAKTIFKAN:** Bot otomatis memutar lagu rekomendasi setelah antrian selesai.',
    autoplay_disabled: '📻 **Autoplay DINONAKTIFKAN:** Pemutaran berhenti ketika antrian habis.',
    join_success: '🔊 **Terhubung ke Voice Channel:** Bergabung ke **{channel}**!',
    join_already: '⚠️ Bot sudah berada di channel **{channel}**.',
    leave_success: '👋 **Keluar dari Voice Channel:** Bot telah terputus dan antrian dibersihkan.',
    radio_playing: '📻 **Radio Live Diputar:** Menyiarkan channel **{station}** 24/7!',
    grab_sent: '📬 **Informasi Lagu Terkirim:** Detail lagu telah dikirim ke Direct Message (DM) kamu!',
    grab_fail: '❌ Gagal mengirimkan Direct Message. Pastikan pengaturan DM kamu terbuka.',
    dj_only: '🔒 **Akses DJ Diperlukan:** Fitur ini hanya dapat digunakan oleh DJ atau Administrator server.',
    dj_set: '🎧 **Role DJ Diperbarui:** Role **{role}** sekarang ditetapkan sebagai role DJ.',
    dj_mode_toggled: '🎧 **Mode DJ:** Sekarang **{status}** di server ini.',
    voteskip_voted: '🗳️ **Vote Skip:** {user} telah vote skip ({current}/{required} suara).',
    voteskip_success: '⏭️ **Vote Skip Berhasil:** {required} suara tercapai, melewati lagu!',
    anti_disconnect_notice: '🛡️ **Anti-Disconnect Guard Aktif:** Terdeteksi pemutusan paksa oleh pihak lain / aksi moderator. Sesuai hak inisiator sesi <@{initiator}>, bot secara otomatis bergabung kembali ke <#{channel}> dan melanjutkan musik!',
    anti_drag_notice: '🛡️ **Anti-Drag Guard Aktif:** Bot dipindahkan paksa ke channel lain. Bot otomatis kembali ke voice channel asal <#{channel}> bersama inisiator musik (<@{initiator}>)!',
    anti_disconnect_blocked: '🔒 **Akses Ditolak (Anti-Disconnect):** Hanya <@{initiator}> yang memulai `on play` yang dapat menghentikan musik atau mengeluarkan bot selama masih berada di voice channel!',
    queue_initiator_only_clear: '🔒 **Akses Ditolak (Proteksi Antrean):** Hanya inisiator sesi <@{initiator}> yang dapat mengosongkan (`Clear`) antrean musik selama masih berada di voice channel!',
    queue_initiator_only_remove: '🔒 **Akses Ditolak (Proteksi Antrean):** Hanya inisiator sesi <@{initiator}> yang berhak menghapus (`Remove`) lagu dari antrean musik selama masih berada di voice channel!',
    profile_title: 'Profil Musik {user}',
    profile_desc: 'Statistik aktivitas mendengarkan musik di On Ao Bot Studio.',
    profile_color_updated: '🎨 **Warna Profil Diperbarui:** Tema warna profil Anda telah diubah menjadi **{color}**.',
    profile_bg_updated: '🖼️ **Latar Belakang Profil Diperbarui:** Background kustom berhasil dipasang!',
    profile_bg_reset: '🔄 **Latar Belakang Direset:** Background kustom telah dihapus dan kembali ke tema warna standar.',
    profile_privacy_updated: '🔒 **Privasi Profil Diperbarui:** Visibilitas untuk **{target}** diatur ke **{status}**.',
    profile_reset_done: '✨ **Profil Direset:** Kustomisasi warna, background, dan privasi telah dikembalikan ke pengaturan awal.',
    profile_help: '👤 **Panduan Kustomisasi Profil On Ao:**\n• Ganti Warna: `on profile color <merah|biru|pink|oranye|#hex>`\n• Ganti Background: `on profile bg <url_gambar>` (atau upload gambar dengan caption `on profile bg`)\n• Reset Background: `on profile bg reset`\n• Atur Privasi: `on profile privacy <servers|friends|tracks|all> <public|private>`\n• Reset Profil: `on profile reset`',
    lyrics_searching: '🔍 **Mencari Lirik:** Mengambil lirik lagu "**{query}**"...',
    lyrics_not_found: '❌ **Lirik tidak ditemukan** untuk lagu "**{query}**".',
    lyrics_tips: '💡 **Tips Pencarian:**\n• Masukkan nama penyanyi dan judul lagu: `on lyrics Judul - Artis`\n• Pastikan judul bersih dari kata tambahan (seperti "official video", "remix", dll).',
    lyrics_no_track: '⚠️ Berikan judul lagu yang ingin dicari liriknya: `on lyrics <judul>`, atau putar lagu terlebih dahulu di voice channel.',
    lyrics_footer: 'Sumber: {source} • On Ao Music Studio',
    lang_changed: '🌐 **Bahasa Berhasil Diatur:** Bahasa bot untuk **{scope}** telah diubah ke **Bahasa Indonesia** 🇮🇩.',
    lang_info: '🌐 **Pengaturan Bahasa / Language Settings:**\n• Server: **{serverLang}**\n• Personal: **{userLang}**\n\nUntuk mengubah bahasa, gunakan:\n`/language choice:[id|en] scope:[server|user]`\natau ketik `on language [id|en]`',
    prefix_info: '⚡ **Prefix Server:** Prefix aktif saat ini adalah `{prefix}`\n\nKamu juga bisa menggunakan `on `, `onao `, `!`, atau mention bot <@{botId}>.',
    prefix_changed: '✅ **Prefix Server Diperbarui:** Prefix berhasil diubah menjadi `{prefix}`.\nContoh penggunaan: `{prefix}play <lagu>`',
    prefix_admin_only: '🔒 Hanya Administrator yang dapat mengubah prefix server.',
    help_title: '🎵 On Ao Music Studio - Pusat Perintah',
    help_desc: 'Bot musik Discord profesional dengan audio engine Lavalink resolusi tinggi, kontrol antrian lengkap, dan kartu profil On Ao.',
    help_core: '🎛️ Kontrol Musik Utama',
    help_core_val: '`/play <lagu>` (`on play` / `on p`) - Putar lagu/link\n`/playnext <lagu>` (`on pn`) - Putar lagu di urutan berikutnya\n`/playskip <lagu>` (`on ps`) - Skip langsung putar lagu baru\n`/search <lagu>` (`on search`) - Cari 10 lagu dengan menu pilihan\n`/pause` & `/resume` - Jeda & lanjutkan\n`/skip` (`on s`) & `/forceskip` (`on fs`) - Lewati lagu\n`/stop` (`on stop`) - Hentikan musik & disconnect\n`/replay` (`on replay`) - Putar ulang dari 00:00\n`/previous` (`on back`) - Putar kembali lagu sebelumnya\n`/forward <detik>` & `/rewind <detik>` - Maju/mundur waktu lagu\n`/seek <detik>` (`on seek`) - Lompat ke detik tertentu',
    help_queue: '📜 Manajemen Antrian & Playlist',
    help_queue_val: '`/queue` (`on q`) - Daftar antrian interaktif dengan tombol halaman\n`/clearqueue` (`on cq`) - Kosongkan antrian lagu\n`/remove <nomor>` (`on rm`) - Hapus lagu tertentu dari antrian\n`/skipto <nomor>` (`on skipto`) - Lompat langsung ke lagu #X\n`/move <dari> <ke>` (`on mv`) - Pindahkan urutan lagu\n`/swap <pos1> <pos2>` - Tukar urutan 2 lagu\n`/shuffle` (`on shuffle`) - Acak antrian lagu\n`/loop [off|track|queue]` - Mode perulangan\n`/autoplay` (`on ap`) - Rekomendasi otomatis lagu serupa',
    help_fx: '🎚️ Efek Suara & Equalizer',
    help_fx_val: '`/bassboost <1-3>` (`on bass`) - Dentuman bass tebal\n`/nightcore` (`on nc`) & `/vaporwave` (`on vw`) - Filter tempo & pitch\n`/8d` (`on 8d`) - Efek surround audio 360° berputar\n`/equalizer <preset>` (`on eq`) - Preset Hi-Fi, Studio, Deep Bass, Gaming\n`/resetfilter` (`on reset`) - Reset ke audio murni original',
    help_feat: '⚡ Sistem DJ, Radio & Profil',
    help_feat_val: '`/radio <station>` (`on radio`) - Streaming radio 24/7 (Lofi, Jazz, Synthwave, dll)\n`/profile [@user]` (`on profile`) - Kartu profil musik gaya On Ao\n`/dj` & `/setdj <@role>` - Atur sistem hak akses DJ\n`/voteskip` - Voting lewati lagu tanpa role DJ\n`/grab` (`on grab`) - Kirim info lagu yang sedang diputar ke DM kamu\n`/247` (`on 247`) - Bot menetap 24/7 di voice channel\n`/lyrics` (`on lyrics`) - Cari lirik lagu online\n`/ping` & `/stats` - Cek latensi dan statistik bot'
  },
  en: {
    lang_name: 'English 🇬🇧',
    voice_required: '❌ **You must be in a voice channel to use this command!**',
    voice_diff_channel: '⚠️ You must be in the same voice channel as the bot!',
    voice_no_perms: '❌ The bot lacks **Connect** or **Speak** permissions in {channel}!',
    play_no_query: '❌ Please provide a song title or YouTube/Spotify/SoundCloud link! Example: `on play Shape of You` or `/play query:...`',
    playnext_added: '⏭️ **Priority Track Added:** "{title}" has been inserted at the front of the queue and will play next!',
    playskip_success: '⏩ **Playing Immediately:** Skipped current track to play "{title}"!',
    search_error: '❌ Track Search Failed',
    search_error_desc: 'Error connecting to audio server: {msg}',
    not_found: '⚠️ No tracks found for: **{query}**',
    search_select_title: '🔍 Track Search Results',
    search_select_desc: 'Select the track you want to play from the dropdown menu below (expires in 60s):',
    search_timeout: '⌛ Track selection timed out.',
    playlist_added: '📑 Playlist Added to Queue!',
    playlist_tracks: '({count} songs)',
    requested_by: 'Requested by',
    channel: 'Channel',
    queue_pos: 'Queue Position',
    now_playing: 'Now Playing 🎵',
    paused: '⏸️ **Playback Paused:** Use `/resume` or the button below to resume playing.',
    already_paused: '⚠️ Playback is already paused.',
    resumed: '▶️ **Playback Resumed:** Enjoy your music!',
    not_paused: '⚠️ Playback is currently playing (not paused).',
    stopped: '⏹️ **Playback Stopped:** Queue cleared and bot disconnected from voice channel.',
    skipped: '⏭️ **Track Skipped:** Playing next song in queue.',
    no_player: '⚠️ No active music player found for this server.',
    no_current_track: '⚠️ No song is currently playing.',
    volume_set: '🔊 **Volume Adjusted:** Volume set to **{level}%**',
    volume_current: '🔊 **Current Volume:** [{slider}] **{level}%**',
    loop_off: 'Disabled ❌',
    loop_track: 'Track Loop 🔂',
    loop_queue: 'Queue Loop 🔁',
    loop_status: '🔂 **Loop Mode:** {mode}',
    queue_empty: '📭 The queue is currently empty.',
    queue_cleared: '🗑️ All songs have been removed from the queue ({count} tracks cleared).',
    shuffled: '🔀 **Queue Shuffled:** Order of {count} tracks shuffled!',
    seek_success: '⏩ Playback position shifted to **{time}**',
    forward_success: '⏩ Forwarded **{seconds} seconds** (current position: **{pos}**)',
    rewind_success: '⏪ Rewound **{seconds} seconds** (current position: **{pos}**)',
    replay_success: '🔁 **Replaying Track:** Starting current track over from 00:00.',
    previous_success: '⏮️ **Previous Track:** Replaying "{title}".',
    previous_empty: '⚠️ No previous track history available.',
    skipto_success: '⏭️ **Skipped to Track #{pos}:** Now playing **{title}**!',
    skipto_invalid: '❌ Invalid queue position. Enter a number between 1 and {max}.',
    move_success: '↕️ **Track Moved:** Moved track from #{from} to #{to}.',
    move_invalid: '❌ Invalid track positions provided.',
    swap_success: '🔄 **Tracks Swapped:** Swapped positions of #{pos1} and #{pos2}.',
    swap_invalid: '❌ Invalid track positions to swap.',
    mode_247_enabled: '🛡️ **24/7 Mode ENABLED:** Bot will stay connected even when the queue is empty.',
    mode_247_disabled: '🚪 **24/7 Mode DISABLED:** Bot will disconnect after 45 seconds of inactivity.',
    autoplay_enabled: '📻 **Autoplay ENABLED:** Recommended tracks will play automatically after queue ends.',
    autoplay_disabled: '📻 **Autoplay DISABLED:** Playback will stop when queue finishes.',
    join_success: '🔊 **Connected to Voice Channel:** Joined **{channel}**!',
    join_already: '⚠️ Bot is already connected to **{channel}**.',
    leave_success: '👋 **Disconnected from Voice Channel:** Queue cleared.',
    radio_playing: '📻 **Live Radio Streaming:** Now playing **{station}** 24/7!',
    grab_sent: '📬 **Track Info Sent:** Details of the current song have been sent to your Direct Messages (DM)!',
    grab_fail: '❌ Could not send you a Direct Message. Please ensure your DMs are open.',
    dj_only: '🔒 **DJ Access Required:** This command requires DJ role or Administrator permissions.',
    dj_set: '🎧 **DJ Role Updated:** **{role}** has been designated as the server DJ role.',
    dj_mode_toggled: '🎧 **DJ Mode:** Now **{status}** for this server.',
    voteskip_voted: '🗳️ **Vote Skip:** {user} voted to skip ({current}/{required} votes).',
    voteskip_success: '⏭️ **Vote Skip Passed:** Required {required} votes reached, skipping track!',
    anti_disconnect_notice: '🛡️ **Anti-Disconnect Guard Active:** Forceful disconnection detected by other party / moderator action. As privileged by session initiator <@{initiator}>, the bot has automatically rejoined <#{channel}> and resumed playback!',
    anti_drag_notice: '🛡️ **Anti-Drag Guard Active:** Bot was moved to another channel. Bot automatically returned to original voice channel <#{channel}> with music session initiator (<@{initiator}>)!',
    anti_disconnect_blocked: '🔒 **Access Denied (Anti-Disconnect):** Only <@{initiator}> who initiated `on play` can stop the music or disconnect the bot while they remain in the voice channel!',
    queue_initiator_only_clear: '🔒 **Access Denied (Queue Protection):** Only session initiator <@{initiator}> who started playback is authorized to clear the queue while in the voice channel!',
    queue_initiator_only_remove: '🔒 **Access Denied (Queue Protection):** Only session initiator <@{initiator}> who started playback is authorized to remove tracks from the queue while in the voice channel!',
    profile_title: 'Music Profile {user}',
    profile_desc: 'Music listening activity & stats on On Ao Bot Studio.',
    profile_color_updated: '🎨 **Profile Color Updated:** Your profile theme color has been set to **{color}**.',
    profile_bg_updated: '🖼️ **Profile Background Updated:** Custom background image applied successfully!',
    profile_bg_reset: '🔄 **Background Reset:** Custom background removed and reset to standard theme.',
    profile_privacy_updated: '🔒 **Profile Privacy Updated:** Visibility for **{target}** set to **{status}**.',
    profile_reset_done: '✨ **Profile Reset:** Custom color, background, and privacy settings have been reset to default.',
    profile_help: '👤 **On Ao Profile Customization Guide:**\n• Change Color: `on profile color <red|blue|pink|orange|#hex>`\n• Change Background: `on profile bg <image_url>` (or upload image with caption `on profile bg`)\n• Reset Background: `on profile bg reset`\n• Set Privacy: `on profile privacy <servers|friends|tracks|all> <public|private>`\n• Reset Profile: `on profile reset`',
    lyrics_searching: '🔍 **Searching Lyrics:** Fetching lyrics for "**{query}**"...',
    lyrics_not_found: '❌ **Lyrics not found** for "**{query}**".',
    lyrics_tips: '💡 **Search Tips:**\n• Try specifying artist & title: `on lyrics Title - Artist`\n• Ensure correct title without extra tags (like "official video", "remix", etc.).',
    lyrics_no_track: '⚠️ Please provide a song title: `on lyrics <title>`, or play a song first in voice channel.',
    lyrics_footer: 'Source: {source} • On Ao Music Studio',
    lang_changed: '🌐 **Language Successfully Set:** Bot language for **{scope}** has been updated to **English** 🇬🇧.',
    lang_info: '🌐 **Language Settings / Pengaturan Bahasa:**\n• Server: **{serverLang}**\n• Personal: **{userLang}**\n\nTo change language, use:\n`/language choice:[id|en] scope:[server|user]`\nor type `on language [id|en]`',
    prefix_info: '⚡ **Server Prefix:** Current active prefix is `{prefix}`\n\nYou can also use `on `, `onao `, `!`, or mention the bot <@{botId}>.',
    prefix_changed: '✅ **Server Prefix Updated:** Prefix successfully changed to `{prefix}`.\nExample usage: `{prefix}play <song>`',
    prefix_admin_only: '🔒 Only Administrators can change the server prefix.',
    help_title: '🎵 On Ao Music Studio - Command Center',
    help_desc: 'Professional Discord music bot featuring high-resolution Lavalink engine, comprehensive queue management, and On Ao profile cards.',
    help_core: '🎛️ Core Music Controls',
    help_core_val: '`/play <query>` (`on play` / `on p`) - Play song or URL\n`/playnext <query>` (`on pn`) - Insert song next in queue\n`/playskip <query>` (`on ps`) - Skip immediately to play new song\n`/search <query>` (`on search`) - Search 10 tracks with select menu\n`/pause` & `/resume` - Pause & resume\n`/skip` (`on s`) & `/forceskip` (`on fs`) - Skip track\n`/stop` (`on stop`) - Stop playback & disconnect\n`/replay` (`on replay`) - Restart current song from 00:00\n`/previous` (`on back`) - Replay previous track\n`/forward <sec>` & `/rewind <sec>` - Jump audio position\n`/seek <sec>` (`on seek`) - Seek to specific second',
    help_queue: '📜 Queue & Playlist Controls',
    help_queue_val: '`/queue` (`on q`) - Interactive paginated queue with buttons\n`/clearqueue` (`on cq`) - Clear all queued songs\n`/remove <pos>` (`on rm`) - Remove song by queue position\n`/skipto <pos>` (`on skipto`) - Jump directly to track #X\n`/move <from> <to>` (`on mv`) - Reorder track positions\n`/swap <pos1> <pos2>` - Swap two tracks\n`/shuffle` (`on shuffle`) - Shuffle queue\n`/loop [off|track|queue]` - Repeat mode\n`/autoplay` (`on ap`) - Seamless song recommendations',
    help_fx: '🎚️ Audio Effects & Equalizer',
    help_fx_val: '`/bassboost <1-3>` (`on bass`) - Thick punchy bass boost\n`/nightcore` (`on nc`) & `/vaporwave` (`on vw`) - Tempo & pitch filters\n`/8d` (`on 8d`) - 360° rotating surround sound\n`/equalizer <preset>` (`on eq`) - Hi-Fi, Studio, Deep Bass presets\n`/resetfilter` (`on reset`) - Reset all audio filters to flat',
    help_feat: '⚡ DJ System, Radio & Profile',
    help_feat_val: '`/radio <station>` (`on radio`) - 24/7 Curated radio streams (Lofi, Jazz, Synthwave, etc.)\n`/profile [@user]` (`on profile`) - On Ao style passport card\n`/dj` & `/setdj <@role>` - Configure DJ permission system\n`/voteskip` - Democratic skip vote without DJ role\n`/grab` (`on grab`) - Send current song info to your DM\n`/247` (`on 247`) - 24/7 persistent voice channel stay\n`/lyrics` (`on lyrics`) - Search lyrics online\n`/ping` & `/stats` - Check latency & engine stats'
  }
};

/**
 * Format string with placeholders {key}
 */
function t(key, lang = 'id', params = {}) {
  const dictionary = TRANSLATIONS[lang] || TRANSLATIONS.id;
  let text = dictionary[key] || TRANSLATIONS.id[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return text;
}

module.exports = {
  getLanguage,
  setLanguage,
  getGuildSettings,
  updateGuildSettings,
  isUserDJ,
  loadSettings,
  saveSettings,
  TRANSLATIONS,
  t
};
