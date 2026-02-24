# Pricing & Subscription System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 3-tier subscription system (Free/Advance/Enterprise) with Stripe Checkout billing, feature gating, and a billing settings page.

**Architecture:** Stripe Checkout Sessions for payment, webhooks for state sync to Supabase, plan limits as code constants in `@architech/shared`, server-side gating via `checkPlanLimit()`, client-side via `usePlan()` hook. Prepared for future Stripe Elements migration.

**Tech Stack:** Stripe SDK (`stripe`), Next.js API routes, Supabase (Postgres), Zod, SWR

**Design doc:** `docs/plans/2026-02-18-pricing-subscription-design.md`

---

## Task 1: Install Stripe SDK + add env vars

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/.env.example`

**Step 1: Install stripe**

Run: `npm install stripe -w apps/web`

**Step 2: Add env vars to .env.example**

Append to `apps/web/.env.example`:

```env
# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_ADVANCE_MONTHLY_BASE_PRICE_ID=
STRIPE_ADVANCE_YEARLY_BASE_PRICE_ID=
STRIPE_ADVANCE_MONTHLY_SEAT_PRICE_ID=
STRIPE_ADVANCE_YEARLY_SEAT_PRICE_ID=
```

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/.env.example
git commit -m "chore: install stripe SDK and add billing env vars"
```

---

## Task 2: Database migration — subscription fields on organizations

**Files:**
- Create: `packages/db/migrations/007_subscriptions.sql`

**Step 1: Write migration**

```sql
-- Subscription enums
CREATE TYPE subscription_plan AS ENUM ('free', 'advance', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');

-- Extend organizations with billing fields
ALTER TABLE organizations ADD COLUMN plan subscription_plan NOT NULL DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN subscription_status subscription_status NOT NULL DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN stripe_subscription_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN max_seats INTEGER NOT NULL DEFAULT 1;
ALTER TABLE organizations ADD COLUMN billing_cycle TEXT;
ALTER TABLE organizations ADD COLUMN current_period_end TIMESTAMPTZ;
```

**Step 2: Verify SQL syntax**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json` (should pass — migration is SQL only)

**Step 3: Commit**

```bash
git add packages/db/migrations/007_subscriptions.sql
git commit -m "feat: add subscription fields to organizations table"
```

---

## Task 3: Shared types and plan constants

**Files:**
- Modify: `packages/shared/src/types.ts` — add subscription fields to Organization
- Modify: `packages/shared/src/enums.ts` — add SubscriptionPlan and SubscriptionStatus
- Create: `packages/shared/src/plans.ts` — plan limits constants
- Modify: `packages/shared/package.json` — add `./plans` export

**Step 1: Add enums to `packages/shared/src/enums.ts`**

Append:

```ts
export const SubscriptionPlan = {
  FREE: 'free',
  ADVANCE: 'advance',
  ENTERPRISE: 'enterprise',
} as const;

export const SubscriptionStatus = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  TRIALING: 'trialing',
} as const;
```

**Step 2: Update Organization type in `packages/shared/src/types.ts`**

Add these fields to the `Organization` interface after `social_linkedin`:

```ts
  plan: 'free' | 'advance' | 'enterprise';
  subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  max_seats: number;
  billing_cycle: string | null;
  current_period_end: string | null;
```

**Step 3: Create `packages/shared/src/plans.ts`**

```ts
export const PLAN_LIMITS = {
  free: {
    maxProjects: 1,
    maxReceiptsPerProject: 20,
    maxSeats: 1,
    reports: false,
    prioritySupport: false,
  },
  advance: {
    maxProjects: 20,
    maxReceiptsPerProject: Infinity,
    maxSeats: null, // dynamic — uses org.max_seats from Stripe
    reports: true,
    prioritySupport: false,
  },
  enterprise: {
    maxProjects: Infinity,
    maxReceiptsPerProject: Infinity,
    maxSeats: Infinity,
    reports: true,
    prioritySupport: true,
  },
} as const;

