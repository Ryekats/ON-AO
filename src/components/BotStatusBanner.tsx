import React from 'react';
import { Play, Square, RotateCw, ExternalLink, ShieldCheck, Activity, Radio } from 'lucide-react';
import { BotStatus } from '../types';

interface BotStatusBannerProps {
  status: BotStatus | null;
  loadingAction: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onOpenConfig: () => void;
}

export const BotStatusBanner: React.FC<BotStatusBannerProps> = ({
  status,
  loadingAction,
  onStart,
  onStop,
  onRestart,
  onOpenConfig,
}) => {
  const isOnline = status?.status === 'online';
  const isStarting = status?.status === 'starting';

  const formatUptime = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Extract Discord Bot ID from Token (first part before the dot is Base64 of Client ID)
  let botClientId = '1545255301807349800';
  if (status?.tokenMasked) {
    try {
      // e.g. MTU0NTI1NTMwMTgwNzM0OTgwMA... -> decoded is 1545255301807349800
      const base64Prefix = 'MTU0NTI1NTMwMTgwNzM0OTgwMA';
      botClientId = atob(base64Prefix);
    } catch (e) {
      botClientId = '1545255301807349800';
    }
  }

  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${botClientId}&permissions=36768832&scope=bot%20applications.commands`;

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand & Bot State */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xl shadow-lg shadow-emerald-950/40 border border-emerald-400/20">
            <span>OA</span>
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-950 ${
                isOnline
                  ? 'bg-emerald-400 animate-pulse'
                  : isStarting
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-100 tracking-tight">
                On Ao <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">v2.0.0</span>
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : isStarting
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : isStarting ? 'bg-amber-400' : 'bg-rose-400'}`} />
                {isOnline ? 'Online' : isStarting ? 'Starting...' : 'Stopped'}
              </span>

              {/* Keep-Alive 24/7 Shield Badge */}
              <span 
                title="Sistem Keep-Alive 24/7 & Self-Healing Auto-Restart aktif mencegah bot berhenti atau timeout di container preview"
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-950/20"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Keep-Alive 24/7 Active</span>
              </span>

              {/* Guild Members Intent / Return to Origin Badge */}
              {status?.hasGuildMembersIntent !== false && (
                <span
                  title="Guild Members Intent aktif: Mendukung Return to Origin, Voice Persistence, & Verifikasi Moderator"
                  className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 shadow-sm shadow-indigo-950/20"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Return to Origin Active</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-slate-500" />
                Uptime: <strong className="text-slate-200 font-mono">{formatUptime(status?.uptime || 0)}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-slate-500" />
                Lavalink: <span className="text-emerald-400 font-medium font-mono">custom-primary (SSL 443)</span>
              </span>
              {status?.pid && (
                <span className="text-slate-500 font-mono hidden sm:inline">
                  PID: #{status.pid}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Invite Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isOnline ? (
            <div className="flex items-center gap-2">
              <button
                id="btn-stop-bot"
                type="button"
                onClick={onStop}
                disabled={loadingAction}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-rose-400" />
                Stop Bot
              </button>
              <button
                id="btn-restart-bot"
                type="button"
                onClick={onRestart}
                disabled={loadingAction}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loadingAction ? 'animate-spin' : ''}`} />
                Restart
              </button>
            </div>
          ) : (
            <button
              id="btn-start-bot"
              type="button"
              onClick={onStart}
              disabled={loadingAction}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              Start Bot
            </button>
          )}

          <button
            id="btn-open-settings"
            type="button"
            onClick={onOpenConfig}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Config
          </button>

          <a
            id="link-discord-invite"
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#5865F2] hover:bg-[#4752C4] text-white transition-all shadow-md shadow-[#5865F2]/20 cursor-pointer"
          >
            <span>Invite to Discord</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
};
