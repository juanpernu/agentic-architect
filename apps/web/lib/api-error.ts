import { NextResponse } from 'next/server';
import { logger } from './logger';
import type { LogContext } from './logger';

const SAFE_MESSAGES: Record<string, string> = {
  select: 'Error al obtener datos',
  insert: 'Error al crear el registro',
  update: 'Error al actualizar',
  delete: 'Error al eliminar',
  upload: 'Error al subir el archivo',
};

export function dbError(
  error: { message: string; code?: string; details?: string },
  operation: string,
  context?: LogContext
): NextResponse {
  logger.error(`DB ${operation} failed`, { ...context, dbCode: error.code }, error);

  const safeMessage = SAFE_MESSAGES[operation] ?? 'Error interno';
  return NextResponse.json({ error: safeMessage }, { status: 500 });
}

export function apiError(
  error: unknown,
  safeMessage: string,
  status: number = 500,
  context?: LogContext
): NextResponse {
  logger.error(safeMessage, context, error);
  return NextResponse.json({ error: safeMessage }, { status });
}
