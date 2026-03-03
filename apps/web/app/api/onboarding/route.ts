import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { apiError, dbError } from '@/lib/api-error';
import { onboardingUpdateSchema } from '@/lib/schemas/onboarding';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  try {
    const db = getDb();
    const { data, error } = await db
      .from('users')
      .select('onboarding_step, onboarding_completed_at')
      .eq('id', ctx.dbUserId)
      .single();

    if (error) return dbError(error, 'select', { route: '/api/onboarding' });

    return NextResponse.json({
      step: data.onboarding_step,
      completedAt: data.onboarding_completed_at,
    });
  } catch (err) {
    return apiError(err, 'Error al obtener estado de onboarding', 500, { route: '/api/onboarding' });
  }
}

export async function PATCH(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  try {
    const result = await validateBody(onboardingUpdateSchema, req);
    if ('error' in result) return result.error;

    const db = getDb();
    const updates: Record<string, unknown> = {
      onboarding_step: result.data.step,
    };

    if (result.data.step === 'completed') {
      updates.onboarding_completed_at = new Date().toISOString();
    }

    const { error } = await db
      .from('users')
      .update(updates)
      .eq('id', ctx.dbUserId);

    if (error) return dbError(error, 'update', { route: '/api/onboarding' });

    return NextResponse.json({ step: result.data.step });
  } catch (err) {
    return apiError(err, 'Error al actualizar onboarding', 500, { route: '/api/onboarding' });
  }
}
