const tintLight = '#2563eb';
const tintDark = '#60a5fa';

export default {
  light: {
    // básicos
    background: '#FFFFFF',
    card: '#F7F9FC',
    text: '#111827',
    mutedText: '#6b7280',
    border: '#E6E9EF',

    // semânticas
    primary: tintLight,
    primaryText: '#ffffff',
    good: '#10b981',
    warn: '#f59e0b',
    lilac: '#a78bfa',

    // utilitárias
    successBg: '#e8f3ff',
    chipBg: '#eef2ff',

    // tab bar etc.
    tint: tintLight,
  },
  dark: {
    background: '#0b1020',
    card: '#10162a',
    text: '#e5e7eb',
    mutedText: '#9ca3af',
    border: '#1f2a44',

    primary: tintDark,
    primaryText: '#0b1020',
    good: '#34d399',
    warn: '#f59e0b',
    lilac: '#c4b5fd',

    successBg: '#0e1a30',
    chipBg: '#1b2540',

    tint: tintDark,
  },
};
