import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  SkipForward, 
  SkipBack,
  Repeat, 
  Shuffle,
  Volume2, 
  Volume1,
  Music, 
  Radio, 
  Sparkles,
  Search,
  Copy,
  Check,
  Disc,
  Headphones,
  Sliders,
  Flame,
  Clock,
  Layers,
  Mic2,
  Bookmark,
  FastForward,
  ListMusic,
  Server,
  Zap,
  SlidersHorizontal,
  Waves,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { PlayerState, GuildInfo } from '../types';

export const MusicControllerPreview: React.FC = () => {
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [guilds, setGuilds] = useState<GuildInfo[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [simulatedPosMs, setSimulatedPosMs] = useState<number>(0);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [deployingCommands, setDeployingCommands] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);

  // Poll guilds list
  useEffect(() => {
    let isMounted = true;
    const fetchGuilds = async () => {
      try {
        const res = await fetch('/api/bot/guilds');
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.success && Array.isArray(data.guilds)) {
            setGuilds(data.guilds);
            // Default select active guild if not set
            setSelectedGuildId(prev => {
              if (prev && data.guilds.some((g: GuildInfo) => g.id === prev)) return prev;
              const playingGuild = data.guilds.find((g: GuildInfo) => g.isPlaying || g.botInVoice);
              return playingGuild ? playingGuild.id : (data.guilds[0]?.id || '');
            });
          }
        }
      } catch (e) {}
    };

    fetchGuilds();
    const interval = setInterval(fetchGuilds, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Poll live player state (per-guild or active)
  useEffect(() => {
    let isMounted = true;
    const fetchState = async () => {
      try {
        const url = selectedGuildId 
          ? `/api/bot/player-state?guildId=${selectedGuildId}` 
          : '/api/bot/player-state';
        const res = await fetch(url);
        if (res.ok && isMounted) {
          const data: PlayerState = await res.json();
          setPlayerState(data);
        }
      } catch (e) {}
    };

    fetchState();
    const interval = setInterval(fetchState, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedGuildId]);

  // Real-time Dynamic Timer progression simulation
  useEffect(() => {
    if (!playerState || !playerState.active || !playerState.current) {
      setSimulatedPosMs(0);
      return;
    }

    const cur = playerState.current;
    const basePos = cur.positionMs || 0;
    const serverTime = playerState.updatedAt || Date.now();
    const isPlaying = Boolean(playerState.isPlaying && !playerState.isPaused);
    const dur = cur.durationMs || 180000;

    if (!isPlaying) {
      setSimulatedPosMs(basePos);
      return;
    }

    const timer = setInterval(() => {
      const elapsed = Date.now() - serverTime;
      const currentSimulated = Math.min(dur, Math.max(0, basePos + elapsed));
      setSimulatedPosMs(currentSimulated);
    }, 100);

    return () => clearInterval(timer);
  }, [playerState]);

  const sendControl = async (action: string, data?: any) => {
    try {
      await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          guildId: selectedGuildId || playerState?.guildId,
          data
        })
      });
      // Fast refresh player state
      const url = selectedGuildId 
        ? `/api/bot/player-state?guildId=${selectedGuildId}` 
        : '/api/bot/player-state';
      const res = await fetch(url);
      if (res.ok) {
        const fresh = await res.json();
        setPlayerState(fresh);
      }
    } catch (e) {}
  };

  const handleDeployToAllGuilds = async () => {
    setDeployingCommands(true);
    setDeployResult(null);
    try {
      const res = await fetch('/api/bot/deploy-commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deployAll: true })
      });
      const data = await res.json();
      if (data.success) {
        setDeployResult(data.message || 'Slash commands sukses diaktifkan di semua server!');
      } else {
        setDeployResult(`Gagal: ${data.message}`);
      }
    } catch (err: any) {
      setDeployResult(`Error: ${err.message}`);
    } finally {
      setDeployingCommands(false);
      setTimeout(() => setDeployResult(null), 5000);
    }
  };

  const formatMs = (ms: number) => {
    if (!ms || isNaN(ms) || ms < 0) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    if (hours > 0) {
      return `${hours}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const isMusicActive = Boolean(playerState?.active && playerState?.current);
  const current = playerState?.current;

  // Real-time position & ratio calculations
  const durMs = current?.durationMs || 180000;
  const posMs = simulatedPosMs || current?.positionMs || 0;
  const progressRatio = Math.min(Math.max(posMs / (durMs || 1), 0), 1);
  const progressPercent = Math.round(progressRatio * 100);
  const remainingMs = Math.max(0, durMs - posMs);

  const quickCommands = [
    { title: 'keshi - LIMBO', cmd: 'on play keshi limbo' },
    { title: 'beabadoobee - Glue Song', cmd: 'on play beabadoobee glue song' },
    { title: 'Lofi Girl 24/7', cmd: 'on radio lofi' },
    { title: 'Vocal Booster (Jernih)', cmd: 'on vocal' },
    { title: 'Equalizer Menu', cmd: 'on filters' },
    { title: 'Crossfade 1s (Gapless)', cmd: 'on crossfade 1' },
    { title: 'Mode 24/7 (Stay in Voice)', cmd: 'on 247' },
    { title: 'Autoplay Rekomendasi', cmd: 'on autoplay' }
  ];

  const currentEQ = playerState?.filter_eq || 'flat';
  const currentBass = playerState?.bassboost || 0;
  const isNightcore = Boolean(playerState?.nightcore);
  const isVaporwave = Boolean(playerState?.vaporwave);
  const is8D = Boolean(playerState?.eightD);
  const isVocalBoost = Boolean(playerState?.vocalboost);
  const crossfadeSec = playerState?.crossfade || 0;

  return (
    <div id="live-controller-card" className="bg-slate-900/95 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-2xl relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* MULTI-GUILD SELECTOR BAR */}
      <div className="mb-5 bg-slate-950/90 border border-slate-800 rounded-xl p-3 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">Server Discord Aktif:</span>
            <span className="text-[11px] text-slate-400">({guilds.length || 0} Terdeteksi)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeployToAllGuilds}
              disabled={deployingCommands}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Daftarkan slash commands ke seluruh guild yang diikuti bot"
            >
              <Zap className={`w-3.5 h-3.5 ${deployingCommands ? 'animate-spin' : 'text-amber-400'}`} />
              <span>{deployingCommands ? 'Mendaftarkan...' : 'Sync Slash ke Semua Server'}</span>
            </button>
          </div>
        </div>

        {deployResult && (
          <div className="mt-2 text-xs font-mono p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{deployResult}</span>
          </div>
        )}

        {/* Guild Pills */}
        <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-slate-800/80">
          {guilds.length > 0 ? (
            guilds.map(g => {
              const isSelected = (selectedGuildId === g.id);
              const isPlayingInGuild = g.isPlaying;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGuildId(g.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {g.icon ? (
                    <img src={g.icon} alt={g.name} className="w-4 h-4 rounded-full" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300">
                      {g.name.substring(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="font-semibold truncate max-w-[140px]">{g.name}</span>
                  {isPlayingInGuild && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Lagu sedang berputar di server ini" />
                  )}
                </button>
              );
            })
          ) : (
            <div className="text-xs text-slate-500 italic py-1">
              Bot belum terhubung ke server atau sedang memuat daftar guild...
            </div>
          )}
        </div>
      </div>

      {/* Main Container Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-slate-800/80 pb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <Radio className={`w-5 h-5 ${isMusicActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              Live Studio Music Controller
              <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                isMusicActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isMusicActive ? '● PLAYING IN DISCORD' : 'STANDBY'}
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isMusicActive 
              ? 'Real-time player embed mirror with synchronized playback timer & interactive controls'
              : 'Bot standby di voice channel. Jalankan perintah di bawah ini untuk memulai pemutaran!'}
          </p>
        </div>

        {/* Action button for Audio Filters & Node indicator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isFilterPanelOpen || (playerState?.filter && playerState.filter !== 'Normal')
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Audio FX & Equalizer</span>
            {playerState?.filter && playerState.filter !== 'Normal' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 shadow-inner">
            <Disc className={`w-4 h-4 ${isMusicActive ? 'text-emerald-400 animate-spin' : 'text-slate-500'}`} />
            <span>Lavalink: <strong className="text-emerald-400 font-mono">custom-primary</strong></span>
          </div>
        </div>
      </div>

      {/* EXPANDABLE INTERACTIVE AUDIO FILTER & EQUALIZER PANEL */}
      {isFilterPanelOpen && (
        <div className="mb-6 bg-slate-950/95 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl relative z-10 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-100">Preset Audio Filters & Equalizer Studio</h3>
            </div>
            <button
              type="button"
              onClick={() => sendControl('reset_filters')}
              className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium transition-colors cursor-pointer"
            >
              Reset Semua Filter (Suara Asli)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Equalizer Presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Waves className="w-3.5 h-3.5 text-emerald-400" />
                Mastering Equalizer
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { id: 'vocal', name: '🎤 Vocal Booster (Vokal Jernih)', desc: 'Isolasi vokal penyanyi jelas & bening' },
                  { id: 'hifi', name: '✨ Hi-Fi Clarity (Studio Clean)', desc: 'Frekuensi jernih dengan separasi instrumen' },
                  { id: 'studio', name: '🎙️ Studio Warmth (Seimbang)', desc: 'Karakter suara hangat & nyaman di telinga' },
                  { id: 'deep bass', name: '🔊 Deep Bass HD (Solid)', desc: 'Dentuman bass punchy tanpa distorsi' },
                  { id: 'gaming', name: '🎮 Gaming & Spatial Audio', desc: 'Panggung suara luas untuk imersi maksimal' },
                  { id: 'treble', name: '🎸 Treble Boost (Akustik)', desc: 'Mempertegas cymbal dan senar gitar' },
                  { id: 'flat', name: '🔄 Flat (Normal Original)', desc: 'Suara natural asli tanpa polesan EQ' },
                ].map(eq => (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => sendControl('filter_eq', eq.id)}
                    className={`text-left px-3 py-2 rounded-xl text-xs border transition-all cursor-pointer flex items-center justify-between ${
                      currentEQ === eq.id
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">{eq.name}</p>
                      <p className="text-[10px] text-slate-400">{eq.desc}</p>
                    </div>
                    {currentEQ === eq.id && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Interactive Sound Effects */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-2">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Bass Boost Level
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { level: 0, label: 'Off' },
                    { level: 1, label: 'Low (+20%)' },
                    { level: 2, label: 'Med (+40%)' },
                    { level: 3, label: 'Max (+65%)' },
                  ].map(b => (
                    <button
                      key={b.level}
                      type="button"
                      onClick={() => sendControl('filter_bass', b.level)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center ${
                        currentBass === b.level
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-2">
                  <Headphones className="w-3.5 h-3.5 text-sky-400" />
                  Efek Suara Spasial & Kecepatan
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => sendControl('filter_nightcore', !isNightcore)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs border transition-all cursor-pointer flex items-center justify-between ${
                      isNightcore
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">🌙 Nightcore</p>
                      <p className="text-[10px] text-slate-400">Tempo 1.25x & pitch tinggi ceria</p>
                    </div>
                    <span className="text-[11px] font-mono">{isNightcore ? 'AKTIF' : 'OFF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendControl('filter_vaporwave', !isVaporwave)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs border transition-all cursor-pointer flex items-center justify-between ${
                      isVaporwave
                        ? 'bg-pink-500/20 border-pink-500 text-pink-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">🌊 Vaporwave</p>
                      <p className="text-[10px] text-slate-400">Slowed + Reverb rileks 80-an</p>
                    </div>
                    <span className="text-[11px] font-mono">{isVaporwave ? 'AKTIF' : 'OFF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendControl('filter_8d', !is8D)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs border transition-all cursor-pointer flex items-center justify-between ${
                      is8D
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">🎧 8D Spatial Audio</p>
                      <p className="text-[10px] text-slate-400">Audio berputar spasial telinga kiri & kanan</p>
                    </div>
                    <span className="text-[11px] font-mono">{is8D ? 'AKTIF' : 'OFF'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Crossfade / Gapless Playback */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-2">
                  <FastForward className="w-3.5 h-3.5 text-indigo-400" />
                  Crossfade / Gapless Playback
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  Transisi volume ramp halus saat lagu berganti sehingga <strong>tanpa jeda sunyi (silence gap)</strong> yang kaku.
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 1, 2, 3, 5].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => sendControl('crossfade', sec)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        crossfadeSec === sec
                          ? 'bg-indigo-500/25 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sec === 0 ? 'Off' : `${sec}s`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-indigo-300/80 mt-2 font-mono">
                  {crossfadeSec > 0 
                    ? `✓ Transisi ${crossfadeSec} detik aktif: Volume ramp saat lagu baru mulai.`
                    : 'Transisi mati: Pemutaran langsung standar.'}
                </p>
              </div>

              {/* Volume Remote Slider */}
              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-300 flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    Tingkat Volume Audio
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">{playerState?.volume || 100}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={playerState?.volume || 100}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    sendControl('volume', val);
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {isMusicActive && current ? (
        /* ACTIVE PLAYBACK VIEW WITH SYMMETRICAL EMBED & DYNAMIC TIMER */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
          {/* Discord Symmetrical Embed Card */}
          <div className="lg:col-span-8">
            <div className="bg-[#2B2D31] rounded-2xl border-l-4 border-[#1DB954] p-5 text-slate-200 shadow-2xl font-sans relative overflow-hidden">
              {/* Embed Author Header with Symmetrical Equalizer Visualizer */}
              <div className="flex items-center justify-between border-b border-slate-700/40 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-slate-950 font-black shadow-md">
                    OA
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-100">On Ao Music Studio</span>
                    <span className="text-[11px] text-emerald-400 ml-2 font-medium">• Sedang Diputar</span>
                  </div>
                </div>

                {/* Equalizer frequency bars for top-right balance */}
                <div className="flex items-end gap-0.5 h-4 px-2 py-0.5 bg-slate-900/60 rounded-lg border border-slate-700/50">
                  {[60, 100, 40, 80, 50, 90, 70].map((h, idx) => (
                    <div
                      key={idx}
                      style={{ height: `${playerState.isPlaying && !playerState.isPaused ? h : 20}%` }}
                      className="w-1 bg-emerald-400 rounded-full transition-all duration-300"
                    />
                  ))}
                </div>
              </div>

              {/* Symmetrical Track Info Card (Artwork + Metadata) */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-[#1E1F22] rounded-xl p-4 border border-slate-700/40">
                {current.artworkUrl ? (
                  <div className="relative group shrink-0">
                    <img
                      src={current.artworkUrl}
                      alt={current.title}
                      className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-xl border border-slate-700 shadow-xl"
                    />
                    <div className="absolute inset-0 rounded-xl bg-black/20 group-hover:bg-transparent transition-colors" />
                  </div>
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0 shadow-xl">
                    <Music className="w-10 h-10 text-emerald-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <a
                    href={current.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-base sm:text-lg font-extrabold text-[#00A8FC] hover:text-sky-400 hover:underline block leading-snug truncate transition-colors"
                  >
                    {current.title}
                  </a>
                  <p className="text-sm font-semibold text-slate-300 mt-1">{current.artist}</p>

                  {/* Metadata Pills Row */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1.5 font-medium">
                      <span>👤</span>
                      <span>Request: <strong className="text-emerald-400">{current.requester}</strong></span>
                    </span>

                    {playerState?.filter && playerState.filter !== 'Normal' && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono uppercase font-bold">
                        <span>🎛️</span>
                        <span>{playerState.filter}</span>
                      </span>
                    )}

                    {crossfadeSec > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-mono text-[11px] font-bold">
                        ⚡ Crossfade: {crossfadeSec}s
                      </span>
                    )}

                    {playerState?.autoplay && (
                      <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/30 flex items-center gap-1 font-mono text-[11px] font-bold" title="Autoplay Active: Skips seamlessly to recommendations">
                        <span>📻</span>
                        <span>Autoplay</span>
                      </span>
                    )}

                    <span className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono text-[11px]">
                      Vol: {playerState?.volume || 100}%
                    </span>
                  </div>
                </div>
              </div>

              {/* DYNAMIC REAL-TIME PROGRESS BAR & TIMER COMPONENT */}
              <div className="mt-4 bg-[#1E1F22] rounded-xl p-4 border border-slate-700/50 shadow-inner">
                {/* Timestamps & Percentage Row */}
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>{formatMs(posMs)}</span>
                  </div>

                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                    {progressPercent}%
                  </span>

                  <div className="text-slate-400 flex items-center gap-1">
                    <span>{formatMs(durMs)}</span>
                    <span className="text-[10px] text-slate-500">(-{formatMs(remainingMs)})</span>
                  </div>
                </div>

                {/* Symmetrical Dynamic Progress Track with Slider Thumb */}
                <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60 shadow-inner">
                  <div
                    style={{ width: `${progressPercent}%` }}
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full transition-all duration-100 relative"
                  >
                    {/* Glowing head indicator */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg border border-emerald-600 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* PLAYBACK TOGGLE BUTTONS ORGANIZED IN A CLEAN, PROFESSIONAL 2x5 GRID */}
              <div className="mt-5 pt-3 border-t border-slate-700/50">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    Interactive Studio Controls Grid (Klik langsung / salin perintah)
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                    className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Equalizer FX</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {/* ROW 1 */}
                  {/* 1. STOP BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      sendControl('stop');
                      copyToClipboard('on stop', 'btn-stop');
                    }}
                    className="px-3 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-bold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer group active:scale-95"
                    title="Stop Music & Leave Channel"
                  >
                    <Square className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                    <span>Stop</span>
                  </button>

                  {/* 2. PREVIOUS BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      sendControl('previous');
                      copyToClipboard('on previous', 'btn-prev');
                    }}
                    className="px-3 py-2.5 rounded-xl bg-[#313338] hover:bg-[#383A40] border border-slate-700/60 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-95"
                    title="Play Previous Track"
                  >
                    <SkipBack className="w-4 h-4 text-slate-300" />
                    <span>Back</span>
                  </button>

                  {/* 3. PAUSE / RESUME BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      sendControl(playerState?.isPlaying && !playerState?.isPaused ? 'pause' : 'resume');
                      copyToClipboard(playerState?.isPlaying && !playerState?.isPaused ? 'on pause' : 'on resume', 'btn-pause');
                    }}
                    className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-95 ${
                      playerState?.isPlaying && !playerState?.isPaused
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                    }`}
                    title={playerState?.isPlaying && !playerState?.isPaused ? 'Pause Playback' : 'Resume Playback'}
                  >
                    {playerState?.isPlaying && !playerState?.isPaused ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Resume</span>
                      </>
                    )}
                  </button>

                  {/* 4. SKIP BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      sendControl('skip');
                      copyToClipboard('on skip', 'btn-skip');
                    }}
                    className="px-3 py-2.5 rounded-xl bg-[#313338] hover:bg-[#383A40] border border-slate-700/60 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-95"
                    title="Skip Current Track"
                  >
                    <SkipForward className="w-4 h-4 text-slate-300" />
                    <span>Skip</span>
                  </button>

                  {/* 5. LOOP BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = playerState?.loop === 'off' ? 'track' : playerState?.loop === 'track' ? 'queue' : 'off';
                      sendControl('loop', nextMode);
                      copyToClipboard('on loop', 'btn-loop');
                    }}
                    className={`px-3 py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer active:scale-95 ${
                      playerState?.loop && playerState.loop !== 'off'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-[#313338] hover:bg-[#383A40] border-slate-700/60 text-slate-300'
                    }`}
                    title="Toggle Loop Mode"
                  >
                    <Repeat className="w-4 h-4" />
                    <span>Loop: {(playerState?.loop || 'off').toUpperCase()}</span>
                  </button>

                  {/* ROW 2 */}
                  {/* 6. SHUFFLE BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      sendControl('shuffle');
                      copyToClipboard('on shuffle', 'btn-shuffle');
                    }}
                    className="px-3 py-2.5 rounded-xl bg-[#313338] hover:bg-[#383A40] border border-slate-700/60 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-95"
                    title="Shuffle Queue Tracks"
                  >
                    <Shuffle className="w-4 h-4 text-slate-300" />
                    <span>Acak</span>
                  </button>

                  {/* 7. FORWARD 15s BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      sendControl('forward', 15);
                      copyToClipboard('on forward 15', 'btn-forward');
                    }}
                    className="px-3 py-2.5 rounded-xl bg-[#313338] hover:bg-[#383A40] border border-slate-700/60 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-95"
                    title="Forward 15 Seconds"
                  >
                    <FastForward className="w-4 h-4 text-slate-300" />
                    <span>+15s</span>
                  </button>

                  {/* 8. LYRICS BUTTON */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard('on lyrics', 'btn-lyrics')}
                    className="px-3 py-2.5 rounded-xl bg-[#313338] hover:bg-[#383A40] border border-slate-700/60 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-95"
                    title="View Song Lyrics"
                  >
                    <Mic2 className="w-4 h-4 text-emerald-400" />
                    <span>Lirik</span>
                  </button>

                  {/* 9. GRAB BUTTON */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard('on grab', 'btn-grab')}
                    className="px-3 py-2.5 rounded-xl bg-[#313338] hover:bg-[#383A40] border border-slate-700/60 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-95"
                    title="Save Song to Direct Message"
                  >
                    <Bookmark className="w-4 h-4 text-amber-400" />
                    <span>Simpan</span>
                  </button>

                  {/* 10. QUEUE BUTTON */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard('on queue', 'btn-queue')}
                    className="px-3 py-2.5 rounded-xl bg-[#313338] hover:bg-[#383A40] border border-slate-700/60 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer active:scale-95"
                    title="Show Full Queue"
                  >
                    <ListMusic className="w-4 h-4 text-sky-400" />
                    <span>Antrian</span>
                  </button>
                </div>

                {copiedCmd && (
                  <div className="mt-2 text-center text-[11px] font-mono text-emerald-400 animate-fade-in">
                    ✓ Perintah <strong>"{copiedCmd}"</strong> tersalin ke clipboard!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live Equalizer Stream & Queue */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Audio Stream Equalizer Waveform */}
            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Headphones className="w-4 h-4 text-emerald-400" />
                  Live Audio Stream
                </span>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">100% Bitrate HD</span>
              </div>
              <div className="flex items-end justify-between gap-1.5 h-14 py-1 px-2 bg-slate-900/60 rounded-xl border border-slate-800">
                {[40, 75, 55, 90, 65, 80, 45, 95, 60, 70, 85, 50, 65, 85, 70].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${playerState.isPlaying && !playerState.isPaused ? h : 15}%` }}
                    className="flex-1 bg-gradient-to-t from-emerald-600 via-teal-400 to-emerald-300 rounded-full transition-all duration-300"
                  />
                ))}
              </div>
            </div>

            {/* Next Tracks Queue Preview */}
            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Antrian Berikutnya ({playerState.queueCount || 0})
                </span>
              </div>
              {playerState.queue && playerState.queue.length > 0 ? (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {playerState.queue.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-200 truncate">{idx + 1}. {t.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{t.artist}</p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">{formatMs(t.durationMs)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-800 rounded-xl">
                  Tidak ada lagu lagi di antrian. Bot akan standby setelah lagu ini selesai.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* STANDBY / IDLE VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
          <div className="lg:col-span-7 bg-slate-950/80 rounded-2xl p-6 border border-slate-800/90 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center gap-3 text-slate-300 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Disc className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Player Standby di Discord</h3>
                  <p className="text-xs text-slate-400">
                    {selectedGuildId 
                      ? `Server: ${guilds.find(g => g.id === selectedGuildId)?.name || selectedGuildId} (Belum ada lagu diputar)`
                      : 'Belum ada lagu yang sedang diputar di voice channel.'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mt-4">
                Untuk memutar lagu secara instan, masuk ke Voice Channel di server Discord kamu, lalu ketik perintah prefix atau slash command:
              </p>

              {/* Command Quick Test Bar */}
              <div className="mt-4 bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 shadow-inner">
                <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-emerald-400" />
                  Format Perintah Cepat:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Contoh: on play keshi limbo"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const textToCopy = searchQuery.trim() || 'on play keshi limbo';
                      navigator.clipboard.writeText(textToCopy);
                      setCopiedQuery(true);
                      setTimeout(() => setCopiedQuery(false), 2000);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedQuery ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedQuery ? 'Tersalin!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Prefix: <strong className="text-emerald-400 font-mono">on</strong> (misal: <code>on play keshi limbo</code>)</span>
              <span>Slash: <strong className="text-indigo-400 font-mono">/play query: keshi limbo</strong></span>
            </div>
          </div>

          {/* Quick Command Pills */}
          <div className="lg:col-span-5 bg-slate-950/80 rounded-2xl p-6 border border-slate-800/90 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
              <Flame className="w-4 h-4 text-amber-400" />
              Rekomendasi Perintah Populer
            </div>
            <div className="space-y-2.5">
              {quickCommands.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 rounded-xl p-3 transition-all text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-200 truncate">{item.title}</p>
                    <p className="text-[11px] font-mono text-emerald-400 truncate">{item.cmd}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(item.cmd, `cmd-${idx}`)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                  >
                    {copiedCmd === `cmd-${idx}` ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Salin</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin</span>
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
