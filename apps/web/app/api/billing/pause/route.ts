import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { pauseSubscription, resumeSubscription } from '@/lib/mercadopago/subscription';
import { apiError } from '@/lib/api-error';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const rl = rateLimit('billing', ctx.orgId);
  if (rl) return rl;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const action = body.action as string;

  if (!action || !['pause', 'resume'].includes(action)) {
    return NextResponse.json({ error: 'action inválido (pause | resume)' }, { status: 400 });
  }

  const db = getDb();
  const { data: org } = await db
    .from('organizations')
    .select('payment_subscription_id, subscription_status')
    .eq('id', ctx.orgId)
    .single();

  if (!org?.payment_subscription_id) {
    return NextResponse.json({ error: 'No hay suscripción activa' }, { status: 400 });
  }

  try {
    if (action === 'pause') {
      await pauseSubscription(org.payment_subscription_id);
      const { error: dbErr } = await db
        .from('organizations')
        .update({ subscription_status: 'paused' })
        .eq('id', ctx.orgId);
      if (dbErr) {
        logger.error('Pause: DB update failed after MP success', {
          route: '/api/billing/pause',
          orgId: ctx.orgId,
          error: dbErr.message,
        });
        return NextResponse.json({ error: 'Error al actualizar la base de datos' }, { status: 500 });
      }
    } else {
      await resumeSubscription(org.payment_subscription_id);
      const { error: dbErr } = await db
        .from('organizations')
        .update({ subscription_status: 'active' })
        .eq('id', ctx.orgId);
      if (dbErr) {
        logger.error('Resume: DB update failed after MP success', {
          route: '/api/billing/pause',
          orgId: ctx.orgId,
          error: dbErr.message,
        });
        return NextResponse.json({ error: 'Error al actualizar la base de datos' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(
      err,
      action === 'pause' ? 'Error al pausar la suscripción' : 'Error al reactivar la suscripción',
      500,
      { route: '/api/billing/pause' }
    );
  }
}
