export interface Theme {
  key: string; label: string;
  bg: string; cardBg: string; cardBorder: string; text: string; subText: string;
  accent: string; gold: string;
  palette: string[]; success: string; warning: string; danger: string;
}

export const THEMES: Record<string, Theme> = {
  dark: {
    key: 'dark', label: '深空科技',
    bg: '#0B1220', cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(34,211,238,0.25)',
    text: '#E2E8F0', subText: '#94A3B8', accent: '#22D3EE', gold: '#FBBF24',
    palette: ['#22D3EE', '#FBBF24', '#E879F9', '#34D399', '#60A5FA', '#F87171'],
    success: '#34D399', warning: '#F59E0B', danger: '#F87171',
  },
  light: {
    key: 'light', label: '商务浅色',
    bg: '#f7f9fc', cardBg: '#ffffff', cardBorder: '#e2e8f0',
    text: '#0f172a', subText: '#64748b', accent: '#2563eb', gold: '#d4a017',
    palette: ['#0ea5e9', '#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b'],
    success: '#16a34a', warning: '#f59e0b', danger: '#ef4444',
  },
  warm: {
    key: 'warm', label: '暖橙',
    bg: '#1A1410', cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(245,158,11,0.25)',
    text: '#FDE68A', subText: '#FBBF24', accent: '#F59E0B', gold: '#FBBF24',
    palette: ['#F59E0B', '#FBBF24', '#F87171', '#FCD34D', '#FB923C', '#EF4444'],
    success: '#84CC16', warning: '#F59E0B', danger: '#EF4444',
  },
};
