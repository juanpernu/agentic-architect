import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { createPlan, createSubscription } from '@/lib/mercadopago/subscription';
import { computeSubscriptionAmount } from '@/lib/mercadopago/pricing';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const rl = rateLimit('billing', ctx.orgId);
  if (rl) return rl;

  const body = await request.json();
  const { billingCycle, seatCount } = body;

  if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
    return NextResponse.json({ error: 'billingCycle inválido' }, { status: 400 });
  }
  if (!seatCount || typeof seatCount !== 'number' || seatCount < 1 || seatCount > 20) {
    return NextResponse.json({ error: 'seatCount inválido' }, { status: 400 });
  }

  const db = getDb();
  const [{ data: org }, { data: user }] = await Promise.all([
    db.from('organizations').select('id, plan').eq('id', ctx.orgId).single(),
    db.from('users').select('email').eq('id', ctx.dbUserId).single(),
  ]);

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
  }
  if (org.plan !== 'free') {
    return NextResponse.json({ error: 'Ya tenés un plan activo.' }, { status: 400 });
  }

  const payerEmail = user?.email ?? '';
  if (!payerEmail) {
    return NextResponse.json(
      { error: 'No se encontró un email para crear la suscripción' },
      { status: 400 }
    );
  }

  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const backUrl = `${protocol}://${host}/settings/billing?checkout=pending`;

  const totalAmount = computeSubscriptionAmount(billingCycle, seatCount);

  try {
    // Store pending subscription data FIRST (before MP call)
    // so the webhook can resolve the org even under race conditions
    await db
      .from('organizations')
      .update({
        subscription_seats: seatCount,
        billing_cycle: billingCycle,
      })
      .eq('id', ctx.orgId);

    // Step 1: Create a PreApprovalPlan (reusable template)
    const plan = await createPlan({ billingCycle, totalAmount, backUrl });

    if (!plan.id) {
      return NextResponse.json({ error: 'Error al crear el plan de pago' }, { status: 500 });
    }

    // Step 2: Create individual PreApproval with external_reference = orgId
    // This is the actual subscription — its init_point carries the org context
    const subscription = await createSubscription({
      planId: plan.id,
      orgId: ctx.orgId,
      payerEmail,
      billingCycle,
      seatCount,
      backUrl,
    });

    if (!subscription.init_point) {
      return NextResponse.json({ error: 'Error al crear la suscripción' }, { status: 500 });
    }

    return NextResponse.json({ url: subscription.init_point });
  } catch (err) {
    return apiError(err, 'Error al crear sesión de pago', 500, {
      route: '/api/billing/checkout-session',
    });
  }
}
