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
    bg: '#F1F5F9', cardBg: '#FFFFFF', cardBorder: '#E2E8F0',
    text: '#0F172A', subText: '#64748B', accent: '#0EA5E9', gold: '#F59E0B',
    palette: ['#0EA5E9', '#F59E0B', '#8B5CF6', '#10B981', '#3B82F6', '#EF4444'],
    success: '#10B981', warning: '#F59E0B', danger: '#EF4444',
  },
  warm: {
    key: 'warm', label: '暖橙',
    bg: '#1A1410', cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(245,158,11,0.25)',
    text: '#FDE68A', subText: '#FBBF24', accent: '#F59E0B', gold: '#FBBF24',
    palette: ['#F59E0B', '#FBBF24', '#F87171', '#FCD34D', '#FB923C', '#EF4444'],
    success: '#84CC16', warning: '#F59E0B', danger: '#EF4444',
  },
};