export type SubscriptionPlan = keyof typeof PLAN_LIMITS;

export type PlanLimits = (typeof PLAN_LIMITS)[SubscriptionPlan];
```

**Step 4: Add export to `packages/shared/package.json`**

Add to `"exports"`:

```json
"./plans": "./src/plans.ts"
```

**Step 5: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/enums.ts packages/shared/src/plans.ts packages/shared/package.json
git commit -m "feat: add subscription types, enums, and plan limit constants"
```

---

## Task 4: Stripe client module

**Files:**
- Create: `apps/web/lib/stripe/client.ts` — singleton Stripe instance
- Create: `apps/web/lib/stripe/checkout.ts` — checkout session creation (isolated for future Elements migration)

**Step 1: Create `apps/web/lib/stripe/client.ts`**

```ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
});
```

**Step 2: Create `apps/web/lib/stripe/checkout.ts`**

```ts
// FUTURE: Elements migration
// Replace this module with lib/stripe/payment-intent.ts that creates
// a SetupIntent + Subscription instead of a Checkout Session.
// Webhooks, feature gating, and portal code do NOT change.

import { stripe } from './client';

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

  const session = await stripe.checkout.sessions.create({
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
```

**Step 3: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/lib/stripe/client.ts apps/web/lib/stripe/checkout.ts
git commit -m "feat: add Stripe client and checkout session module"
```

---

## Task 5: Stripe webhook handler

**Files:**
- Create: `apps/web/app/api/webhooks/stripe/route.ts`

**Step 1: Write webhook handler**

Follow same pattern as `apps/web/app/api/webhooks/clerk/route.ts` — verify signature, handle events, update DB.

```ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { getDb } from '@/lib/supabase';
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
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
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

        // Fetch subscription to get seat count and period
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const seatItem = subscription.items.data.find(
          (item) =>
            item.price.id === process.env.STRIPE_ADVANCE_MONTHLY_SEAT_PRICE_ID ||
            item.price.id === process.env.STRIPE_ADVANCE_YEARLY_SEAT_PRICE_ID
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
              subscription.current_period_end * 1000
            ).toISOString(),
          })
          .eq('id', orgId);

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const { data: orgs } = await db
          .from('organizations')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .limit(1);
        if (!orgs?.length) break;

        const seatItem = subscription.items.data.find(
          (item) =>
            item.price.id === process.env.STRIPE_ADVANCE_MONTHLY_SEAT_PRICE_ID ||
            item.price.id === process.env.STRIPE_ADVANCE_YEARLY_SEAT_PRICE_ID
        );

        await db
          .from('organizations')
          .update({
            subscription_status: subscription.status === 'active' ? 'active' : 'past_due',
            max_seats: seatItem?.quantity ?? orgs[0].max_seats,
            current_period_end: new Date(
              subscription.current_period_end * 1000
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
        if (!invoice.subscription) break;
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

        await db
          .from('organizations')
          .update({ subscription_status: 'active' })
          .eq('stripe_subscription_id', subId);

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

        await db
          .from('organizations')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_subscription_id', subId);

        break;
      }
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

**Step 2: Add `/api/webhooks/stripe` to public routes in middleware**

In `apps/web/middleware.ts`, update `isPublicRoute`:

```ts
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);
```

Note: `/api/webhooks(.*)` already covers `/api/webhooks/stripe`, so no change needed. Verify this.

**Step 3: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/app/api/webhooks/stripe/route.ts
git commit -m "feat: add Stripe webhook handler for subscription lifecycle"
```

---

## Task 6: Billing API routes (checkout-session, portal-session, plan)

**Files:**
- Create: `apps/web/app/api/billing/checkout-session/route.ts`
- Create: `apps/web/app/api/billing/portal-session/route.ts`
- Create: `apps/web/app/api/billing/plan/route.ts`

**Step 1: Create `checkout-session` route**

```ts
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
    customerEmail: '', // Clerk provides email via session
    stripeCustomerId: org.stripe_customer_id,
    billingCycle,
    seatCount,
    baseUrl,
  });

  return NextResponse.json({ url: session.url });
}
```

**Step 2: Create `portal-session` route**

```ts
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { stripe } from '@/lib/stripe/client';
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

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${baseUrl}/settings/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
```

**Step 3: Create `plan` route**

```ts
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { PLAN_LIMITS } from '@architech/shared/plans';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  const { data: org } = await db
    .from('organizations')
    .select('plan, subscription_status, max_seats, billing_cycle, current_period_end')
    .eq('id', ctx.orgId)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
  }

  const [{ count: currentProjects }, { count: currentUsers }] = await Promise.all([
    db
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId),
    db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .eq('is_active', true),
  ]);

  const limits = PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS];

  return NextResponse.json({
    plan: org.plan,
    subscriptionStatus: org.subscription_status,
    billingCycle: org.billing_cycle,
    currentPeriodEnd: org.current_period_end,
    maxSeats: org.plan === 'advance' ? org.max_seats : limits.maxSeats,
    currentSeats: currentUsers ?? 0,
    currentProjects: currentProjects ?? 0,
    limits,
  });
}
```

**Step 4: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

**Step 5: Commit**

```bash
git add "apps/web/app/api/billing/checkout-session/route.ts" "apps/web/app/api/billing/portal-session/route.ts" "apps/web/app/api/billing/plan/route.ts"
git commit -m "feat: add billing API routes (checkout, portal, plan)"
```

---

## Task 7: Feature gating — server-side

**Files:**
- Create: `apps/web/lib/plan-guard.ts`
- Modify: `apps/web/app/api/projects/route.ts` — add guard to POST
- Modify: `apps/web/app/api/receipts/route.ts` — add guard to POST
- Modify: `apps/web/app/api/invitations/route.ts` — add guard to POST
- Modify: `apps/web/app/api/reports/by-cost-center/route.ts` — add guard to GET

**Step 1: Create `apps/web/lib/plan-guard.ts`**

```ts
import { getDb } from '@/lib/supabase';
import { PLAN_LIMITS } from '@architech/shared/plans';

