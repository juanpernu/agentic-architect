import { PreApproval, Payment } from 'mercadopago';
import { getMPClient } from './client';
import { computeSubscriptionAmount, type BillingCycle } from './pricing';

// --- Subscription Management ---

interface CreateSubscriptionParams {
  orgId: string;
  payerEmail: string;
  billingCycle: BillingCycle;
  seatCount: number;
  backUrl: string;
}

/**
 * Create a standalone PreApproval (subscription) without a linked plan.
 * This generates an init_point URL where the user enters payment details on MP.
 * Linking to a PreApprovalPlan requires card_token_id upfront (no redirect flow).
 * Sets external_reference = orgId so the webhook can find the organization.
 */
export async function createSubscription({
  orgId,
  payerEmail,
  billingCycle,
  seatCount,
  backUrl,
}: CreateSubscriptionParams) {
  const client = getMPClient();
  const preApproval = new PreApproval(client);
  const totalAmount = computeSubscriptionAmount(billingCycle, seatCount);

  const now = new Date();
  const startDate = now.toISOString();
  // End date: 1 year from now (MP requires it for standalone PreApprovals)
  const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();

  return preApproval.create({
    body: {
      reason: `Agentect Advance — ${seatCount} usuario${seatCount > 1 ? 's' : ''}`,
      external_reference: orgId,
      payer_email: payerEmail,
      auto_recurring: {
        frequency: billingCycle === 'monthly' ? 1 : 12,
        frequency_type: 'months',
        start_date: startDate,
        end_date: endDate,
        transaction_amount: totalAmount,
        currency_id: 'ARS',
      },
      back_url: backUrl,
      status: 'pending',
    },
  });
}

/**
 * Fetch a subscription by its PreApproval ID.
 */
export async function getSubscription(preApprovalId: string) {
  const client = getMPClient();
  const preApproval = new PreApproval(client);
  return preApproval.get({ id: preApprovalId });
}

/**
 * Cancel a subscription. Sets status to 'cancelled' in MP.
 */
export async function cancelSubscription(preApprovalId: string) {
  const client = getMPClient();
  const preApproval = new PreApproval(client);
  return preApproval.update({
    id: preApprovalId,
    body: { status: 'cancelled' },
  });
}

/**
 * Pause a subscription. Billing stops but subscription is not cancelled.
 */
export async function pauseSubscription(preApprovalId: string) {
  const client = getMPClient();
  const preApproval = new PreApproval(client);
  return preApproval.update({
    id: preApprovalId,
    body: { status: 'paused' },
  });
}

/**
 * Resume a paused subscription.
 */
export async function resumeSubscription(preApprovalId: string) {
  const client = getMPClient();
  const preApproval = new PreApproval(client);
  return preApproval.update({
    id: preApprovalId,
    body: { status: 'authorized' },
  });
}

/**
 * Update the subscription amount when seats change.
 * IMPORTANT: currency_id is required in every auto_recurring update.
 */
export async function updateSubscriptionAmount(
  preApprovalId: string,
  billingCycle: BillingCycle,
  newSeatCount: number
) {
  const client = getMPClient();
  const preApproval = new PreApproval(client);
  const totalAmount = computeSubscriptionAmount(billingCycle, newSeatCount);

  return preApproval.update({
    id: preApprovalId,
    body: {
      auto_recurring: {
        transaction_amount: totalAmount,
        currency_id: 'ARS',
      },
    },
  });
}

/**
 * Search payments for a subscription.
 * MP SDK Payment.search doesn't support filtering by preapproval_id in options,
 * so we fetch a bounded set and filter client-side.
 */
export async function getSubscriptionPayments(preApprovalId: string) {
  const client = getMPClient();
  const payment = new Payment(client);

  const result = await payment.search({
    options: {
      criteria: 'desc',
      sort: 'date_created',
      limit: 100,
    },
  });

  const payments = result.results ?? [];
  return payments.filter(
    (p) => (p as Record<string, unknown>).preapproval_id === preApprovalId
  );
}
