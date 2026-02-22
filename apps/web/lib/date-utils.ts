/**
 * Shared date utilities for Argentina timezone-aware formatting.
 */

/** Convert a UTC date to Argentina local time. */
export function toArgDate(d: Date): Date {
  return new Date(d.toLocaleString('en-US', { timeZone: 'America/Buenos_Aires' }));
}

interface ArgDayInfo {
  isToday: boolean;
  isYesterday: boolean;
  /** Calendar-day difference (timezone-aware). */
  diffDays: number;
  argDate: Date;
  date: Date;
}

/** Get timezone-aware day comparison info for a date string. */
export function getArgDayInfo(dateStr: string): ArgDayInfo {
  const date = new Date(dateStr);
  const argDate = toArgDate(date);
  const argNow = toArgDate(new Date());

  const today = new Date(argNow.getFullYear(), argNow.getMonth(), argNow.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const updateDay = new Date(argDate.getFullYear(), argDate.getMonth(), argDate.getDate());

  const diffDays = Math.floor((today.getTime() - updateDay.getTime()) / 86_400_000);

  return {
    isToday: updateDay.getTime() === today.getTime(),
    isYesterday: updateDay.getTime() === yesterday.getTime(),
    diffDays,
    argDate,
    date,
  };
}

/**
 * Short relative format: "Hace un momento" / "Hace 2h" / "Ayer" / "Hace 3d" / "15 oct."
 * Used by budgets list and project detail receipts.
 */
export function formatRelativeShort(dateStr: string): string {
  const { isToday, isYesterday, diffDays, date } = getArgDayInfo(dateStr);
  const diffHours = Math.floor((Date.now() - date.getTime()) / 3_600_000);

  if (isToday) {
    if (diffHours < 1) return 'Hace un momento';
    return `Hace ${diffHours}h`;
  }
  if (isYesterday) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/**
 * Day-only relative format: "Hoy" / "Ayer" / "Hace 3d" / "15 oct."
 * Used by project detail receipt rows.
 */
export function formatRelativeDay(dateStr: string): string {
  const { isToday, isYesterday, diffDays, date } = getArgDayInfo(dateStr);

  if (isToday) return 'Hoy';
  if (isYesterday) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/**
 * Compact format with "Ult. act." prefix: "Ult. act. hoy" / "Ult. act. 2d" / etc.
 * Used by project cards list.
 */
export function formatRelativeCompact(dateStr: string): string {
  const { isToday, isYesterday, diffDays } = getArgDayInfo(dateStr);

  if (isToday) return 'Ult. act. hoy';
  if (isYesterday) return 'Ult. act. ayer';
  if (diffDays < 7) return `Ult. act. ${diffDays}d`;
  if (diffDays < 30) return `Ult. act. ${Math.floor(diffDays / 7)}w`;
  return `Ult. act. ${Math.floor(diffDays / 30)}m`;
}

/**
 * Relative format with time: "Hoy, 14:30" / "Ayer, 09:15" / "lun., 15 oct."
 * Used by recent receipts on dashboard.
 */
export function formatRelativeWithTime(dateStr: string): string {
  const { isToday, isYesterday, argDate, date } = getArgDayInfo(dateStr);
  const time = argDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Hoy, ${time}`;
  if (isYesterday) return `Ayer, ${time}`;
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Buenos_Aires',
  });
}
