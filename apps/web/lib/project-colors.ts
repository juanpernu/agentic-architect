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

export const COST_CENTER_COLOR_HEX: Record<ProjectColor, string> = {
  red: '#fecaca',
  blue: '#bfdbfe',
  green: '#bbf7d0',
  yellow: '#fef08a',
  purple: '#e9d5ff',
  orange: '#fed7aa',
  pink: '#fbcfe8',
  teal: '#99f6e4',
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

export const COST_CENTER_BADGE_STYLES: Record<ProjectColor, { bg: string; text: string }> = {
  red: { bg: '#fecaca', text: '#991b1b' },
  blue: { bg: '#bfdbfe', text: '#1e40af' },
  green: { bg: '#bbf7d0', text: '#166534' },
  yellow: { bg: '#fef08a', text: '#854d0e' },
  purple: { bg: '#e9d5ff', text: '#6b21a8' },
  orange: { bg: '#fed7aa', text: '#9a3412' },
  pink: { bg: '#fbcfe8', text: '#9d174d' },
  teal: { bg: '#99f6e4', text: '#115e59' },
};
