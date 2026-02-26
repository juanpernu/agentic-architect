import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/supabase';
import { verifyWebhookSignature } from '@/lib/mercadopago/webhook';
import { getSubscription } from '@/lib/mercadopago/subscription';
import { logger } from '@/lib/logger';

/**
 * Mercado Pago webhook handler.
 *
 * MP webhooks only send the resource ID — we must fetch the full object via API.
 *
 * Events:
 * - subscription_preapproval: subscription status changes (authorized, paused, cancelled, pending)
 * - subscription_authorized_payment: recurring payment processed
 */
export async function POST(request: Request) {
  const body = await request.json();
  const headersList = await headers();

  const xSignature = headersList.get('x-signature');
  const xRequestId = headersList.get('x-request-id');
  const dataId = String(body.data?.id ?? '');

  if (!verifyWebhookSignature(xSignature, xRequestId, dataId)) {
    logger.error('MP webhook signature verification failed', {
      route: '/api/webhooks/mercadopago',
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const db = getDb();

  try {
    // --- subscription_preapproval: subscription status changed ---
    if (body.type === 'subscription_preapproval') {
      const subscription = await getSubscription(dataId);
      const orgId = subscription.external_reference;
      const mpStatus = subscription.status;

      if (!orgId) {
        logger.error('MP webhook: subscription has no external_reference', {
          route: '/api/webhooks/mercadopago',
          subscriptionId: dataId,
        });
        return NextResponse.json({ received: true });
      }

      if (mpStatus === 'authorized') {
        // Subscription activated or reactivated
        const { data: org } = await db
          .from('organizations')
          .select('subscription_seats')
          .eq('id', orgId)
          .single();

        await db
          .from('organizations')
          .update({
            plan: 'advance',
            subscription_status: 'active',
            payment_subscription_id: dataId,
            payment_customer_id: subscription.payer_id
              ? String(subscription.payer_id)
              : null,
            max_seats: org?.subscription_seats ?? 1,
            current_period_end: subscription.next_payment_date ?? null,
          })
          .eq('id', orgId);

        logger.info('MP subscription authorized', {
          route: '/api/webhooks/mercadopago',
          orgId,
          subscriptionId: dataId,
        });
      } else if (mpStatus === 'paused') {
        await db
          .from('organizations')
          .update({ subscription_status: 'paused' })
          .eq('payment_subscription_id', dataId);

        logger.info('MP subscription paused', {
          route: '/api/webhooks/mercadopago',
          subscriptionId: dataId,
        });
      } else if (mpStatus === 'cancelled') {
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
          .eq('payment_subscription_id', dataId);

        logger.info('MP subscription cancelled', {
          route: '/api/webhooks/mercadopago',
          subscriptionId: dataId,
        });
      } else if (mpStatus === 'pending') {
        // Payment method not yet authorized — keep current state, don't downgrade
        logger.info('MP subscription pending', {
          route: '/api/webhooks/mercadopago',
          subscriptionId: dataId,
        });
      }
    }

    // --- subscription_authorized_payment: recurring payment processed ---
    if (body.type === 'subscription_authorized_payment') {
      logger.info('MP subscription payment received', {
        route: '/api/webhooks/mercadopago',
        paymentId: dataId,
      });
    }
  } catch (err) {
    logger.error('MP webhook handler error', {
      route: '/api/webhooks/mercadopago',
    }, err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
