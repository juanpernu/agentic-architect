import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { cancelSubscription } from '@/lib/mercadopago/subscription';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const rl = rateLimit('billing', ctx.orgId);
  if (rl) return rl;

  const db = getDb();
  const { data: org } = await db
    .from('organizations')
    .select('payment_subscription_id, plan')
    .eq('id', ctx.orgId)
    .single();

  if (!org?.payment_subscription_id) {
    return NextResponse.json({ error: 'No hay suscripción activa' }, { status: 400 });
  }

  try {
    // Call MP API first — only downgrade DB on confirmed success
    await cancelSubscription(org.payment_subscription_id);

    await db
      .from('organizations')
      .update({
        plan: 'free',
        subscription_status: 'canceled',
        payment_subscription_id: null,
        max_seats: 1,
        billing_cycle: null,
        current_period_end: null,
        subscription_seats: null,
      })
      .eq('id', ctx.orgId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, 'Error al cancelar la suscripción', 500, {
      route: '/api/billing/cancel',
    });
  }
}
