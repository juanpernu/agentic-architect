import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { getDb } from '@/lib/supabase';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type Stripe from 'stripe';

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Stripe webhook signature verification failed', { route: '/api/webhooks/stripe' }, err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = getDb();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.organization_id;
        if (!orgId || !session.subscription || !session.customer) break;

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer.id;

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        const seatItem = subscription.items.data.find(
          (item) =>
            item.price.id === env.STRIPE_ADVANCE_MONTHLY_SEAT_PRICE_ID ||
            item.price.id === env.STRIPE_ADVANCE_YEARLY_SEAT_PRICE_ID
        );
        const seatCount = seatItem?.quantity ?? 1;
        const interval = subscription.items.data[0]?.price.recurring?.interval;

        await db
          .from('organizations')
          .update({
            plan: 'advance',
            subscription_status: 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            max_seats: seatCount,
            billing_cycle: interval === 'year' ? 'yearly' : 'monthly',
            current_period_end: new Date(
              subscription.items.data[0].current_period_end * 1000
            ).toISOString(),
          })
          .eq('id', orgId);

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const { data: orgs } = await db
          .from('organizations')
          .select('id, max_seats')
          .eq('stripe_subscription_id', subscription.id)
          .limit(1);
        if (!orgs?.length) break;

        const seatItem = subscription.items.data.find(
          (item) =>
            item.price.id === env.STRIPE_ADVANCE_MONTHLY_SEAT_PRICE_ID ||
            item.price.id === env.STRIPE_ADVANCE_YEARLY_SEAT_PRICE_ID
        );

        await db
          .from('organizations')
          .update({
            subscription_status: subscription.status === 'active' ? 'active' : 'past_due',
            max_seats: seatItem?.quantity ?? orgs[0].max_seats,
            current_period_end: new Date(
              subscription.items.data[0].current_period_end * 1000
            ).toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await db
          .from('organizations')
          .update({
            plan: 'free',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
            max_seats: 1,
            billing_cycle: null,
            current_period_end: null,
          })
          .eq('stripe_subscription_id', subscription.id);

        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const paidSub = invoice.parent?.subscription_details?.subscription;
        if (!paidSub) break;
        const paidSubId = typeof paidSub === 'string' ? paidSub : paidSub.id;

        await db
          .from('organizations')
          .update({ subscription_status: 'active' })
          .eq('stripe_subscription_id', paidSubId);

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const failedSub = invoice.parent?.subscription_details?.subscription;
        if (!failedSub) break;
        const failedSubId = typeof failedSub === 'string' ? failedSub : failedSub.id;

        await db
          .from('organizations')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_subscription_id', failedSubId);

        break;
      }
    }
  } catch (err) {
    logger.error('Stripe webhook handler error', { route: '/api/webhooks/stripe' }, err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
