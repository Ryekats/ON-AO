import React, { useState, useMemo } from 'react';
import { 
  Trophy, Music, Clock, MessageSquare, Star, User, 
  Crown, Search, Sparkles, Headphones, ArrowUpDown, 
  Copy, Check, Flame, Award, ChevronRight, Disc, Zap,
  Eye, Download, Globe, X, Image as ImageIcon, ExternalLink
} from 'lucide-react';
import { ProfilesMap, UserProfile } from '../types';

interface MusicProfilesLeaderboardProps {
  profiles: ProfilesMap;
}

interface TierInfo {
  level: number;
  badge: string;
  name: string;
  colorClass: string;
  borderClass: string;
  bgBadgeClass: string;
  progressPercent: number;
  nextGoalText: string;
}

function calculateTier(songsCount: number, secondsCount: number): TierInfo {
  const hours = Math.floor(secondsCount / 3600);
  if (songsCount >= 150 || hours >= 15) {
    return {
      level: 5,
      badge: '👑',
      name: 'Sound Maestro',
      colorClass: 'text-amber-400',
      borderClass: 'border-amber-500/40 shadow-amber-500/10',
      bgBadgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      progressPercent: 100,
      nextGoalText: 'Tingkat Maksimal'
    };
  } else if (songsCount >= 75 || hours >= 7) {
    const p = Math.min(100, Math.floor(((songsCount - 75) / 75) * 100));
    return {
      level: 4,
      badge: '💎',
      name: 'Audiophile Elite',
      colorClass: 'text-sky-400',
      borderClass: 'border-sky-500/40 shadow-sky-500/10',
      bgBadgeClass: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
      progressPercent: p,
      nextGoalText: `${songsCount}/150 lagu ke Maestro`
    };
  } else if (songsCount >= 30 || hours >= 3) {
    const p = Math.min(100, Math.floor(((songsCount - 30) / 45) * 100));
    return {
      level: 3,
      badge: '🥇',
      name: 'Groove Master',
      colorClass: 'text-emerald-400',
      borderClass: 'border-emerald-500/40 shadow-emerald-500/10',
      bgBadgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      progressPercent: p,
      nextGoalText: `${songsCount}/75 lagu ke Audiophile`
    };
  } else if (songsCount >= 10 || hours >= 1) {
    const p = Math.min(100, Math.floor(((songsCount - 10) / 20) * 100));
    return {
      level: 2,
      badge: '🥈',
      name: 'Music Enthusiast',
      colorClass: 'text-purple-400',
      borderClass: 'border-purple-500/40 shadow-purple-500/10',
      bgBadgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      progressPercent: p,
      nextGoalText: `${songsCount}/30 lagu ke Groove Master`
    };
  } else {
    const p = Math.min(100, Math.floor((songsCount / 10) * 100));
    return {
      level: 1,
      badge: '🥉',
      name: 'Novice Listener',
      colorClass: 'text-teal-400',
      borderClass: 'border-teal-500/30 shadow-teal-500/5',
      bgBadgeClass: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
      progressPercent: p,
      nextGoalText: `${songsCount}/10 lagu ke Enthusiast`
    };
  }
}

