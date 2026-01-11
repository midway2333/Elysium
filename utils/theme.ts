import { ThemeColors } from '../types';

// --- Color Utility Functions ---

// Convert Hex to RGB object
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

// Convert RGB to HSL
const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
};

// Convert HSL to Hex
const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// Tonal Palette Helper (approximating Material Design tones 0-100)
// H: 0-360, S: 0-100
const getTone = (h: number, s: number, tone: number) => {
  // MD3 Tone 0 is black, 100 is white.
  // We approximate L value from Tone. 
  // Note: This is a simplification. MD3 uses HCT, but HSL L ~= Tone % is a decent fallback.
  // We apply a slight curve because L=50 is roughly Tone=50 for saturated colors, 
  // but for MD3, Tone 40 is standard Primary.
  let l = tone; 
  return hslToHex(h, s, l);
};

// --- Theme Generation ---

export const generateTheme = (seedHex: string): ThemeColors => {
  const rgb = hexToRgb(seedHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  
  // HSL values (S and L scaled to 0-100)
  const H = hsl.h;
  const S = hsl.s * 100;
  
  // --- Tonal Palettes ---
  // Primary: Based on seed
  // Secondary: Less saturated version of Primary
  // Tertiary: Shifted Hue (+60deg)
  // Neutral: Very low saturation
  
  const secH = H;
  const secS = Math.max(0, S - 40); // Desaturate for secondary
  
  const terH = (H + 60) % 360;
  const terS = Math.min(100, S + 10); // Slightly more saturated tertiary usually looks good

  const neuH = H;
  const neuS = 4; // Almost gray

  // --- Light Theme Mapping (MD3 Standard Tones) ---
  return {
    // Primary
    primary: getTone(H, S, 40),
    onPrimary: getTone(H, S, 100),
    primaryContainer: getTone(H, S, 90),
    onPrimaryContainer: getTone(H, S, 10),

    // Secondary
    secondary: getTone(secH, secS, 40),
    onSecondary: getTone(secH, secS, 100),
    secondaryContainer: getTone(secH, secS, 90),
    onSecondaryContainer: getTone(secH, secS, 10),

    // Tertiary
    tertiary: getTone(terH, terS, 40),
    onTertiary: getTone(terH, terS, 100),
    tertiaryContainer: getTone(terH, terS, 90),
    onTertiaryContainer: getTone(terH, terS, 10),

    // Error (Standard MD3 Error Red)
    error: '#B3261E',
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',

    // Surface & Background
    background: getTone(neuH, neuS, 99),
    onBackground: getTone(neuH, neuS, 10),
    surface: getTone(neuH, neuS, 99),
    onSurface: getTone(neuH, neuS, 10),
    
    // Surface Variant
    surfaceVariant: getTone(neuH, neuS + 4, 90),
    onSurfaceVariant: getTone(neuH, neuS + 4, 30),
    
    // Inverse
    inverseSurface: getTone(neuH, neuS, 20),
    inverseOnSurface: getTone(neuH, neuS, 95),
    inversePrimary: getTone(H, S, 80),

    // Outline
    outline: getTone(neuH, neuS + 4, 50),
    outlineVariant: getTone(neuH, neuS + 4, 80),
  };
};

export const generateDarkTheme = (seedHex: string): ThemeColors => {
  const rgb = hexToRgb(seedHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  
  const H = hsl.h;
  const S = hsl.s * 100;
  
  const secH = H;
  const secS = Math.max(0, S - 40);
  
  const terH = (H + 60) % 360;
  const terS = Math.min(100, S + 10);

  const neuH = H;
  const neuS = 4;

  // --- Dark Theme Mapping (MD3 Standard Tones) ---
  return {
    // Primary (Lighter in dark mode: Tone 80)
    primary: getTone(H, S, 80),
    onPrimary: getTone(H, S, 20),
    primaryContainer: getTone(H, S, 30),
    onPrimaryContainer: getTone(H, S, 90),

    // Secondary
    secondary: getTone(secH, secS, 80),
    onSecondary: getTone(secH, secS, 20),
    secondaryContainer: getTone(secH, secS, 30),
    onSecondaryContainer: getTone(secH, secS, 90),

    // Tertiary
    tertiary: getTone(terH, terS, 80),
    onTertiary: getTone(terH, terS, 20),
    tertiaryContainer: getTone(terH, terS, 30),
    onTertiaryContainer: getTone(terH, terS, 90),

    // Error
    error: '#F2B8B5',
    onError: '#601410',
    errorContainer: '#8C1D18',
    onErrorContainer: '#F9DEDC',

    // Surface & Background (Very dark, Tone 6-10)
    background: getTone(neuH, neuS, 6),
    onBackground: getTone(neuH, neuS, 90),
    surface: getTone(neuH, neuS, 6),
    onSurface: getTone(neuH, neuS, 90),
    
    // Surface Variant
    surfaceVariant: getTone(neuH, neuS + 4, 30),
    onSurfaceVariant: getTone(neuH, neuS + 4, 80),
    
    // Inverse
    inverseSurface: getTone(neuH, neuS, 90),
    inverseOnSurface: getTone(neuH, neuS, 20),
    inversePrimary: getTone(H, S, 40),

    // Outline
    outline: getTone(neuH, neuS + 4, 60),
    outlineVariant: getTone(neuH, neuS + 4, 30),
  };
};