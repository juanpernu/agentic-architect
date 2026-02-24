import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { createCheckoutSession } from '@/lib/stripe/checkout';
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
  if (!seatCount || typeof seatCount !== 'number' || seatCount < 1) {
    return NextResponse.json({ error: 'seatCount inválido' }, { status: 400 });
  }

  const db = getDb();
  const [{ data: org }, { data: user }] = await Promise.all([
    db
      .from('organizations')
      .select('id, plan, stripe_customer_id')
      .eq('id', ctx.orgId)
      .single(),
    db
      .from('users')
      .select('email')
      .eq('id', ctx.dbUserId)
      .single(),
  ]);

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
  }

  if (org.plan !== 'free') {
    return NextResponse.json(
      { error: 'Ya tenés un plan activo. Gestionalo desde el portal.' },
      { status: 400 }
    );
  }

  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const customerEmail = user?.email ?? '';
  if (!org.stripe_customer_id && !customerEmail) {
    return NextResponse.json(
      { error: 'No se encontró un email para crear la suscripción' },
      { status: 400 }
    );
  }

  // FUTURE: Elements migration — replace createCheckoutSession with
  // createSetupIntent + inline PaymentForm component
  try {
    const session = await createCheckoutSession({
      orgId: ctx.orgId,
      customerEmail,
      stripeCustomerId: org.stripe_customer_id,
      billingCycle,
      seatCount,
      baseUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return apiError(err, 'Error al crear sesión de pago', 500, { route: '/api/billing/checkout-session' });
  }
}