export const MusicProfilesLeaderboard: React.FC<MusicProfilesLeaderboardProps> = ({ profiles }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'songs' | 'seconds' | 'commands'>('songs');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedUserForCard, setSelectedUserForCard] = useState<{ id: string; name: string } | null>(null);
  const [cardLang, setCardLang] = useState<'id' | 'en'>('id');

  const rawEntries = useMemo(() => Object.entries(profiles) as [string, UserProfile][], [profiles]);

  // Global summary metrics
  const summaryStats = useMemo(() => {
    let totalSongs = 0;
    let totalSeconds = 0;
    let topFavTrack: { title: string; count: number } | null = null;

    rawEntries.forEach(([, p]) => {
      totalSongs += p.songs || 0;
      totalSeconds += p.seconds || 0;
      if (p.favSong && (!topFavTrack || (p.favCount || 0) > topFavTrack.count)) {
        topFavTrack = { title: p.favSong, count: p.favCount || 1 };
      }
    });

    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);

    return {
      totalListeners: rawEntries.length,
      totalSongs,
      totalHours: hours,
      totalMinutes: mins,
      topFavTrack
    };
  }, [rawEntries]);

  // Filtered and sorted entries
  const processedEntries = useMemo(() => {
    let list = [...rawEntries];

    // Filter search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(([userId, p]) => {
        const matchesUser = userId.toLowerCase().includes(q);
        const matchesSong = p.favSong ? p.favSong.toLowerCase().includes(q) : false;
        return matchesUser || matchesSong;
      });
    }

    // Filter tier
    if (tierFilter !== 'all') {
      const targetLevel = parseInt(tierFilter, 10);
      list = list.filter(([, p]) => {
        const tier = calculateTier(p.songs, p.seconds);
        return tier.level === targetLevel;
      });
    }

    // Sort
    list.sort(([, a], [, b]) => {
      if (sortBy === 'seconds') return (b.seconds || 0) - (a.seconds || 0);
      if (sortBy === 'commands') return (b.commands || 0) - (a.commands || 0);
      return (b.songs || 0) - (a.songs || 0);
    });

    return list;
  }, [rawEntries, searchTerm, sortBy, tierFilter]);

  const formatSeconds = (sec: number) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-7 shadow-2xl backdrop-blur-md relative overflow-hidden">
      {/* Decorative ambient background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Section */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">
                  Music Leaderboard & Passports
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  Level & XP
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Statistik mendengarkan musik real-time Discord • Sinkron otomatis dari bot On Ao
              </p>
            </div>
          </div>
        </div>

        {/* Discord Command Hint Banner */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedUserForCard({ id: rawEntries[0]?.[0] || 'sample', name: rawEntries[0]?.[0] || 'ryezenki' })}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-red-950/30 transition-all cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Lihat Paspor On Ao Music</span>
          </button>
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-xl text-xs">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-300">
              Di Discord: <code className="text-emerald-400 font-mono font-semibold">on profile</code> atau <code className="text-emerald-400 font-mono font-semibold">/profile</code>
            </span>
          </div>
        </div>
      </div>

      {/* Overview Analytics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-6">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400 font-medium truncate">Total Pendengar</div>
            <div className="text-lg font-bold text-slate-100">{summaryStats.totalListeners} <span className="text-xs text-slate-500 font-normal">User</span></div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Music className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400 font-medium truncate">Lagu Terputar</div>
            <div className="text-lg font-bold text-slate-100">{summaryStats.totalSongs.toLocaleString()} <span className="text-xs text-slate-500 font-normal">Track</span></div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400 font-medium truncate">Total Waktu (HH:MM)</div>
            <div className="text-lg font-bold text-slate-100 font-mono">
              {String(summaryStats.totalHours).padStart(2, '0')}:{String(summaryStats.totalMinutes).padStart(2, '0')}
            </div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Star className="w-5 h-5 fill-amber-400/20" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-slate-400 font-medium truncate">Lagu Terpopuler Server</div>
            <div className="text-xs font-semibold text-slate-200 truncate" title={summaryStats.topFavTrack?.title || 'Belum ada'}>
              {summaryStats.topFavTrack?.title ? summaryStats.topFavTrack.title : 'Belum tercatat'}
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Sorting */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between pb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari User ID atau judul lagu favorit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
          >
            <option value="all">Semua Tier Level</option>
            <option value="5">👑 Level 5 - Sound Maestro</option>
            <option value="4">💎 Level 4 - Audiophile Elite</option>
            <option value="3">🥇 Level 3 - Groove Master</option>
            <option value="2">🥈 Level 2 - Music Enthusiast</option>
            <option value="1">🥉 Level 1 - Novice Listener</option>
          </select>

          {/* Sort Buttons */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800 p-1 rounded-xl gap-1">
            <button
              onClick={() => setSortBy('songs')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                sortBy === 'songs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lagu
            </button>
            <button
              onClick={() => setSortBy('seconds')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                sortBy === 'seconds'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Durasi
            </button>
            <button
              onClick={() => setSortBy('commands')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                sortBy === 'commands'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Command
            </button>
          </div>
        </div>
      </div>

      {/* Profiles Grid */}
      {processedEntries.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800/80 rounded-2xl bg-slate-950/40 mt-2">
          <Disc className="w-12 h-12 mx-auto mb-3 text-slate-600 animate-spin-slow opacity-60" />
          <h3 className="text-base font-semibold text-slate-300">
            {searchTerm || tierFilter !== 'all'
              ? 'Tidak ada pendengar yang cocok dengan pencarian / filter.'
              : 'Belum ada profil musik tersimpan.'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
            {searchTerm || tierFilter !== 'all'
              ? 'Coba reset kata kunci pencarian atau ganti filter tier di atas.'
              : 'Mulai putar lagu di Discord dengan mengetik "on play <judul>" dan profil musik setiap anggota otomatis terbentuk!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-3">
          {processedEntries.map(([userId, p], index) => {
            const tier = calculateTier(p.songs, p.seconds);
            const isTop1 = index === 0 && !searchTerm && tierFilter === 'all';
            const isTop2 = index === 1 && !searchTerm && tierFilter === 'all';
            const isTop3 = index === 2 && !searchTerm && tierFilter === 'all';

            const avgMins = p.songs > 0 ? (p.seconds / 60 / p.songs).toFixed(1) : '0';

            return (
              <div
                key={userId}
                className={`relative group bg-slate-950/90 rounded-2xl border transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl p-5 flex flex-col justify-between ${
                  isTop1
                    ? 'border-amber-500/50 shadow-amber-500/10 bg-gradient-to-b from-amber-950/20 to-slate-950/90'
                    : isTop2
                    ? 'border-slate-500/40 shadow-slate-500/10'
                    : isTop3
                    ? 'border-amber-700/40 shadow-amber-700/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header: Rank + User Tag + Tier Badge */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    {/* Rank Number & Avatar */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Rank Badge or Avatar */}
                      {(p as any).avatarUrl ? (
                        <div className="relative shrink-0">
                          <img
                            src={(p as any).avatarUrl}
                            alt={(p as any).username || userId}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-700 shadow-md"
                          />
                          <span
                            className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full border ${
                              isTop1
                                ? 'bg-amber-500 text-slate-950 border-amber-300'
                                : isTop2
                                ? 'bg-slate-300 text-slate-950 border-slate-100'
                                : isTop3
                                ? 'bg-amber-700 text-white border-amber-500'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            #{index + 1}
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                            isTop1
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-inner'
                              : isTop2
                              ? 'bg-slate-700/30 text-slate-200 border-slate-600/40'
                              : isTop3
                              ? 'bg-amber-800/20 text-amber-400 border-amber-800/40'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          {isTop1 ? '👑 #1' : isTop2 ? '🥈 #2' : isTop3 ? '🥉 #3' : `#${index + 1}`}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-slate-100 truncate">
                            {(p as any).username ? `@${(p as any).username}` : `User ${userId.slice(0, 6)}...${userId.slice(-4)}`}
                          </span>
                          <button
                            onClick={() => handleCopyId(userId)}
                            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                            title="Salin Full User ID"
                          >
                            {copiedId === userId ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Discord Listener
                        </span>
                      </div>
                    </div>

                    {/* Tier Pill */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 shrink-0 ${tier.bgBadgeClass}`}
                    >
                      <span>{tier.badge}</span>
                      <span>{tier.name}</span>
                    </span>
                  </div>

                  {/* XP & Progress to next Tier */}
                  <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2.5 mb-3.5">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400" />
                        Level {tier.level} XP Progress
                      </span>
                      <span className="text-slate-300 font-semibold font-mono">
                        {tier.progressPercent}%
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/60 p-[1px]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-500"
                        style={{ width: `${tier.progressPercent}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                      <span>Status: {tier.name}</span>
                      <span className="text-slate-400">{tier.nextGoalText}</span>
                    </div>
                  </div>

                  {/* 3 Metric Box */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-900/60 border border-slate-800/60 rounded-xl text-center mb-3">
                    <div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <Music className="w-3 h-3 text-emerald-400" />
                        Lagu
                      </div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5 font-mono">
                        {p.songs || 0}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-sky-400" />
                        Durasi
                      </div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5 font-mono">
                        {formatSeconds(p.seconds || 0)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <MessageSquare className="w-3 h-3 text-purple-400" />
                        Interaksi
                      </div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5 font-mono">
                        {p.commands || 0}x
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer: Star Favorite Track */}
                <div className="pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-400 flex items-center gap-1 font-medium">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400/20" />
                      Lagu Paling Sering Diputar:
                    </span>
                    {p.favSong && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                        {p.favCount || 1}x Play
                      </span>
                    )}
                  </div>

                  {p.favSong ? (
                    <div className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg border border-slate-800/40">
                      <Disc className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-spin-slow" />
                      <span
                        className="text-xs font-semibold text-slate-200 truncate"
                        title={p.favSong}
                      >
                        {p.favSong}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-600 italic py-1">
                      Belum ada riwayat lagu favorit
                    </div>
                  )}

                  <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Rata-rata: ~{avgMins} mnt/lagu</span>
                    <button
                      type="button"
                      onClick={() => setSelectedUserForCard({ id: userId, name: userId })}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/30 transition-all cursor-pointer"
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>Kartu Profil</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer System Info */}
      <div className="mt-7 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Sistem Peringkat: Novice (🥉) → Enthusiast (🥈) → Groove (🥇) → Audiophile (💎) → Maestro (👑)</span>
        </div>
        <div>
          Data tersimpan di <code className="text-slate-400 font-mono">profiles.json</code>
        </div>
      </div>

      {/* On Ao Music Profile Modal */}
      {selectedUserForCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base flex items-center gap-2">
                    On Ao Music Profile Card
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      Strict Username
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Kartu profil resmi On Ao Music yang otomatis dikirim bot via <code className="text-emerald-400 font-mono">on profile</code> atau <code className="text-emerald-400 font-mono">/profile</code>
                  </p>
                </div>
              </div>

              {/* Language Switcher & Close */}
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCardLang('id')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      cardLang === 'id'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🇮🇩 Indo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardLang('en')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      cardLang === 'en'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🇬🇧 English
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedUserForCard(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Image Preview */}
            <div className="p-6 overflow-y-auto flex flex-col items-center justify-center bg-slate-950/90 gap-4">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800 max-w-xl w-full bg-slate-900 flex justify-center">
                <img
                  src={`/api/bot/profile-card-preview/${selectedUserForCard.id}?lang=${cardLang}&t=${Date.now()}`}
                  alt="On Ao Music Profile Card"
                  className="w-full h-auto object-contain rounded-xl"
                  loading="lazy"
                />
              </div>

              {/* Feature Highlights Banner */}
              <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Strict Username
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Nama di kartu selalu username akun (@username), bukan display name server.
                  </p>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                    Bilingual Support
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Mendukung Bahasa Indonesia & English lewat perintah <code className="text-sky-300 font-mono">/language</code>.
                  </p>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Ultra High-Performance
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Render instan dengan C++ @napi-rs/canvas dan cache cerdas tanpa lag.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full max-w-xl flex items-center justify-between pt-2 border-t border-slate-800/80">
                <div className="text-xs text-slate-400">
                  Discord: <code className="text-emerald-400 font-mono font-semibold">on profile</code> atau <code className="text-emerald-400 font-mono font-semibold">/profile</code>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/bot/profile-card-preview/${selectedUserForCard.id}?lang=${cardLang}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Penuh</span>
                  </a>
                  <a
                    href={`/api/bot/profile-card-preview/${selectedUserForCard.id}?lang=${cardLang}`}
                    download={`on-ao-profile-${selectedUserForCard.id}.png`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950/40 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
