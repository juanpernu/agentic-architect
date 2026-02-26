import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { pauseSubscription, resumeSubscription } from '@/lib/mercadopago/subscription';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const rl = rateLimit('billing', ctx.orgId);
  if (rl) return rl;

  const body = await request.json();
  const { action } = body;

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
      await db
        .from('organizations')
        .update({ subscription_status: 'paused' })
        .eq('id', ctx.orgId);
    } else {
      await resumeSubscription(org.payment_subscription_id);
      await db
        .from('organizations')
        .update({ subscription_status: 'active' })
        .eq('id', ctx.orgId);
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
