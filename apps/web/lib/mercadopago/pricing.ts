/**
 * Pricing configuration for Mercado Pago subscriptions.
 *
 * MP does not support multi-line-item subscriptions (base + seats as separate items).
 * We compute the total amount server-side and track the seat decomposition in our DB
 * via the `subscription_seats` column on `organizations`.
 *
 * Amounts are in ARS (Argentine Peso).
 */
export const MP_PRICING = {
  monthly: { base: 45_000, seat: 8_000 },
  yearly: { base: 450_000, seat: 80_000 },
} as const;

export type BillingCycle = 'monthly' | 'yearly';

export function computeSubscriptionAmount(
  billingCycle: BillingCycle,
  seatCount: number
): number {
  const prices = MP_PRICING[billingCycle];
  return prices.base + prices.seat * seatCount;
}