type Resource = 'project' | 'receipt' | 'user' | 'reports';

interface Allowed {
  allowed: true;
}
interface Denied {
  allowed: false;
  reason: string;
}

export async function checkPlanLimit(
  orgId: string,
  resource: Resource,
  extra?: { projectId?: string }
): Promise<Allowed | Denied> {
  const db = getDb();

  const { data: org } = await db
    .from('organizations')
    .select('plan, max_seats')
    .eq('id', orgId)
    .single();

  if (!org) return { allowed: false, reason: 'Organización no encontrada' };

  const plan = org.plan as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan];

  switch (resource) {
    case 'project': {
      if (limits.maxProjects === Infinity) return { allowed: true };
      const { count } = await db
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);
      if ((count ?? 0) >= limits.maxProjects) {
        return {
          allowed: false,
          reason: `Tu plan permite hasta ${limits.maxProjects} proyecto${limits.maxProjects === 1 ? '' : 's'}. Actualizá tu plan para crear más.`,
        };
      }
      return { allowed: true };
    }

    case 'receipt': {
      if (limits.maxReceiptsPerProject === Infinity) return { allowed: true };
      if (!extra?.projectId) return { allowed: true };
      const { count } = await db
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', extra.projectId);
      if ((count ?? 0) >= limits.maxReceiptsPerProject) {
        return {
          allowed: false,
          reason: `Tu plan permite hasta ${limits.maxReceiptsPerProject} comprobantes por proyecto. Actualizá tu plan para cargar más.`,
        };
      }
      return { allowed: true };
    }

    case 'user': {
      const maxSeats =
        plan === 'advance' ? org.max_seats : limits.maxSeats;
      if (maxSeats === Infinity) return { allowed: true };
      const { count } = await db
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true);
      if ((count ?? 0) >= (maxSeats ?? 1)) {
        return {
          allowed: false,
          reason: `Tu plan permite hasta ${maxSeats} usuario${maxSeats === 1 ? '' : 's'}. Actualizá tu plan para invitar más.`,
        };
      }
      return { allowed: true };
    }

    case 'reports': {
      if (!limits.reports) {
        return {
          allowed: false,
          reason: 'Los reportes están disponibles a partir del plan Advance.',
        };
      }
      return { allowed: true };
    }
  }
}
```

**Step 2: Add guard to `POST /api/projects`**

In `apps/web/app/api/projects/route.ts`, inside the `POST` function, after the role check and before the insert:

```ts
import { checkPlanLimit } from '@/lib/plan-guard';

