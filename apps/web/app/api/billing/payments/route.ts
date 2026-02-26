import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { getSubscription, getSubscriptionPayments } from '@/lib/mercadopago/subscription';
import { apiError } from '@/lib/api-error';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const db = getDb();
  const { data: org } = await db
    .from('organizations')
    .select('payment_subscription_id')
    .eq('id', ctx.orgId)
    .single();

  if (!org?.payment_subscription_id) {
    return NextResponse.json({ subscription: null, payments: [] });
  }

  try {
    const [subscription, payments] = await Promise.all([
      getSubscription(org.payment_subscription_id),
      getSubscriptionPayments(org.payment_subscription_id),
    ]);

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        reason: subscription.reason,
        nextPaymentDate: subscription.next_payment_date,
        dateCreated: subscription.date_created,
      },
      payments: payments.map((p: Record<string, unknown>) => ({
        id: p.id,
        status: p.status,
        amount: p.transaction_amount,
        dateCreated: p.date_created,
      })),
    });
  } catch (err) {
    return apiError(err, 'Error al obtener historial de pagos', 500, {
      route: '/api/billing/payments',
    });
  }
}
