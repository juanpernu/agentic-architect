// FUTURE: Elements migration
// Replace this module with lib/stripe/payment-intent.ts that creates
// a SetupIntent + Subscription instead of a Checkout Session.
// Webhooks, feature gating, and portal code do NOT change.

import { getStripe } from './client';

interface CreateCheckoutParams {
  orgId: string;
  customerEmail: string;
  stripeCustomerId?: string | null;
  billingCycle: 'monthly' | 'yearly';
  seatCount: number;
  baseUrl: string;
}

export async function createCheckoutSession({
  orgId,
  customerEmail,
  stripeCustomerId,
  billingCycle,
  seatCount,
  baseUrl,
}: CreateCheckoutParams) {
  const basePriceId =
    billingCycle === 'monthly'
      ? process.env.STRIPE_ADVANCE_MONTHLY_BASE_PRICE_ID!
      : process.env.STRIPE_ADVANCE_YEARLY_BASE_PRICE_ID!;

  const seatPriceId =
    billingCycle === 'monthly'
      ? process.env.STRIPE_ADVANCE_MONTHLY_SEAT_PRICE_ID!
      : process.env.STRIPE_ADVANCE_YEARLY_SEAT_PRICE_ID!;

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    ...(stripeCustomerId
      ? { customer: stripeCustomerId }
      : { customer_email: customerEmail }),
    line_items: [
      { price: basePriceId, quantity: 1 },
      { price: seatPriceId, quantity: seatCount },
    ],
    success_url: `${baseUrl}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/settings/billing`,
    metadata: { organization_id: orgId },
    allow_promotion_codes: true,
  });

  return session;
}
