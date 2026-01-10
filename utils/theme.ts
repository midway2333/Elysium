import { ThemeColors } from '../types';

// Helper to convert Hex to RGB
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

// Mix two colors together
const mixColors = (hex1: string, hex2: string, weight: number) => {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  
  const r = Math.round(c1.r * weight + c2.r * (1 - weight));
  const g = Math.round(c1.g * weight + c2.g * (1 - weight));
  const b = Math.round(c1.b * weight + c2.b * (1 - weight));
  
  return `rgb(${r}, ${g}, ${b})`;
};

// Generate a palette based on a seed color (Simulating Material You)
export const generateTheme = (seedColor: string): ThemeColors => {
  return {
    primary: seedColor,
    onPrimary: '#FFFFFF',
    // Mix seed with white for container
    primaryContainer: mixColors(seedColor, '#FFFFFF', 0.25), 
    // Darker version of seed for text on container
    onPrimaryContainer: mixColors(seedColor, '#000000', 0.7), 
    
    background: '#FAFAFA', // Keep background neutral
    // Slightly tint surface with seed color
    surface: mixColors(seedColor, '#FFFFFF', 0.03), 
    onSurface: '#1C1B1F',
    
    // Surface Variant (Bottom bar) gets a stronger tint of the primary color
    surfaceVariant: mixColors(seedColor, '#EEEEEE', 0.15), 
    onSurfaceVariant: '#49454F',
    
    outline: '#79747E',
  };
};

export const generateDarkTheme = (seedColor: string): ThemeColors => {
   return {
    // Lighter version of primary for dark mode
    primary: mixColors(seedColor, '#FFFFFF', 0.6), 
    onPrimary: '#381E72',
    
    primaryContainer: mixColors(seedColor, '#000000', 0.4),
    onPrimaryContainer: mixColors(seedColor, '#FFFFFF', 0.9),
    
    background: '#121212',
    // Dark surface with slight tint
    surface: mixColors(seedColor, '#121212', 0.1), 
    onSurface: '#E6E1E5',
    
    // Surface Variant (Bottom bar) gets a noticeable tint for dark mode integration
    surfaceVariant: mixColors(seedColor, '#252525', 0.25), 
    onSurfaceVariant: '#CAC4D0',
    
    outline: '#938F99',
  };
}