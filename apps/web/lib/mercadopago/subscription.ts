import { PreApprovalPlan, PreApproval, Payment } from 'mercadopago';
import { getMPClient } from './client';
import { computeSubscriptionAmount, type BillingCycle } from './pricing';

// --- Plan Management (reusable templates) ---

interface CreatePlanParams {
  billingCycle: BillingCycle;
  totalAmount: number;
  backUrl: string;
}

/**
 * Create a PreApprovalPlan (reusable template).
 * This is the plan definition, not the individual subscription.
 */
export async function createPlan({ billingCycle, totalAmount, backUrl }: CreatePlanParams) {
  const client = getMPClient();
  const planApi = new PreApprovalPlan(client);

  return planApi.create({
    body: {
      reason: `Agentect Advance — ${billingCycle === 'monthly' ? 'Mensual' : 'Anual'}`,
      auto_recurring: {
        frequency: billingCycle === 'monthly' ? 1 : 12,
        frequency_type: 'months',
        transaction_amount: totalAmount,
        currency_id: 'ARS',
      },
      back_url: backUrl,
    },
  });
}

// --- Subscription Management (individual per org) ---

interface CreateSubscriptionParams {
  planId: string;
  orgId: string;
  payerEmail: string;
  billingCycle: BillingCycle;
  seatCount: number;
  backUrl: string;
}

/**
 * Create an individual PreApproval (subscription) linked to a plan.
 * Sets external_reference = orgId so the webhook can find the organization.
 * Returns the PreApproval with init_point for user redirect.
 */
export async function createSubscription({
  planId,
  orgId,
  payerEmail,
  billingCycle,
  seatCount,
  backUrl,
}: CreateSubscriptionParams) {
  const client = getMPClient();
  const preApproval = new PreApproval(client);
  const totalAmount = computeSubscriptionAmount(billingCycle, seatCount);

  return preApproval.create({
    body: {
      preapproval_plan_id: planId,
      reason: `Agentect Advance — ${seatCount} usuario${seatCount > 1 ? 's' : ''}`,
      external_reference: orgId,
      payer_email: payerEmail,
      auto_recurring: {
        frequency: billingCycle === 'monthly' ? 1 : 12,
        frequency_type: 'months',
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
 * Uses the Payment API to find payments associated with the preapproval.
 */
export async function getSubscriptionPayments(preApprovalId: string) {
  const client = getMPClient();
  const payment = new Payment(client);

  const result = await payment.search({
    options: {
      criteria: 'desc',
      sort: 'date_created',
    },
  });

  // Filter by preapproval_id from results
  const payments = result.results ?? [];
  return payments.filter(
    (p: Record<string, unknown>) => p.preapproval_id === preApprovalId
  );
}