// After: if (ctx.role === 'architect') return forbidden();
const guard = await checkPlanLimit(ctx.orgId, 'project');
if (!guard.allowed) {
  return NextResponse.json({ error: guard.reason }, { status: 403 });
}
```

**Step 3: Add guard to `POST /api/receipts`**

In `apps/web/app/api/receipts/route.ts`, inside the `POST` function, after auth check and before insert:

```ts
import { checkPlanLimit } from '@/lib/plan-guard';

// After auth context check, with the project_id from body:
const guard = await checkPlanLimit(ctx.orgId, 'receipt', { projectId: body.project_id });
if (!guard.allowed) {
  return NextResponse.json({ error: guard.reason }, { status: 403 });
}
```

**Step 4: Add guard to `POST /api/invitations`**

In `apps/web/app/api/invitations/route.ts`, inside the `POST` function, after role check and before creating invitation:

```ts
import { checkPlanLimit } from '@/lib/plan-guard';

// After: if (ctx.role !== 'admin') return forbidden();
const guard = await checkPlanLimit(ctx.orgId, 'user');
if (!guard.allowed) {
  return NextResponse.json({ error: guard.reason }, { status: 403 });
}
```

**Step 5: Add guard to `GET /api/reports/by-cost-center`**

In `apps/web/app/api/reports/by-cost-center/route.ts`, inside the `GET` function, after role check:

```ts
import { checkPlanLimit } from '@/lib/plan-guard';

// After: if (ctx.role === 'architect') return forbidden();
const guard = await checkPlanLimit(ctx.orgId, 'reports');
if (!guard.allowed) {
  return NextResponse.json({ error: guard.reason }, { status: 403 });
}
```

**Step 6: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/web/lib/plan-guard.ts "apps/web/app/api/projects/route.ts" "apps/web/app/api/receipts/route.ts" "apps/web/app/api/invitations/route.ts" "apps/web/app/api/reports/by-cost-center/route.ts"
git commit -m "feat: add server-side feature gating with plan limits"
```

---

## Task 8: Client-side `usePlan` hook + UpgradeBanner component

**Files:**
- Create: `apps/web/lib/use-plan.ts`
- Create: `apps/web/components/upgrade-banner.tsx`

**Step 1: Create `apps/web/lib/use-plan.ts`**

```ts
'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { PLAN_LIMITS } from '@architech/shared/plans';

interface PlanData {
  plan: 'free' | 'advance' | 'enterprise';
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing';
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  maxSeats: number | null;
  currentSeats: number;
  currentProjects: number;
  limits: (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];
}

export function usePlan() {
  const { data, isLoading, error, mutate } = useSWR<PlanData>(
    '/api/billing/plan',
    fetcher
  );

  const plan = data?.plan ?? 'free';
  const limits = data?.limits ?? PLAN_LIMITS.free;

  const canCreateProject =
    limits.maxProjects === Infinity ||
    (data?.currentProjects ?? 0) < limits.maxProjects;

  const canInviteUser =
    data?.maxSeats === null ||
    data?.maxSeats === Infinity ||
    (data?.currentSeats ?? 0) < (data?.maxSeats ?? 1);

  return {
    plan,
    limits,
    subscriptionStatus: data?.subscriptionStatus ?? 'active',
    billingCycle: data?.billingCycle,
    currentPeriodEnd: data?.currentPeriodEnd,
    maxSeats: data?.maxSeats,
    currentSeats: data?.currentSeats ?? 0,
    currentProjects: data?.currentProjects ?? 0,
    canCreateProject,
    canInviteUser,
    isFreePlan: plan === 'free',
    isPastDue: data?.subscriptionStatus === 'past_due',
    isLoading,
    error,
    mutate,
  };
}
```

