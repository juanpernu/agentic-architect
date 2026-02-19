import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { createCheckoutSession } from '@/lib/stripe/checkout';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const body = await request.json();
  const { billingCycle, seatCount } = body;

  if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
    return NextResponse.json({ error: 'billingCycle inválido' }, { status: 400 });
  }
  if (!seatCount || typeof seatCount !== 'number' || seatCount < 1) {
    return NextResponse.json({ error: 'seatCount inválido' }, { status: 400 });
  }

  const db = getDb();
  const { data: org } = await db
    .from('organizations')
    .select('id, plan, stripe_customer_id')
    .eq('id', ctx.orgId)
    .single();

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

  // FUTURE: Elements migration — replace createCheckoutSession with
  // createSetupIntent + inline PaymentForm component
  const session = await createCheckoutSession({
    orgId: ctx.orgId,
    customerEmail: '',
    stripeCustomerId: org.stripe_customer_id,
    billingCycle,
    seatCount,
    baseUrl,
  });

  return NextResponse.json({ url: session.url });
}
