export interface BotStatus {
  status: 'online' | 'offline' | 'starting' | 'error';
  pid: number | null;
  uptime: number;
  tokenConfigured: boolean;
  tokenMasked: string;
  hasMessageContentIntent?: boolean;
  hasGuildMembersIntent?: boolean;
  keepAliveActive?: boolean;
  autoRestartEnabled?: boolean;
  lavalink: {
    host: string;
    port: string;
    secure: boolean;
  };
}

export interface BotLog {
  id: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'system';
  text: string;
}

export interface UserProfile {
  songs: number;
  seconds: number;
  commands: number;
  favSong: string | null;
  favCount: number;
}

export type ProfilesMap = Record<string, UserProfile>;

export interface BotCommand {
  name: string;
  category: 'playback' | 'filters' | 'automation' | 'utilities';
  desc: string;
  params: string;
}

export interface BotConfig {
  token: string;
  tokenMasked: string;
  guildId?: string;
  lavalinkHost: string;
  lavalinkPort: string;
  lavalinkPassword?: string;
  defaultVolume: number;
}

export interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  memberCount?: number;
  botInVoice: boolean;
  isPlaying: boolean;
  isPaused?: boolean;
  current?: {
    title: string;
    artist: string;
    durationMs: number;
    positionMs: number;
    uri: string;
    artworkUrl: string | null;
    requester: string;
  } | null;
  volume: number;
  loop: string;
  filter: string;
  filter_eq?: string;
  bassboost?: number;
  nightcore?: boolean;
  vaporwave?: boolean;
  eightD?: boolean;
  vocalboost?: boolean;
  crossfade?: number;
  queueCount: number;
}

export interface PlayerTrack {
  title: string;
  artist: string;
  durationMs: number;
  positionMs?: number;
  uri: string;
  artworkUrl: string | null;
  requester?: string;
}

export interface PlayerState {
  active: boolean;
  isPlaying: boolean;
  isPaused?: boolean;
  guildId?: string | null;
  guildName?: string | null;
  autoplay?: boolean;
  current: PlayerTrack | null;
  queue: PlayerTrack[];
  queueCount: number;
  volume: number;
  loop: string;
  filter: string;
  filter_eq?: string;
  bassboost?: number;
  nightcore?: boolean;
  vaporwave?: boolean;
  eightD?: boolean;
  vocalboost?: boolean;
  crossfade?: number;
  updatedAt: number;
}

export interface LavalinkNodeHealth {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  status: 'connected' | 'reconnecting' | 'struggling' | 'cooldown' | 'disconnected';
  attempts: number;
  nextRetryInMs: number;
  nextRetryTimestamp?: number;
  cooldownUntil?: number;
  lastConnectedAt?: number | null;
  lastError?: string | null;
  ping?: number | null;
  updatedAt: number;
}

export interface LavalinkStatusResponse {
  nodes: LavalinkNodeHealth[];
  updatedAt: number;
}