**Step 2: Create `apps/web/components/upgrade-banner.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';

interface UpgradeBannerProps {
  message: string;
}

export function UpgradeBanner({ message }: UpgradeBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <Zap className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="flex-1 text-amber-800 dark:text-amber-200">{message}</p>
      <Link
        href="/settings/billing"
        className="shrink-0 font-medium text-amber-700 underline underline-offset-4 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
      >
        Ver planes
      </Link>
    </div>
  );
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/lib/use-plan.ts apps/web/components/upgrade-banner.tsx
git commit -m "feat: add usePlan hook and UpgradeBanner component"
```

---

## Task 9: Integrate gating in UI (sidebar + projects + invitations)

**Files:**
- Modify: `apps/web/components/sidebar.tsx` — hide Reports for free plan
- Modify: `apps/web/app/(dashboard)/projects/page.tsx` — disable create when limit reached
- Modify: `apps/web/components/invite-user-dialog.tsx` — disable invite when limit reached

**Step 1: Update sidebar to check plan for Reports**

In `apps/web/components/sidebar.tsx`, the Reports nav item currently has `roles: ['admin', 'supervisor']`. Add plan check:

Import `usePlan`:
```ts
import { usePlan } from '@/lib/use-plan';
```

Inside the component, after the role check:
```ts
const { isFreePlan } = usePlan();
```

Change the Reports nav item filter to also check plan:
```ts
const visibleNavItems = navItems.filter(
  (item) => {
    if (item.roles && !item.roles.includes(role)) return false;
    if (item.href === '/reports' && isFreePlan) return false;
    return true;
  }
);
```

**Step 2: Update ProjectsPage to show UpgradeBanner**

In `apps/web/app/(dashboard)/projects/page.tsx`:

Import:
```ts
import { usePlan } from '@/lib/use-plan';
import { UpgradeBanner } from '@/components/upgrade-banner';
```

Inside component:
```ts
const { canCreateProject } = usePlan();
```

Wrap the "Nuevo Proyecto" button: disable it when `!canCreateProject`, and show banner:
```tsx
action={
  isAdminOrSupervisor ? (
    <Button onClick={() => setShowCreateDialog(true)} disabled={!canCreateProject}>
      <Plus className="mr-2" />
      Nuevo Proyecto
    </Button>
  ) : undefined
}
```

After the filters div, before the loading check:
```tsx
{!canCreateProject && isAdminOrSupervisor && (
  <div className="mb-6">
    <UpgradeBanner message="Alcanzaste el límite de proyectos en tu plan." />
  </div>
)}
```

**Step 3: Update invite dialog to show limit**

In `apps/web/components/invite-user-dialog.tsx`:

Import:
```ts
import { usePlan } from '@/lib/use-plan';
import { UpgradeBanner } from '@/components/upgrade-banner';
```

Inside component:
```ts
const { canInviteUser } = usePlan();
```

Disable the invite button when `!canInviteUser`, and show banner inside dialog:
```tsx
{!canInviteUser && (
  <UpgradeBanner message="Alcanzaste el límite de usuarios en tu plan." />
)}
```

