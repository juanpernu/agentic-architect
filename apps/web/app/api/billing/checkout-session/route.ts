import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { createSubscription } from '@/lib/mercadopago/subscription';
import type { BillingCycle } from '@/lib/mercadopago/pricing';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';

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
  const billingCycle = body.billingCycle as BillingCycle;
  const seatCount = body.seatCount as number;

  if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
    return NextResponse.json({ error: 'billingCycle inválido' }, { status: 400 });
  }
  if (!seatCount || typeof seatCount !== 'number' || !Number.isInteger(seatCount) || seatCount < 1 || seatCount > 20) {
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

  // MP requires a valid public URL for back_url (rejects localhost).
  // Priority: NEXT_PUBLIC_APP_URL > VERCEL_PROJECT_PRODUCTION_URL > Host header
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  let baseUrl: string;
  if (appUrl) {
    baseUrl = appUrl;
  } else if (vercelUrl) {
    baseUrl = `https://${vercelUrl}`;
  } else {
    const headersList = await headers();
    const host = headersList.get('host') ?? 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    baseUrl = `${protocol}://${host}`;
  }
  const backUrl = `${baseUrl}/settings/billing?checkout=pending`;

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

    // Create standalone PreApproval (without plan) so MP generates init_point
    // for user redirect. Linking to a PreApprovalPlan requires card_token_id upfront.
    const subscription = await createSubscription({
      orgId: ctx.orgId,
      payerEmail,
      billingCycle,
      seatCount,
      backUrl,
    });

    const redirectUrl = subscription.init_point;

    if (!redirectUrl) {
      return NextResponse.json({ error: 'Error al crear la suscripción' }, { status: 500 });
    }

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    // Rollback pending subscription data on MP API failure
    await db
      .from('organizations')
      .update({ subscription_seats: null, billing_cycle: null })
      .eq('id', ctx.orgId);

    return apiError(err, 'Error al crear sesión de pago', 500, {
      route: '/api/billing/checkout-session',
    });
  }
}
