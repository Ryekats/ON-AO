import React, { useState } from 'react';
import { X, ExternalLink, CheckCircle2, RotateCw, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';

interface IntentGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestartBot: () => Promise<void>;
  isRestarting?: boolean;
}

export const IntentGuideModal: React.FC<IntentGuideModalProps> = ({
  isOpen,
  onClose,
  onRestartBot,
  isRestarting = false,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const portalUrl = 'https://discord.com/developers/applications';

  const copyUrl = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                Mengaktifkan Prefix Chat <code className="text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded text-sm font-mono font-bold">on</code>
              </h2>
              <p className="text-xs text-slate-400">
                Langkah cepat mengaktifkan izin pembacaan pesan di Discord Developer Portal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-300">
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 text-amber-200 text-xs leading-relaxed">
            <strong className="font-bold text-amber-100">Kenapa tidak terjadi apa-apa saat mengetik `on play`?</strong>
            <p className="mt-1">
              Secara default, Discord <strong>menyensor / memblokir</strong> isi teks chat untuk bot pihak ketiga demi privasi pengguna, kecuali pemilik bot mencentang toggle <span className="font-semibold text-white">"Message Content Intent"</span> di portal developer. Tanpa ini, bot tidak tahu apa yang kamu ketik di Discord!
            </p>
          </div>

          <h3 className="font-bold text-slate-100 text-sm pt-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Langkah-Langkah (Hanya 15 Detik):
          </h3>

          <ol className="space-y-3">
            <li className="flex items-start gap-3 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/30">
                1
              </span>
              <div className="space-y-1.5 flex-1">
                <p className="font-medium text-slate-200">
                  Buka link Discord Developer Portal:
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
                  >
                    <span>Buka Developer Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={copyUrl}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                  >
                    {copiedLink ? 'Link Tersalin!' : 'Salin Link'}
                  </button>
                </div>
              </div>
            </li>

            <li className="flex items-start gap-3 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/30">
                2
              </span>
              <div>
                <p className="font-medium text-slate-200">
                  Pilih aplikasi bot Anda (misal: <strong className="text-white">On ao</strong>)
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Klik pada kartu bot yang ada di daftar Applications.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/30">
                3
              </span>
              <div>
                <p className="font-medium text-slate-200">
                  Klik menu <strong className="text-white">"Bot"</strong> di bilah navigasi sebelah kiri
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3 bg-slate-950/50 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/10">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                4
              </span>
              <div>
                <p className="font-medium text-slate-100">
                  Scroll ke bawah ke bagian <strong className="text-emerald-400">"Privileged Gateway Intents"</strong>
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Nyalakan toggle toggle berikut ke posisi <strong className="text-emerald-400">ON (Aktif)</strong>:
                </p>
                <div className="mt-2 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center gap-2 bg-slate-900 px-2.5 py-1.5 rounded border border-emerald-500/40 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>☑️ MESSAGE CONTENT INTENT (Wajib untuk prefix 'on')</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 px-2.5 py-1.5 rounded border border-indigo-500/40 text-indigo-300">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>☑️ SERVER MEMBERS INTENT (Wajib untuk Return to Origin & Voice Persistence)</span>
                  </div>
                </div>
              </div>
            </li>

            <li className="flex items-start gap-3 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/30">
                5
              </span>
              <div>
                <p className="font-medium text-slate-200">
                  Klik tombol hijau/biru <strong className="text-white">"Save Changes"</strong> di pojok kanan bawah layar Discord
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/30">
                6
              </span>
              <div className="space-y-2 flex-1">
                <p className="font-medium text-slate-200">
                  Kembali ke dashboard ini dan klik <strong className="text-emerald-400">Restart Bot</strong> di bawah:
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await onRestartBot();
                    onClose();
                  }}
                  disabled={isRestarting}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
                  <span>{isRestarting ? 'Mereset Bot...' : 'Restart Bot Sekarang'}</span>
                </button>
              </div>
            </li>
          </ol>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-slate-300">
                Mau langsung coba tanpa setup? Gunakan <strong>Slash Commands</strong>:
              </span>
            </div>
            <code className="text-indigo-400 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              /play
            </code>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
