import type { ProjectColor } from '@architech/shared';

export const PROJECT_COLORS: ProjectColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];

export const PROJECT_COLOR_HEX: Record<ProjectColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7',
  orange: '#f97316',
  pink: '#ec4899',
  teal: '#14b8a6',
};

export const PROJECT_BADGE_STYLES: Record<ProjectColor, { bg: string; text: string }> = {
  red: { bg: '#fef2f2', text: '#b91c1c' },
  blue: { bg: '#eff6ff', text: '#1d4ed8' },
  green: { bg: '#f0fdf4', text: '#15803d' },
  yellow: { bg: '#fefce8', text: '#a16207' },
  purple: { bg: '#faf5ff', text: '#7e22ce' },
  orange: { bg: '#fff7ed', text: '#c2410c' },
  pink: { bg: '#fdf2f8', text: '#be185d' },
  teal: { bg: '#f0fdfa', text: '#0f766e' },
};
