import type { UserRole } from '@architech/shared';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  architect: 'Arquitecto',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  supervisor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  architect: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};