**Step 4: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/components/sidebar.tsx "apps/web/app/(dashboard)/projects/page.tsx" apps/web/components/invite-user-dialog.tsx
git commit -m "feat: integrate plan gating in sidebar, projects, and invitations UI"
```

---

## Task 10: Billing settings page

**Files:**
- Create: `apps/web/app/(dashboard)/settings/billing/page.tsx`
- Modify: `apps/web/app/(dashboard)/settings/layout.tsx` — add billing tab

**Step 1: Add billing tab to settings layout**

In `apps/web/app/(dashboard)/settings/layout.tsx`, add to the `tabs` array:

```ts
{ href: '/settings/billing', label: 'Facturación', roles: ['admin'] },
```

**Step 2: Create billing page**

Create `apps/web/app/(dashboard)/settings/billing/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, ExternalLink, Zap, Building2, AlertTriangle } from 'lucide-react';
import { usePlan } from '@/lib/use-plan';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

const PLAN_FEATURES = {
  free: [
    '1 proyecto',
    '20 comprobantes por proyecto',
    '1 usuario',
    'Sin reportes',
  ],
  advance: [
    '20 proyectos',
    'Comprobantes ilimitados',
    'Reportes de gastos',
    'Seats flexibles',
  ],
  enterprise: [
    'Proyectos ilimitados',
    'Comprobantes ilimitados',
    'Reportes de gastos',
    'Usuarios ilimitados',
    'Soporte prioritario',
  ],
};

