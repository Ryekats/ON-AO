import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Copy, Check, ArrowDown, Search } from 'lucide-react';
import { BotLog } from '../types';

interface LiveConsoleLogsProps {
  logs: BotLog[];
  onClearLogs: () => void;
  onRefreshLogs: () => void;
}

export const LiveConsoleLogs: React.FC<LiveConsoleLogsProps> = ({
  logs,
  onClearLogs,
  onRefreshLogs,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'system' | 'stdout' | 'stderr'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    const matchesType = filterType === 'all' || log.type === filterType;
    const matchesSearch =
      !searchQuery ||
      log.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.timestamp.includes(searchQuery);
    return matchesType && matchesSearch;
  });

  const handleCopyLogs = () => {
    const fullText = logs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col h-[520px]">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-100">Live Console & Lavalink Logs</h2>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-mono transition-colors ${
              logs.length >= 250
                ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60 animate-pulse'
                : 'bg-slate-800 text-slate-400'
            }`}
            title="Log otomatis dibersihkan saat mendekati 300 baris untuk menjaga performa optimal"
          >
            {logs.length}/300 baris {logs.length >= 250 && '(Auto-clear ≤300)'}
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
            <input
              type="text"
              placeholder="Cari log..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md pl-7 pr-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 w-32 sm:w-40"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                filterType === 'all' ? 'bg-slate-800 text-slate-100 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterType('stdout')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                filterType === 'stdout' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Output
            </button>
            <button
              type="button"
              onClick={() => setFilterType('system')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                filterType === 'system' ? 'bg-slate-800 text-sky-400 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sistem
            </button>
            <button
              type="button"
              onClick={() => setFilterType('stderr')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                filterType === 'stderr' ? 'bg-slate-800 text-rose-400 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Error
            </button>
          </div>

          {/* Auto scroll toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-md border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
              autoScroll ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
            title={autoScroll ? 'Auto-scroll aktif' : 'Auto-scroll nonaktif'}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopyLogs}
            className="p-1.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
            title="Salin semua log"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClearLogs}
            className="p-1.5 rounded-md bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 text-slate-400 hover:text-rose-400 text-xs transition-colors cursor-pointer"
            title="Hapus log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal View Body */}
      <div
        ref={logContainerRef}
        className="flex-1 mt-3 bg-slate-950 rounded-xl p-3.5 font-mono text-xs overflow-y-auto border border-slate-800/80 space-y-1.5 selection:bg-emerald-500/30"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
            <Terminal className="w-8 h-8 opacity-40" />
            <p className="text-xs">Belum ada output log.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            let textColor = 'text-slate-300';
            let tagColor = 'text-slate-500';

            if (log.type === 'stderr' || log.text.includes('Error') || log.text.includes('❌')) {
              textColor = 'text-rose-300';
              tagColor = 'text-rose-500';
            } else if (log.type === 'system' || log.text.includes('[SYSTEM]')) {
              textColor = 'text-sky-300';
              tagColor = 'text-sky-500';
            } else if (log.text.includes('Online') || log.text.includes('✅') || log.text.includes('terhubung')) {
              textColor = 'text-emerald-300';
              tagColor = 'text-emerald-500';
            } else if (log.text.includes('⚠️') || log.text.includes('warning')) {
              textColor = 'text-amber-300';
              tagColor = 'text-amber-500';
            }

            return (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed hover:bg-slate-900/50 px-1.5 py-0.5 rounded">
                <span className="text-slate-600 text-[11px] shrink-0 select-none">{log.timestamp}</span>
                <span className={`text-[10px] uppercase font-bold shrink-0 ${tagColor} select-none`}>
                  [{log.type}]
                </span>
                <span className={`${textColor} break-all whitespace-pre-wrap`}>{log.text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
