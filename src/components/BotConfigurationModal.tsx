import React, { useState, useEffect } from 'react';
import { X, Key, Server, Save, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import { BotConfig } from '../types';

interface BotConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig | null;
  onSaveConfig: (newConfig: Partial<BotConfig>) => Promise<boolean>;
}

export const BotConfigurationModal: React.FC<BotConfigurationModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [token, setToken] = useState(config?.token || '');
  const [guildId, setGuildId] = useState(config?.guildId || '');
  const [lavalinkHost, setLavalinkHost] = useState(config?.lavalinkHost || 'lava-v4.millohost.my.id');
  const [lavalinkPort, setLavalinkPort] = useState(config?.lavalinkPort || '443');
  const [lavalinkPassword, setLavalinkPassword] = useState(config?.lavalinkPassword || 'https://discord.gg/mjS5J2K3ep');
  const [botLanguage, setBotLanguage] = useState<'id' | 'en'>('id');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (config) {
      if (config.token) setToken(config.token);
      if (config.guildId) setGuildId(config.guildId);
      if (config.lavalinkHost) setLavalinkHost(config.lavalinkHost);
      if (config.lavalinkPort) setLavalinkPort(config.lavalinkPort);
      if (config.lavalinkPassword) setLavalinkPassword(config.lavalinkPassword);
    }
  }, [config]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/bot/language')
      .then(res => res.json())
      .then(data => {
        if (data?.defaultLanguage) setBotLanguage(data.defaultLanguage);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const ok = await onSaveConfig({
        token,
        guildId,
        lavalinkHost,
        lavalinkPort,
        lavalinkPassword,
      });

      // Also persist bot language setting
      await fetch('/api/bot/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: botLanguage })
      }).catch(() => {});

      if (ok) {
        setMessage({ type: 'success', text: 'Konfigurasi & Bahasa berhasil disimpan!' });
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setMessage({ type: 'error', text: 'Gagal menyimpan konfigurasi.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-slate-100 text-base">Konfigurasi Bot & Lavalink</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {message && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Token */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              Discord Bot Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Masukkan Discord Bot Token..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Didapatkan dari Discord Developer Portal &gt; Applications &gt; Bot &gt; Reset Token
            </span>
          </div>

          {/* Discord Server/Guild ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              Discord Server ID / Guild ID (Opsional - untuk Update Instan)
            </label>
            <input
              type="text"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              placeholder="Contoh: 120521893049182390"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Jika diisi, slash commands langsung muncul instan di server tersebut tanpa menunggu jeda cache 1 jam.
            </span>
          </div>

          {/* Lavalink Host */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Lavalink Node Host
              </label>
              <input
                type="text"
                value={lavalinkHost}
                onChange={(e) => setLavalinkHost(e.target.value)}
                placeholder="lavalinkv4.serenetia.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Port</label>
              <input
                type="text"
                value={lavalinkPort}
                onChange={(e) => setLavalinkPort(e.target.value)}
                placeholder="443"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Quick Presets for Lavalink */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 mr-1">Preset Cepat:</span>
            <button
              type="button"
              onClick={() => {
                setLavalinkHost('lava-v4.millohost.my.id');
                setLavalinkPort('443');
                setLavalinkPassword('https://discord.gg/mjS5J2K3ep');
              }}
              className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 hover:bg-emerald-900/80 text-emerald-300 font-medium transition-colors cursor-pointer"
            >
              MilloHost v4 (Live ⭐)
            </button>
            <button
              type="button"
              onClick={() => {
                setLavalinkHost('lavalinkv4.serenetia.com');
                setLavalinkPort('443');
                setLavalinkPassword('https://seretia.link/discord');
              }}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Serenetia v4 (Backup)
            </button>
          </div>

          {/* Lavalink Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Lavalink Node Password
            </label>
            <input
              type="text"
              value={lavalinkPassword}
              onChange={(e) => setLavalinkPassword(e.target.value)}
              placeholder="https://seretia.link/discord"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Bot Language Preference */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                Bahasa Bot Default (Bot Language)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">/language & on language</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setBotLanguage('id')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  botLanguage === 'id'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>🇮🇩</span>
                <span>Bahasa Indonesia</span>
              </button>
              <button
                type="button"
                onClick={() => setBotLanguage('en')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  botLanguage === 'en'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>🇬🇧</span>
                <span>English</span>
              </button>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Setiap user atau server juga bisa mengubah bahasa masing-masing via perintah <code className="text-sky-400 font-mono">/language [id|en]</code>.
            </span>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Menyimpan...' : 'Simpan & Terapkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
