import type { ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

type ValidationSuccess<T> = { data: T };
type ValidationError = { error: NextResponse };
type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

export async function validateBody<T>(
  schema: ZodSchema<T>,
  req: Request
): Promise<ValidationResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      if (key && !fields[key]) fields[key] = issue.message;
    }
    return {
      error: NextResponse.json({ error: 'Validation failed', fields }, { status: 400 }),
    };
  }

  return { data: result.data };
}