export default function BillingPage() {
  const router = useRouter();
  const {
    plan,
    subscriptionStatus,
    billingCycle,
    currentPeriodEnd,
    maxSeats,
    currentSeats,
    currentProjects,
    isPastDue,
    isFreePlan,
    isLoading,
  } = usePlan();

  const [billingOption, setBillingOption] = useState<'monthly' | 'yearly'>('monthly');
  const [seatCount, setSeatCount] = useState(3);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleUpgrade = async () => {
    setIsRedirecting(true);
    try {
      const res = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingCycle: billingOption, seatCount }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setIsRedirecting(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsRedirecting(true);
    try {
      const res = await fetch('/api/billing/portal-session', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Facturación" />
        <LoadingCards count={3} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Facturación"
        description="Gestioná tu plan y suscripción"
      />

      {/* Past due warning */}
      {isPastDue && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="font-medium text-red-800 dark:text-red-200">
              Tu pago falló
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Actualizá tu método de pago para mantener tu plan activo.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleManageSubscription}>
            Actualizar pago
          </Button>
        </div>
      )}

      {/* Current plan summary */}
      {!isFreePlan && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plan {plan === 'advance' ? 'Advance' : 'Enterprise'}
                  <Badge variant="secondary">
                    {billingCycle === 'yearly' ? 'Anual' : 'Mensual'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {currentProjects} proyectos · {currentSeats} de {maxSeats ?? '∞'} usuarios
                  {currentPeriodEnd && (
                    <> · Próxima facturación: {new Date(currentPeriodEnd).toLocaleDateString('es-AR')}</>
                  )}
                </CardDescription>
              </div>
              {plan === 'advance' && (
                <Button variant="outline" onClick={handleManageSubscription} disabled={isRedirecting}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Gestionar suscripción
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {plan === 'enterprise' && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Para cambios en tu plan, contactá a soporte.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pricing cards — shown for free plan, hidden for enterprise */}
      {plan !== 'enterprise' && (
        <>
          {isFreePlan && (
            <div className="mb-6 flex items-center justify-center gap-4">
              <button
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  billingOption === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setBillingOption('monthly')}
              >
                Mensual
              </button>
              <button
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  billingOption === 'yearly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setBillingOption('yearly')}
              >
                Anual
                <span className="ml-1 text-xs opacity-75">(ahorrá 2 meses)</span>
              </button>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {/* Free */}
            <Card className={isFreePlan ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <CardDescription>Para empezar</CardDescription>
                <p className="text-3xl font-bold">Gratis</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {PLAN_FEATURES.free.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-muted-foreground">·</span> {f}
                    </li>
                  ))}
                </ul>
                {isFreePlan && (
                  <Button variant="outline" className="mt-6 w-full" disabled>
                    Plan actual
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Advance */}
            <Card className={plan === 'advance' ? 'border-primary' : 'border-2 border-primary/50'}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Advance</CardTitle>
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                <CardDescription>Para equipos en crecimiento</CardDescription>
                <p className="text-3xl font-bold">
                  Consultar precio
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {PLAN_FEATURES.advance.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-primary">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {isFreePlan && (
                  <>
                    <div className="mt-4">
                      <label className="text-sm font-medium">
                        Usuarios: {seatCount}
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={seatCount}
                        onChange={(e) => setSeatCount(Number(e.target.value))}
                        className="mt-1 w-full"
                      />
                    </div>
                    <Button
                      className="mt-4 w-full"
                      onClick={handleUpgrade}
                      disabled={isRedirecting}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      {isRedirecting ? 'Redirigiendo...' : 'Elegir plan'}
                    </Button>
                  </>
                )}
                {plan === 'advance' && (
                  <Button variant="outline" className="mt-6 w-full" disabled>
                    Plan actual
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Enterprise</CardTitle>
                  <Building2 className="h-4 w-4 text-violet-500" />
                </div>
                <CardDescription>Para grandes organizaciones</CardDescription>
                <p className="text-3xl font-bold">Personalizado</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {PLAN_FEATURES.enterprise.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-primary">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="mt-6 w-full" asChild>
                  <a
                    href="https://wa.me/TUNUMERO"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Contactanos
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

**Step 4: Commit**

```bash
git add "apps/web/app/(dashboard)/settings/billing/page.tsx" "apps/web/app/(dashboard)/settings/layout.tsx"
git commit -m "feat: add billing settings page with pricing cards and subscription management"
```

---

## Task 11: Final verification and cleanup

**Step 1: Full build**

Run: `npm run build --workspace=apps/web`
Expected: PASS with no errors

**Step 2: Verify all new files are committed**

Run: `git status`
Expected: Clean working tree

**Step 3: Review for unused imports**

Check all modified files for unused imports (Label, etc.) and remove if found.

**Step 4: Final commit (if cleanup needed)**

```bash
git add -A
git commit -m "chore: cleanup unused imports"
```

---

## Manual steps for the user (Stripe Dashboard)

After the code is deployed:

1. **Go to** [dashboard.stripe.com](https://dashboard.stripe.com) → Products
2. **Create Product** "Agentect Advance" with 4 prices:
   - Monthly base: recurring/month, your price in ARS
   - Yearly base: recurring/year, monthly×10
   - Monthly seat: recurring/month, per-user price
   - Yearly seat: recurring/year, per-user×10
3. **Copy the 4 Price IDs** (`price_...`) → set as env vars in Vercel
4. **Go to** Developers → Webhooks → Add endpoint
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
   - Copy the Signing Secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel
5. **Go to** Settings → Customer Portal → configure:
   - Enable "Cancel subscription"
   - Enable "Update payment method"
   - Return URL: `https://your-domain.com/settings/billing`
6. **Set env vars** in Vercel (Settings → Environment Variables):
   - `STRIPE_SECRET_KEY` = `sk_live_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`
   - `STRIPE_ADVANCE_MONTHLY_BASE_PRICE_ID` = `price_...`
   - `STRIPE_ADVANCE_YEARLY_BASE_PRICE_ID` = `price_...`
   - `STRIPE_ADVANCE_MONTHLY_SEAT_PRICE_ID` = `price_...`
   - `STRIPE_ADVANCE_YEARLY_SEAT_PRICE_ID` = `price_...`
7. **Run migration** `007_subscriptions.sql` in Supabase SQL Editor
8. **Test** with Stripe test card `4242 4242 4242 4242`
