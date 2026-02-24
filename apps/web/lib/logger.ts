type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProd = process.env.NODE_ENV === 'production';
const MIN_LEVEL: LogLevel = isProd ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function formatDev(level: LogLevel, message: string, context?: LogContext, error?: unknown): string {
  const ctx = context ? ` ${JSON.stringify(context)}` : '';
  const err = error ? `\n${error instanceof Error ? error.stack ?? error.message : String(error)}` : '';
  return `[${level.toUpperCase()}] ${message}${ctx}${err}`;
}

function formatProd(level: LogLevel, message: string, context?: LogContext, error?: unknown): string {
  const entry: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  if (error) {
    entry.error = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : String(error);
  }
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
  if (!shouldLog(level)) return;

  const output = isProd
    ? formatProd(level, message, context, error)
    : formatDev(level, message, context, error);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext, error?: unknown) => log('warn', message, context, error),
  error: (message: string, context?: LogContext, error?: unknown) => log('error', message, context, error),
};
