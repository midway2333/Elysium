export interface Song {
  id: string;
  file: File;
  name: string;
  artist?: string;
  url: string;
  coverUrl?: string; // Blob URL for album art
}

export enum PlaybackMode {
  SEQUENCE = 'SEQUENCE',
  REPEAT_ALL = 'REPEAT_ALL',
  REPEAT_ONE = 'REPEAT_ONE',
  SHUFFLE = 'SHUFFLE',
}

export interface ThemeColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  background: string;
}

export const DEFAULT_THEME_COLOR = '#6750A4'; // MD3 default purple

export interface PlaybackLog {
  songId: string;
  songName: string;
  artist: string;
  timestamp: number; // When the session ended
  duration: number; // Seconds played
}

export interface AppSettings {
  pauseOnDisconnect: boolean;
  enableBlur: boolean;
}