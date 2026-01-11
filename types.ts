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
  // Primary
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;

  // Secondary
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;

  // Tertiary
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;

  // Error
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  // Background & Surface
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;

  // Outline
  outline: string;
  outlineVariant: string;
  
  // Custom Scrim/Shadow (Optional but useful)
  scrim?: string;
  shadow?: string;
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