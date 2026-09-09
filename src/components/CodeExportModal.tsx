import React, { useState } from 'react';
import { X, FileCode, Copy, Check, Terminal, ExternalLink, Download, Sparkles, Server, ShieldCheck } from 'lucide-react';

interface CodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodeExportModal: React.FC<CodeExportModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'replit' | 'bot' | 'package' | 'env' | 'profiles'>('replit');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const files: Record<string, { filename: string; language: string; content: string }> = {
    bot: {
      filename: 'bot.cjs',
      language: 'javascript',
      content: `// On Ao Discord Music Bot
// Jalankan dengan: node bot.cjs
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
// (File lengkap bot.cjs tersedia dalam paket ZIP download)`
    },
    package: {
      filename: 'package.json',
      language: 'json',
      content: `{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs",
    "bot": "node bot.cjs"
  },
  "dependencies": {
    "discord.js": "^14.27.0",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "lavalink-client": "^2.11.0"
  }
}`
    },
    env: {
      filename: '.env.example',
      language: 'bash',
      content: `# Discord Bot Secrets untuk Replit Tools -> Secrets:
TOKEN="YOUR_DISCORD_BOT_TOKEN_HERE"
GUILD_ID=""
CLIENT_ID=""`
    },
    profiles: {
      filename: 'profiles.json',
      language: 'json',
      content: `{}`
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Export & Paket Hosting Bot (Universal)</h3>
              <p className="text-xs text-slate-400">Download ZIP bot siap host di Discloud, VPS, Pterodactyl, Replit, PC</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File / Guide Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800/80 bg-slate-950/60 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('replit')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'replit'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Panduan Hosting</span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">Ready</span>
          </button>

          {(Object.keys(files) as Array<'bot' | 'package' | 'env' | 'profiles'>).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 shrink-0 ${
                activeTab === tab
                  ? 'border-emerald-400 text-emerald-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{files[tab].filename}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col space-y-4">
          {activeTab === 'replit' ? (
            <div className="space-y-4 text-xs text-slate-300">
              {/* Dual Download Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Standalone Bot ZIP */}
                <div className="p-4 rounded-xl bg-slate-900 border-2 border-emerald-500/40 hover:border-emerald-500/70 transition-all flex flex-col justify-between space-y-3 shadow-lg">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-300 text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>ZIP Bot Standalone</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">~31 KB</span>
                    </div>
                    <p className="text-slate-400 mt-1.5 leading-relaxed">
                      <strong>Rekomendasi Terbaik!</strong> Khusus bot Discord murni: langsung jalan dengan <code className="text-emerald-300 font-mono">npm start</code> tanpa perlu build. Cocok untuk Discloud, VPS, Pterodactyl, Railway, atau PC.
                    </p>
                  </div>
                  <a
                    id="btn-modal-dl-standalone"
                    href="/api/download-bot-zip"
                    download="discord-bot-standalone.zip"
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Bot ZIP (Siap Host)</span>
                  </a>
                </div>

                {/* Full Project ZIP */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                        <Server className="w-4 h-4 text-slate-400" />
                        <span>Full Project + Web UI</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono font-bold">~101 KB</span>
                    </div>
                    <p className="text-slate-400 mt-1.5 leading-relaxed">
                      Seluruh source code lengkap termasuk Web Dashboard React + Express server kontrol status bot.
                    </p>
                  </div>
                  <a
                    id="btn-modal-dl-full"
                    href="/api/download-zip"
                    download="discord-bot-full-project.zip"
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Full Project ZIP</span>
                  </a>
                </div>
              </div>

              {/* Hosting Platforms Guide */}
              <div className="space-y-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span>Panduan Hosting Tempat Lain (Pilih Salah Satu):</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  {/* Discloud */}
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <strong className="text-emerald-400 font-semibold block mb-1">1. Discloud (Gratis 24/7)</strong>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Buka <span className="text-slate-200 font-medium">discloudbot.com</span> → Upload file ZIP Standalone ini. File <code className="text-slate-300 font-mono">discloud.config</code> sudah kami sediakan!
                    </p>
                  </div>

                  {/* Panel Pterodactyl / Bot-Hosting */}
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <strong className="text-emerald-400 font-semibold block mb-1">2. Panel Hosting (Bot-Hosting/Falix)</strong>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Pilih server Node.js 18/20 → Upload dan Extract ZIP → Isi <code className="text-slate-300 font-mono">.env</code> dengan token bot Anda → Klik Start.
                    </p>
                  </div>

                  {/* VPS PM2 */}
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <strong className="text-emerald-400 font-semibold block mb-1">3. VPS Sendiri (Linux/Ubuntu)</strong>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Ekstrak ZIP di server, lalu jalankan:
                      <br />
                      <code className="text-amber-300 font-mono bg-slate-950 px-1 py-0.5 rounded">npm install && pm2 start bot.cjs --name bot</code>
                    </p>
                  </div>

                  {/* Komputer Sendiri */}
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <strong className="text-emerald-400 font-semibold block mb-1">4. PC / Laptop Sendiri</strong>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Ekstrak folder → Buka terminal di folder tersebut:
                      <br />
                      <code className="text-amber-300 font-mono bg-slate-950 px-1 py-0.5 rounded">npm install && node bot.cjs</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* Discord Portal Warning */}
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Ingat di Discord Developer Portal:</strong> Buka tab <strong>Bot</strong> dan pastikan <strong>Message Content Intent</strong> diaktifkan (ON) agar bot dapat merespons prefix <code className="text-amber-200 font-mono font-bold">on play</code>, <code className="text-amber-200 font-mono font-bold">on skip</code>, dll.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-mono">
                  {files[activeTab].filename} ({files[activeTab].language})
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(files[activeTab].content)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin File'}</span>
                </button>
              </div>

              <pre className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-auto font-mono text-xs text-slate-300 leading-relaxed min-h-[200px]">
                <code>{files[activeTab].content}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
