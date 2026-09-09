import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, AlertTriangle, ShieldCheck, CheckCircle2, Clock, Zap, WifiOff, Activity } from 'lucide-react';
import { LavalinkNodeHealth, LavalinkStatusResponse } from '../types';

export const LavalinkStatusCard: React.FC = () => {
  const [nodeData, setNodeData] = useState<LavalinkNodeHealth | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/bot/lavalink-status');
        if (res.ok && isMounted) {
          const data: LavalinkStatusResponse = await res.json();
          if (data.nodes && data.nodes.length > 0) {
            const primary = data.nodes[0];
            setNodeData(primary);
            if (primary.nextRetryInMs) {
              setCountdown(Math.ceil(primary.nextRetryInMs / 1000));
            } else {
              setCountdown(0);
            }
          }
        }
      } catch (e) {}
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Tick local countdown every second for smooth UI feedback
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleForceReconnect = async () => {
    setReconnecting(true);
    try {
      await fetch('/api/bot/lavalink-reconnect', { method: 'POST' });
    } catch (e) {}
    setTimeout(() => setReconnecting(false), 2000);
  };

  const status = nodeData?.status || 'disconnected';
  const isConnected = status === 'connected';
  const isStruggling = status === 'struggling';
  const isReconnecting = status === 'reconnecting';
  const isCooldown = status === 'cooldown';

  const getStatusBadge = () => {
    if (isConnected) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>STABLE & CONNECTED</span>
        </span>
      );
    }
    if (isStruggling) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>STRUGGLING (BACKOFF ACTIVE)</span>
        </span>
      );
    }
    if (isReconnecting) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/40 shadow-sm">
          <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
          <span>RECONNECTING...</span>
        </span>
      );
    }
    if (isCooldown) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-sm">
          <Clock className="w-3.5 h-3.5 text-rose-400" />
          <span>COOLDOWN ACTIVE</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
        <WifiOff className="w-3.5 h-3.5" />
        <span>STANDBY</span>
      </span>
    );
  };

  return (
    <div className={`rounded-2xl border p-5 transition-all shadow-xl relative overflow-hidden ${
      isConnected
        ? 'bg-slate-900/90 border-slate-800'
        : isStruggling || isReconnecting
        ? 'bg-amber-950/20 border-amber-500/30'
        : isCooldown
        ? 'bg-rose-950/20 border-rose-500/30'
        : 'bg-slate-900/90 border-slate-800'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-inner ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : isStruggling
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
          }`}>
            <Radio className={`w-5 h-5 ${isConnected ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                Lavalink Node Connection Stability Manager
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Host: <strong className="text-slate-200">{nodeData?.host || 'Replit Custom SSL'}</strong> ({nodeData?.port || 443})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {getStatusBadge()}
          <button
            type="button"
            onClick={handleForceReconnect}
            disabled={reconnecting}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
            title="Picu Reconnect Manual Segera"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${reconnecting ? 'animate-spin' : ''}`} />
            <span>{reconnecting ? 'Mencoba...' : 'Reconnect Now'}</span>
          </button>
        </div>
      </div>

      {/* Detail Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-500 block font-medium">Status Node</span>
          <span className="font-mono font-bold capitalize text-slate-200">{status}</span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-500 block font-medium">Percobaan Gagal</span>
          <span className="font-mono font-bold text-amber-400">{nodeData?.attempts || 0} / 7</span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-500 block font-medium">Latensi Ping</span>
          <span className="font-mono font-bold text-emerald-400">{isConnected ? `${nodeData?.ping || 12} ms` : 'N/A'}</span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-500 block font-medium">Exponential Backoff</span>
          <span className="font-mono font-bold text-sky-400">
            {countdown > 0 ? `${countdown}s` : isConnected ? 'Idle' : 'Active'}
          </span>
        </div>
      </div>

      {/* STRUGGLING OR COOLDOWN NOTIFICATION BANNER */}
      {!isConnected && (
        <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
          <div className="flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <p className="font-bold text-amber-300">
                {isStruggling
                  ? `Node mengalami masalah koneksi! Melakukan Retry #${nodeData?.attempts || 1} dengan Exponential Backoff.`
                  : isCooldown
                  ? 'Node dalam periode cooldown 30 menit untuk mencegah kembung console log.'
                  : 'Node terputus dari server Lavalink.'}
              </p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                ⚡ <strong>Native Voice Engine Fallback Aktif:</strong> Pemutaran musik di Discord tetap berjalan normal menggunakan engine internal tanpa gangguan audio.
                {nodeData?.lastError && (
                  <span className="block mt-1 font-mono text-[10px] text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                    Sebab: {nodeData.lastError}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleForceReconnect}
            disabled={reconnecting}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-lg shrink-0 transition-all cursor-pointer shadow active:scale-95"
          >
            ⚡ Paksa Reconnect
          </button>
        </div>
      )}

      {isConnected && (
        <div className="text-[11px] text-slate-400 flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            Koneksi Lavalink aman & stabil. Audio streaming HD 100% aktif.
          </span>
          <span className="font-mono text-slate-500 text-[10px]">
            Diperbarui: {new Date(nodeData?.updatedAt || Date.now()).toLocaleTimeString('id-ID')}
          </span>
        </div>
      )}
    </div>
  );
};
