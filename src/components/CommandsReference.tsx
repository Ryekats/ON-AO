import React, { useState } from 'react';
import { Terminal, Copy, Check, Filter, Search, Sparkles, Zap, Server, AlertCircle, HelpCircle, Loader2 } from 'lucide-react';
import { BotCommand } from '../types';

interface CommandsReferenceProps {
  commands: BotCommand[];
  initialGuildId?: string;
  onGuildUpdated?: (guildId: string) => void;
  hasMessageContentIntent?: boolean;
  onOpenGuide?: () => void;
}

export const CommandsReference: React.FC<CommandsReferenceProps> = ({ 
  commands, 
  initialGuildId = '',
  onGuildUpdated,
  hasMessageContentIntent = true,
  onOpenGuide
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [copyMode, setCopyMode] = useState<'slash' | 'prefix'>('prefix');

  // Instant Deploy State
  const [guildIdInput, setGuildIdInput] = useState<string>(initialGuildId);
  const [deploying, setDeploying] = useState<boolean>(false);
  const [deployMessage, setDeployMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showHelper, setShowHelper] = useState<boolean>(false);

  const categories = [
    { id: 'all', label: 'Semua Command', count: commands.length },
    { id: 'playback', label: 'Playback Musik', count: commands.filter(c => c.category === 'playback').length },
    { id: 'queue', label: 'Antrian & Playlist', count: commands.filter(c => c.category === 'queue').length },
    { id: 'filters', label: 'Efek Audio (EQ/Bass)', count: commands.filter(c => c.category === 'filters').length },
    { id: 'dj', label: 'Sistem DJ', count: commands.filter(c => c.category === 'dj').length },
    { id: 'automation', label: 'AutoPlay & 24/7', count: commands.filter(c => c.category === 'automation').length },
    { id: 'utilities', label: 'Profil & Utilitas', count: commands.filter(c => c.category === 'utilities').length },
  ];

  const filteredCommands = commands.filter((cmd) => {
    const matchesCategory = selectedCategory === 'all' || cmd.category === selectedCategory;
    const matchesSearch =
      cmd.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cmd.desc.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopy = (cmdName: string) => {
    const textToCopy = copyMode === 'prefix' ? `on ${cmdName}` : `/${cmdName}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCmd(cmdName);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployMessage(null);
    try {
      const res = await fetch('/api/bot/deploy-commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: guildIdInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeployMessage({
          type: 'success',
          text: data.message || 'Slash commands berhasil didaftarkan!'
        });
        if (guildIdInput.trim()) {
          // Save guildId to config as well
          await fetch('/api/bot/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId: guildIdInput.trim() })
          });
          if (onGuildUpdated) onGuildUpdated(guildIdInput.trim());
        }
      } else {
        setDeployMessage({
          type: 'error',
          text: data.message || 'Gagal mendaftarkan slash commands.'
        });
      }
    } catch (err: any) {
      setDeployMessage({
        type: 'error',
        text: err.message || 'Terjadi kesalahan jaringan.'
      });
    } finally {
      setDeploying(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'playback':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'queue':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'filters':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'dj':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'automation':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Instant Deployer Widget */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                Deploy Slash Commands Instan (Tanpa Delay 1 Jam)
              </h3>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Secara default, pendaftaran command <span className="font-semibold text-amber-300">Global</span> membutuhkan waktu cache Discord hingga <strong>1 jam</strong>. Masukkan <strong>Guild ID (Server ID)</strong> kamu di bawah agar semua 19 commands langsung <strong>aktif detik ini juga</strong> di server kamu!
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowHelper(!showHelper)}
            className="self-start lg:self-center inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <span>Cara dapat Guild ID?</span>
          </button>
        </div>

        {/* Guild ID Helper Drawer */}
        {showHelper && (
          <div className="mt-4 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1.5 animate-in fade-in">
            <p className="font-semibold text-indigo-300">📌 Cara Menyalin Server ID di Discord:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>Buka Discord ➔ User Settings (ikon gear) ➔ menu <strong>Advanced</strong> ➔ aktifkan <strong>Developer Mode</strong>.</li>
              <li>Klik kanan ikon/nama Server Discord kamu di sidebar kiri.</li>
              <li>Klik <strong>Copy Server ID</strong> (ID berupa deretan angka panjang, misal: <code className="text-emerald-400 font-mono">112233445566778899</code>).</li>
              <li>Tempel (paste) ID tersebut di kotak input bawah dan klik <strong>Deploy Instan</strong>.</li>
            </ol>
          </div>
        )}

        {/* Input & Deploy Button */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Server className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Masukkan Discord Server / Guild ID (contoh: 120521893049182390)"
              value={guildIdInput}
              onChange={(e) => setGuildIdInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <button
            type="button"
            onClick={handleDeploy}
            disabled={deploying}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap"
          >
            {deploying ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mendaftarkan ke Discord...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{guildIdInput.trim() ? 'Deploy Instan ke Server' : 'Deploy Global'}</span>
              </span>
            )}
          </button>
        </div>

        {/* Status Message */}
        {deployMessage && (
          <div
            className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 ${
              deployMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {deployMessage.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{deployMessage.text}</span>
          </div>
        )}
      </div>

      {/* Prefix "on" Highlight Banner */}
      <div className={`border rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
        hasMessageContentIntent 
          ? 'bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border-emerald-500/40'
          : 'bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border-amber-500/50'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center font-mono font-black text-lg shadow-inner ${
            hasMessageContentIntent
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
          }`}>
            on
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                Prefix Chat: <code className={`font-mono font-bold px-2 py-0.5 rounded border ${
                  hasMessageContentIntent 
                    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                    : 'text-amber-300 bg-amber-500/15 border-amber-500/30'
                }`}>on</code>
              </h3>
              {hasMessageContentIntent ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Respon Cepat Aktif
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Menunggu Intent di Discord
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {hasMessageContentIntent ? (
                <span>Kamu bisa langsung mengetik perintah di text channel mana saja dengan format <code className="text-emerald-400 font-mono">on &lt;command&gt;</code> tanpa harus memilih slash command! (Contoh: <code className="text-emerald-300 font-mono">on play judul lagu</code>, <code className="text-emerald-300 font-mono">on skip</code>, <code className="text-emerald-300 font-mono">on eq hifi</code>).</span>
              ) : (
                <span>
                  <strong className="text-amber-200">Perhatian:</strong> Bot belum bisa membaca teks chat karena opsi <strong>Message Content Intent</strong> belum dinyalakan di Discord Developer Portal. Sementara ini kamu bisa menggunakan <code className="text-indigo-400 font-mono font-bold">/play</code> atau klik tombol di sebelah kanan untuk panduan 15 detik.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
          {!hasMessageContentIntent && onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Aktifkan (Panduan 15s)</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setCopyMode('prefix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                copyMode === 'prefix'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Prefix: on &lt;cmd&gt;
            </button>
            <button
              type="button"
              onClick={() => setCopyMode('slash')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                copyMode === 'slash'
                  ? 'bg-indigo-600 text-white shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Slash: /&lt;cmd&gt;
            </button>
          </div>
        </div>
      </div>

      {/* Main Commands Table & Directory */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                Daftar Perintah Bot ({commands.length} Commands)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Mendukung ganda: ketik <span className="text-emerald-400 font-mono font-medium">on &lt;command&gt;</span> di chat atau gunakan <span className="text-indigo-400 font-mono font-medium">/&lt;command&gt;</span>.
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Cari perintah atau fitur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCategory === cat.id ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Grid of Command Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
          {filteredCommands.map((cmd) => (
            <div
              key={cmd.name}
              className="group bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-sm text-emerald-400">
                      on {cmd.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      (/{cmd.name})
                    </span>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${getCategoryBadge(
                      cmd.category
                    )}`}
                  >
                    {cmd.category}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{cmd.desc}</p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-mono truncate max-w-[170px]" title={cmd.params}>
                  {cmd.params === 'None' ? 'Tanpa opsi' : cmd.params}
                </span>

                <button
                  type="button"
                  onClick={() => handleCopy(cmd.name)}
                  className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-mono"
                  title={copyMode === 'prefix' ? `Salin 'on ${cmd.name}'` : `Salin '/${cmd.name}'`}
                >
                  {copiedCmd === cmd.name ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Disalin!</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copyMode === 'prefix' ? `on ${cmd.name}` : `/${cmd.name}`}</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
