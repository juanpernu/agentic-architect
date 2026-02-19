import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe/client';
import { headers } from 'next/headers';

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const db = getDb();
  const { data: org } = await db
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', ctx.orgId)
    .single();

  if (!org?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No hay suscripción activa' },
      { status: 400 }
    );
  }

  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${baseUrl}/settings/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
