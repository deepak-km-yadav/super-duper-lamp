import type { ThemeType } from '../types';

export interface ThemeConfig {
  name: ThemeType;
  displayName: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    accent: string;
  };
  css: string;
}

export const THEMES: Record<ThemeType, ThemeConfig> = {
  light: {
    name: 'light',
    displayName: 'Light',
    colors: {
      primary: '#7C3AED', // Rich violet
      secondary: '#A78BFA', // Soft purple
      background: '#FAF5FF', // Very light lavender
      surface: '#FFFFFF',
      text: '#1F2937', // Dark gray (near-black)
      textSecondary: '#6B7280', // Muted gray
      border: '#E9D5FF', // Light purple border
      accent: '#8B5CF6', // Accent violet
    },
    css: 'bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 text-gray-900',
  },
  dark: {
    name: 'dark',
    displayName: 'Dark',
    colors: {
      primary: '#60A5FA',
      secondary: '#A78BFA',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      textSecondary: '#94A3B8',
      border: '#334155',
      accent: '#34D399',
    },
    css: 'bg-dark-900 text-gray-50',
  },
  gradient: {
    name: 'gradient',
    displayName: 'Gradient',
    colors: {
      primary: '#EC4899',
      secondary: '#8B5CF6',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      surface: 'rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
      textSecondary: '#E0E7FF',
      border: 'rgba(255, 255, 255, 0.2)',
      accent: '#FCD34D',
    },
    css: 'gradient-bg text-white',
  },
  'liquid-glass': {
    name: 'liquid-glass',
    displayName: 'Liquid Glass',
    colors: {
      primary: '#38BDF8',
      secondary: '#A78BFA',
      background: '#000000',
      surface: 'rgba(255, 255, 255, 0.05)',
      text: '#FFFFFF',
      textSecondary: '#94A3B8',
      border: 'rgba(255, 255, 255, 0.1)',
      accent: '#FCD34D',
    },
    css: 'bg-black text-white',
  },
};

export const getThemeClasses = (theme: ThemeType): string => {
  return THEMES[theme].css;
};
