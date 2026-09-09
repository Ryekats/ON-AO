import React, { useState, useEffect, useCallback } from 'react';
import { 
  BotStatusBanner 
} from './components/BotStatusBanner';
import { 
  MusicControllerPreview 
} from './components/MusicControllerPreview';
import { 
  LavalinkStatusCard 
} from './components/LavalinkStatusCard';
import { 
  LiveConsoleLogs 
} from './components/LiveConsoleLogs';
import { 
  CommandsReference 
} from './components/CommandsReference';
import { 
  MusicProfilesLeaderboard 
} from './components/MusicProfilesLeaderboard';
import { 
  BotConfigurationModal 
} from './components/BotConfigurationModal';
import { 
  CodeExportModal 
} from './components/CodeExportModal';
import { 
  IntentGuideModal 
} from './components/IntentGuideModal';
import { 
  BotStatus, 
  BotLog, 
  ProfilesMap, 
  BotCommand, 
  BotConfig 
} from './types';
import { keepAliveEngine } from './utils/keepAliveManager';
import { 
  Radio, 
  Terminal, 
  Sparkles, 
  Trophy, 
  Code2, 
  Settings, 
  Disc3, 
  Layers,
  AlertTriangle,
  Download
} from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [profiles, setProfiles] = useState<ProfilesMap>({});
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'controller' | 'commands' | 'logs' | 'profiles'>('controller');
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isCodeExportOpen, setIsCodeExportOpen] = useState<boolean>(false);
  const [isIntentGuideOpen, setIsIntentGuideOpen] = useState<boolean>(false);

  // Fetch Bot Status & Logs
  const fetchStatusAndLogs = useCallback(async () => {
    try {
      const [resStatus, resLogs] = await Promise.all([
        fetch('/api/bot/status'),
        fetch('/api/bot/logs')
      ]);
      if (resStatus.ok) {
        const data = await resStatus.json();
        setStatus(data);
      }
      if (resLogs.ok) {
        const logData = await resLogs.json();
        setLogs(logData.logs || []);
      }
    } catch (e) {
      // Backend maybe restarting
    }
  }, []);

  // Fetch Static Data (Commands, Profiles, Config)
  const fetchInitialData = useCallback(async () => {
    try {
      const [resCmds, resProf, resConf] = await Promise.all([
        fetch('/api/bot/commands'),
        fetch('/api/bot/profiles'),
        fetch('/api/bot/config')
      ]);
      if (resCmds.ok) setCommands(await resCmds.json());
      if (resProf.ok) setProfiles(await resProf.json());
      if (resConf.ok) setConfig(await resConf.json());
    } catch (e) {}
  }, []);

  useEffect(() => {
    // 1. Inisialisasi Engine Keep-Alive (Web Audio + Web Worker + Web Locks + WakeLock)
    keepAliveEngine.init();

    fetchStatusAndLogs();
    fetchInitialData();

    // Polling berkala status & logs
    const interval = setInterval(fetchStatusAndLogs, 2500);

    // Mulus menyinkronkan data saat tab browser preview aktif kembali tanpa reload
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStatusAndLogs();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [fetchStatusAndLogs, fetchInitialData]);

  // Bot Action Handlers
  const handleStartBot = async () => {
    setLoadingAction(true);
    try {
      await fetch('/api/bot/start', { method: 'POST' });
      await fetchStatusAndLogs();
    } finally {
      setTimeout(() => setLoadingAction(false), 800);
    }
  };

  const handleStopBot = async () => {
    setLoadingAction(true);
    try {
      await fetch('/api/bot/stop', { method: 'POST' });
      await fetchStatusAndLogs();
    } finally {
      setTimeout(() => setLoadingAction(false), 800);
    }
  };

  const handleRestartBot = async () => {
    setLoadingAction(true);
    try {
      await fetch('/api/bot/restart', { method: 'POST' });
      await fetchStatusAndLogs();
    } finally {
      setTimeout(() => setLoadingAction(false), 1200);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/bot/logs/clear', { method: 'POST' });
      setLogs([]);
    } catch (e) {}
  };

  const handleSaveConfig = async (newConfig: Partial<BotConfig>): Promise<boolean> => {
    try {
      const res = await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        setConfig(prev => ({ ...(prev || ({} as BotConfig)), ...newConfig } as BotConfig));
        await fetchStatusAndLogs();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navigation & Status Bar */}
      <BotStatusBanner
        status={status}
        loadingAction={loadingAction}
        onStart={handleStartBot}
        onStop={handleStopBot}
        onRestart={handleRestartBot}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Intent Missing Notice Banner */}
        {status?.hasMessageContentIntent === false && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-amber-300 text-sm sm:text-base">
                    Perhatian: Prefix Chat <code className="bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-200 font-mono">on</code> Butuh Dicentang di Discord
                  </h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Mode Darurat Slash Aktif
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Discord memblokir isi chat teks biasa karena opsi <strong className="text-amber-200">Message Content Intent</strong> belum dinyalakan di Discord Developer Portal. Bot tetap online dan bisa memutar musik lewat Slash Command <code className="text-indigo-300 font-mono">/play</code>. Cukup 1 klik toggle di Discord untuk mengaktifkan prefix <code className="text-emerald-300 font-mono">on</code>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setIsIntentGuideOpen(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Panduan Cepat (15 Detik)</span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              id="tab-controller"
              type="button"
              onClick={() => setActiveTab('controller')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'controller'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Controller</span>
            </button>

            <button
              id="tab-commands"
              type="button"
              onClick={() => setActiveTab('commands')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'commands'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Commands & Prefix (on)</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'commands' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                {commands.length || 23}
              </span>
            </button>

            <button
              id="tab-logs"
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Console Logs</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'logs' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                {logs.length}
              </span>
            </button>

            <button
              id="tab-profiles"
              type="button"
              onClick={() => setActiveTab('profiles')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'profiles'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Profiles & Stats</span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <a
              id="btn-download-bot-zip"
              href="/api/download-bot-zip"
              download="discord-bot-standalone.zip"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
              title="Download Standalone Bot ZIP (Ringan, langsung run di VPS / Discloud / Pterodactyl / Railway)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ZIP Bot</span>
            </a>
            <button
              id="btn-view-code"
              type="button"
              onClick={() => setIsCodeExportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              title="Lihat Panduan Hosting & Ekspor Kode Lengkap"
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Panduan Hosting & File</span>
            </button>
          </div>
        </div>

        {/* Tab Content Display */}
        {activeTab === 'controller' && (
          <div className="space-y-6">
            <LavalinkStatusCard />
            <MusicControllerPreview />

            {/* Quick Overview Bento Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 flex items-start gap-3.5">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Disc3 className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Lavalink Engine</h3>
                  <p className="text-sm font-semibold text-slate-200 mt-1">Serenetia v4 Cluster</p>
                  <p className="text-xs text-slate-400 mt-0.5">High-bitrate audio streaming with zero lag</p>
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 flex items-start gap-3.5">
                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Automation Mode</h3>
                  <p className="text-sm font-semibold text-slate-200 mt-1">24/7 & AutoPlay Support</p>
                  <p className="text-xs text-slate-400 mt-0.5">Tetap aktif di Voice Channel tanpa batas waktu</p>
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 flex items-start gap-3.5">
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Audio DSP Filters</h3>
                  <p className="text-sm font-semibold text-slate-200 mt-1">Bassboost, 8D, Nightcore</p>
                  <p className="text-xs text-slate-400 mt-0.5">Filter audio langsung diaktifkan via Discord</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'commands' && (
          <CommandsReference 
            commands={commands} 
            initialGuildId={config?.guildId || ''} 
            hasMessageContentIntent={status?.hasMessageContentIntent !== false}
            onOpenGuide={() => setIsIntentGuideOpen(true)}
            onGuildUpdated={(newGid) => {
              setConfig(prev => ({ ...(prev || ({} as BotConfig)), guildId: newGid } as BotConfig));
            }}
          />
        )}

        {activeTab === 'logs' && (
          <LiveConsoleLogs
            logs={logs}
            onClearLogs={handleClearLogs}
            onRefreshLogs={fetchStatusAndLogs}
          />
        )}

        {activeTab === 'profiles' && (
          <MusicProfilesLeaderboard profiles={profiles} />
        )}
      </main>

      {/* Configuration Modal */}
      <BotConfigurationModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />

      {/* Code Export Modal */}
      <CodeExportModal
        isOpen={isCodeExportOpen}
        onClose={() => setIsCodeExportOpen(false)}
      />

      {/* Intent Guide Modal */}
      <IntentGuideModal
        isOpen={isIntentGuideOpen}
        onClose={() => setIsIntentGuideOpen(false)}
        onRestartBot={handleRestartBot}
        isRestarting={loadingAction}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        On Ao Discord Music Bot Studio • Discord.js v14 & Lavalink v4 • Server Ready
      </footer>
    </div>
  );
}
