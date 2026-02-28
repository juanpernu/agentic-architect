import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { updateSubscriptionAmount } from '@/lib/mercadopago/subscription';
import type { BillingCycle } from '@/lib/mercadopago/pricing';
import { apiError } from '@/lib/api-error';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

const VALID_CYCLES = new Set<BillingCycle>(['monthly', 'yearly']);

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
  const seatCount = body.seatCount as number;

  if (!seatCount || typeof seatCount !== 'number' || !Number.isInteger(seatCount) || seatCount < 1 || seatCount > 20) {
    return NextResponse.json({ error: 'seatCount inválido' }, { status: 400 });
  }

  const db = getDb();
  const { data: org } = await db
    .from('organizations')
    .select('payment_subscription_id, billing_cycle')
    .eq('id', ctx.orgId)
    .single();

  if (!org?.payment_subscription_id) {
    return NextResponse.json({ error: 'No hay suscripción activa' }, { status: 400 });
  }

  const billingCycle = org.billing_cycle as BillingCycle;
  if (!VALID_CYCLES.has(billingCycle)) {
    return NextResponse.json({ error: 'billing_cycle inválido en la base de datos' }, { status: 500 });
  }

  try {
    await updateSubscriptionAmount(org.payment_subscription_id, billingCycle, seatCount);

    const { error: dbErr } = await db
      .from('organizations')
      .update({ max_seats: seatCount, subscription_seats: seatCount })
      .eq('id', ctx.orgId);

    if (dbErr) {
      logger.error('Update seats: DB update failed after MP success', {
        route: '/api/billing/update-seats',
        orgId: ctx.orgId,
        error: dbErr.message,
      });
      return NextResponse.json({ error: 'Error al actualizar la base de datos' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, 'Error al actualizar los seats', 500, {
      route: '/api/billing/update-seats',
    });
  }
}
