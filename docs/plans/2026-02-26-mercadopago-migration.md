# Migración Stripe → Mercado Pago — Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reemplazar Stripe como pasarela de pago por Mercado Pago, manteniendo los mismos tiers (Free/Advance/Enterprise) con pricing base + seats, suscripciones recurrentes, webhooks, y UI custom para gestión de suscripción.

**Architecture:** Mercado Pago usa la API PreApproval para suscripciones recurrentes. El flujo correcto es: (1) crear un PreApprovalPlan como template reutilizable por billing cycle, (2) crear un PreApproval individual por org con `external_reference = orgId` y `payer_email`, (3) redirigir al `init_point` del PreApproval (no del plan). MP no soporta multi-line-item, así que se calcula el monto total server-side. No tiene Billing Portal — se construye UI custom. Los webhooks solo envían el ID del recurso — hay que hacer GET adicional.

**Tech Stack:** `mercadopago` SDK v2.x (Node.js), Next.js 16 App Router, Supabase (Postgres), Zod, SWR, Tailwind + Shadcn/ui.

---

## Fases de Ejecución

| Fase | Descripción | Riesgo | Reversible |
|------|-------------|--------|------------|
| **0** | Preparación (sin cambios de código) | Ninguno | N/A |
| **1** | Infraestructura aditiva (Stripe sigue funcionando) | Bajo | Sí — borrar columnas nuevas |
| **2** | Nuevo flujo de billing con MP | Medio | Sí — revertir a Stripe |
| **3** | Cutover y cleanup (eliminar Stripe) | Medio | No — requiere re-deploy |

---

## Phase 0: Preparación

### Task 0.1: Setup de Mercado Pago

**No se toca código. Solo configuración externa.**

**Step 1: Crear test accounts en MP**

1. Ir a https://www.mercadopago.com.ar/developers/panel/app
2. Crear 2 test accounts: una vendedor, una comprador
3. Obtener access token del vendedor (formato `TEST-xxx`)
4. Anotar las credenciales

**Step 2: Registrar webhook en el panel de MP**

1. En el panel de developer, ir a Webhooks
2. URL: `https://tu-dominio.vercel.app/api/webhooks/mercadopago` (o usar ngrok para dev local)
3. Eventos a registrar: `subscription_preapproval`, `subscription_authorized_payment`
4. Obtener el webhook secret

**Step 3: Backup de Supabase**

Run:
```bash
# Tomar un point-in-time restore checkpoint en Supabase dashboard
# Settings > Database > Backups > Create backup
```

**Step 4: Inventario de referencias Stripe en SQL**

Verificar que no existan RLS policies que referencien `stripe_customer_id` o `stripe_subscription_id` directamente en Supabase:

```sql
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'organizations';
```

Expected: Ninguna policy referencia las columnas stripe.

---

## Phase 1: Infraestructura Aditiva

> En esta fase, Stripe sigue funcionando. Todo es aditivo — no se borra ni renombra nada.

### Task 1.1: Instalar SDK de Mercado Pago

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Instalar mercadopago (sin desinstalar stripe todavía)**

Run:
```bash
cd apps/web && npm install mercadopago
```

**Step 2: Verificar que compila**

Run:
```bash
cd /Users/juanpernu/Workspace/agentic-architect && npx turbo build --filter=web
```
Expected: SUCCESS

**Step 3: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore: add mercadopago SDK"
```

---

### Task 1.2: DB migration — columnas aditivas + enum paused

**Files:**
- Create: `supabase/migrations/20260226120000_mercadopago_columns.sql`

**Step 1: Crear migración SQL**

```sql
-- Add 'paused' to subscription_status enum
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'paused';

-- Add provider-agnostic columns alongside existing stripe columns
ALTER TABLE organizations ADD COLUMN payment_customer_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN payment_subscription_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN subscription_seats INTEGER;

-- Backfill from existing stripe columns for any active subscriptions
UPDATE organizations SET
  payment_customer_id = stripe_customer_id,
  payment_subscription_id = stripe_subscription_id,
  subscription_seats = max_seats
WHERE plan != 'free' AND stripe_subscription_id IS NOT NULL;
```

> **Nota:** No renombramos ni eliminamos las columnas stripe todavía. El código actual sigue funcionando.

**Step 2: Aplicar migración**

Run:
```bash
npx supabase db push
```
Expected: Migration applied

**Step 3: Commit**

```bash
git add supabase/migrations/20260226120000_mercadopago_columns.sql
git commit -m "feat: add provider-agnostic billing columns and paused status"
```

---

### Task 1.3: Agregar env vars de MP (sin quitar Stripe)

**Files:**
- Modify: `apps/web/lib/env.ts`

**Step 1: Agregar variables MP al schema Zod**

En `apps/web/lib/env.ts`, agregar después del bloque Stripe (línea 19), sin borrar las vars de Stripe:

```typescript
// Mercado Pago
MP_ACCESS_TOKEN: z.string().min(1),
MP_WEBHOOK_SECRET: z.string().min(1),
```

**Step 2: Actualizar `.env.local`**

Agregar (sin borrar las de Stripe):
```env
MP_ACCESS_TOKEN=TEST-xxx
MP_WEBHOOK_SECRET=xxx
```

**Step 3: Verificar**

Run:
```bash
cd apps/web && npx tsx -e "import './lib/env';"
```
Expected: Sin errores

**Step 4: Commit**

```bash
git add apps/web/lib/env.ts
git commit -m "feat: add Mercado Pago env vars alongside Stripe"
```

---

### Task 1.4: Crear módulo Mercado Pago — client + pricing

**Files:**
- Create: `apps/web/lib/mercadopago/client.ts`
- Create: `apps/web/lib/mercadopago/pricing.ts`

**Step 1: Client — `apps/web/lib/mercadopago/client.ts`**

```typescript
import { MercadoPagoConfig } from 'mercadopago';
import { env } from '../env';

let _client: MercadoPagoConfig | null = null;

export function getMPClient(): MercadoPagoConfig {
  if (!_client) {
    _client = new MercadoPagoConfig({
      accessToken: env.MP_ACCESS_TOKEN,
    });
  }
  return _client;
}
```

**Step 2: Pricing — `apps/web/lib/mercadopago/pricing.ts`**

```typescript
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
  monthly: { base: 30_000, seat: 5_000 },
  yearly: { base: 300_000, seat: 50_000 },
} as const;

export type BillingCycle = 'monthly' | 'yearly';

export function computeSubscriptionAmount(
  billingCycle: BillingCycle,
  seatCount: number
): number {
  const prices = MP_PRICING[billingCycle];
  return prices.base + prices.seat * seatCount;
}
```

**Step 3: Commit**

```bash
git add apps/web/lib/mercadopago/
git commit -m "feat: add Mercado Pago client and pricing modules"
```

---

### Task 1.5: Crear módulo Mercado Pago — subscription helpers

**Files:**
- Create: `apps/web/lib/mercadopago/subscription.ts`

**Step 1: Crear subscription.ts**

> **Importante:** El flujo correcto es: crear PreApprovalPlan (template reutilizable), luego crear PreApproval individual con `external_reference = orgId`. Retornar el `init_point` del PreApproval, NO del plan.

```typescript
import { PreApprovalPlan, PreApproval, Payment } from 'mercadopago';
import { getMPClient } from './client';
import { computeSubscriptionAmount, type BillingCycle } from './pricing';

// --- Plan Management (templates) ---

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
 * Uses the Payment API with preapproval_id filter.
 */
export async function getSubscriptionPayments(preApprovalId: string) {
  const client = getMPClient();
  const payment = new Payment(client);

  const result = await payment.search({
    options: {
      criteria: 'desc',
      sort: 'date_created',
    },
    body: {
      preapproval_id: preApprovalId,
    },
  });

  return result.results ?? [];
}
```

**Step 2: Verificar que compila**

Run:
```bash
npx turbo build --filter=web
```

> **Nota:** Si el SDK de `mercadopago` no exporta `Payment` o los tipos no coinciden exactamente, ajustar los imports según lo que expone el SDK real. Verificar con `npx tsx -e "import { Payment, PreApproval, PreApprovalPlan, MercadoPagoConfig } from 'mercadopago'; console.log('OK')"`.

**Step 3: Commit**

```bash
git add apps/web/lib/mercadopago/subscription.ts
git commit -m "feat: add Mercado Pago subscription helpers (create, cancel, pause, resume, update)"
```

---

### Task 1.6: Crear módulo Mercado Pago — webhook verification

**Files:**
- Create: `apps/web/lib/mercadopago/webhook.ts`

**Step 1: Crear webhook.ts**

```typescript
import crypto from 'crypto';
import { env } from '../env';

/**
 * Verify Mercado Pago webhook signature.
 *
 * MP sends x-signature header with format: "ts=TIMESTAMP,v1=HASH"
 * The HMAC-SHA256 is computed over: "id:{dataId};request-id:{requestId};ts:{ts};"
 *
 * @see https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 */
export function verifyWebhookSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string
): boolean {
  if (!xSignature || !xRequestId || !dataId) return false;

  const parts = xSignature.split(',');
  const tsEntry = parts.find((p) => p.trim().startsWith('ts='));
  const v1Entry = parts.find((p) => p.trim().startsWith('v1='));
  if (!tsEntry || !v1Entry) return false;

  const ts = tsEntry.split('=')[1]?.trim();
  const receivedSig = v1Entry.split('=')[1]?.trim();
  if (!ts || !receivedSig) return false;

  const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expectedSig = crypto
    .createHmac('sha256', env.MP_WEBHOOK_SECRET)
    .update(template)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(receivedSig, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
}
```

> **Nota:** Se usa `crypto.timingSafeEqual` en lugar de `===` para prevenir timing attacks en la verificación de firma.

**Step 2: Commit**

```bash
git add apps/web/lib/mercadopago/webhook.ts
git commit -m "feat: add Mercado Pago webhook signature verification"
```

---

### Task 1.7: Actualizar types compartidos (aditivo)

**Files:**
- Modify: `packages/shared/src/types.ts:19-20`

**Step 1: Agregar campos nuevos a Organization (sin borrar los viejos)**

En `packages/shared/src/types.ts`, después de la línea 20 (`stripe_subscription_id`), agregar:

```typescript
payment_customer_id: string | null;
payment_subscription_id: string | null;
subscription_seats: number | null;
```

Y actualizar `subscription_status` para incluir `'paused'`:

```typescript
subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
```

**Step 2: Verificar que compila**

Run:
```bash
npx turbo build --filter=@architech/shared
```

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add provider-agnostic billing fields and paused status to Organization type"
```

---

## Phase 2: Nuevo Flujo de Billing con Mercado Pago

> En esta fase se reescriben los endpoints de billing para usar MP. Los endpoints de Stripe siguen existiendo pero no se usan.

### Task 2.1: Reescribir checkout-session con flujo correcto (Plan + Subscription)

**Files:**
- Modify: `apps/web/app/api/billing/checkout-session/route.ts`

**Step 1: Reescribir el endpoint completo**

```typescript
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { createPlan, createSubscription } from '@/lib/mercadopago/subscription';
import { computeSubscriptionAmount } from '@/lib/mercadopago/pricing';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const rl = rateLimit('billing', ctx.orgId);
  if (rl) return rl;

  const body = await request.json();
  const { billingCycle, seatCount } = body;

  if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
    return NextResponse.json({ error: 'billingCycle inválido' }, { status: 400 });
  }
  if (!seatCount || typeof seatCount !== 'number' || seatCount < 1 || seatCount > 20) {
    return NextResponse.json({ error: 'seatCount inválido' }, { status: 400 });
  }

  const db = getDb();
  const [{ data: org }, { data: user }] = await Promise.all([
    db.from('organizations').select('id, plan').eq('id', ctx.orgId).single(),
    db.from('users').select('email').eq('id', ctx.dbUserId).single(),
  ]);

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
  }
  if (org.plan !== 'free') {
    return NextResponse.json({ error: 'Ya tenés un plan activo.' }, { status: 400 });
  }

  const payerEmail = user?.email ?? '';
  if (!payerEmail) {
    return NextResponse.json(
      { error: 'No se encontró un email para crear la suscripción' },
      { status: 400 }
    );
  }

  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const backUrl = `${protocol}://${host}/settings/billing?checkout=pending`;

  const totalAmount = computeSubscriptionAmount(billingCycle, seatCount);

  try {
    // Step 1: Store pending subscription data FIRST (before MP call)
    // This way the webhook can resolve the org even under race conditions
    await db
      .from('organizations')
      .update({
        subscription_seats: seatCount,
        billing_cycle: billingCycle,
      })
      .eq('id', ctx.orgId);

    // Step 2: Create a PreApprovalPlan (reusable template)
    const plan = await createPlan({ billingCycle, totalAmount, backUrl });

    if (!plan.id) {
      return NextResponse.json({ error: 'Error al crear el plan de pago' }, { status: 500 });
    }

    // Step 3: Create individual PreApproval with external_reference = orgId
    // This is the actual subscription — its init_point carries the org context
    const subscription = await createSubscription({
      planId: plan.id,
      orgId: ctx.orgId,
      payerEmail,
      billingCycle,
      seatCount,
      backUrl,
    });

    if (!subscription.init_point) {
      return NextResponse.json({ error: 'Error al crear la suscripción' }, { status: 500 });
    }

    return NextResponse.json({ url: subscription.init_point });
  } catch (err) {
    return apiError(err, 'Error al crear sesión de pago', 500, {
      route: '/api/billing/checkout-session',
    });
  }
}
```

**Step 2: Verificar que compila**

Run:
```bash
npx turbo build --filter=web
```

**Step 3: Commit**

```bash
git add apps/web/app/api/billing/checkout-session/route.ts
git commit -m "feat: rewrite checkout-session with MP PreApproval flow (plan + subscription)"
```

---

### Task 2.2: Crear webhook handler de Mercado Pago

**Files:**
- Create: `apps/web/app/api/webhooks/mercadopago/route.ts`

**Step 1: Crear el webhook handler**

```typescript
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
      // Payment confirmation — the subscription_preapproval event handles status.
      // If we need to update current_period_end, we'd fetch the subscription here.
    }
  } catch (err) {
    logger.error('MP webhook handler error', {
      route: '/api/webhooks/mercadopago',
    }, err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

**Step 2: Verificar que el middleware cubre el nuevo webhook**

El middleware existente ya tiene `/api/webhooks(.*)` como ruta pública. No necesita cambios.

**Step 3: Commit**

```bash
git add apps/web/app/api/webhooks/mercadopago/
git commit -m "feat: add Mercado Pago webhook handler with signature verification"
```

---

### Task 2.3: API endpoints de gestión de suscripción

**Files:**
- Create: `apps/web/app/api/billing/cancel/route.ts`
- Create: `apps/web/app/api/billing/pause/route.ts`
- Create: `apps/web/app/api/billing/update-seats/route.ts`
- Create: `apps/web/app/api/billing/payments/route.ts`

#### Step 1: Cancel — `apps/web/app/api/billing/cancel/route.ts`

> **Importante:** Llamar a MP primero, confirmar éxito, luego actualizar DB.

```typescript
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { cancelSubscription } from '@/lib/mercadopago/subscription';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const rl = rateLimit('billing', ctx.orgId);
  if (rl) return rl;

  const db = getDb();
  const { data: org } = await db
    .from('organizations')
    .select('payment_subscription_id, plan')
    .eq('id', ctx.orgId)
    .single();

  if (!org?.payment_subscription_id) {
    return NextResponse.json({ error: 'No hay suscripción activa' }, { status: 400 });
  }

  try {
    // Call MP API first — only downgrade DB on confirmed success
    await cancelSubscription(org.payment_subscription_id);

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
      .eq('id', ctx.orgId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, 'Error al cancelar la suscripción', 500, {
      route: '/api/billing/cancel',
    });
  }
}
```

#### Step 2: Pause/Resume — `apps/web/app/api/billing/pause/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { pauseSubscription, resumeSubscription } from '@/lib/mercadopago/subscription';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const rl = rateLimit('billing', ctx.orgId);
  if (rl) return rl;

  const body = await request.json();
  const { action } = body;

  if (!action || !['pause', 'resume'].includes(action)) {
    return NextResponse.json({ error: 'action inválido (pause | resume)' }, { status: 400 });
  }

  const db = getDb();
  const { data: org } = await db
    .from('organizations')
    .select('payment_subscription_id, subscription_status')
    .eq('id', ctx.orgId)
    .single();

  if (!org?.payment_subscription_id) {
    return NextResponse.json({ error: 'No hay suscripción activa' }, { status: 400 });
  }

  try {
    if (action === 'pause') {
      await pauseSubscription(org.payment_subscription_id);
      await db
        .from('organizations')
        .update({ subscription_status: 'paused' })
        .eq('id', ctx.orgId);
    } else {
      await resumeSubscription(org.payment_subscription_id);
      await db
        .from('organizations')
        .update({ subscription_status: 'active' })
        .eq('id', ctx.orgId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(
      err,
      action === 'pause' ? 'Error al pausar la suscripción' : 'Error al reactivar la suscripción',
      500,
      { route: '/api/billing/pause' }
    );
  }
}
```

#### Step 3: Update seats — `apps/web/app/api/billing/update-seats/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { updateSubscriptionAmount } from '@/lib/mercadopago/subscription';
import type { BillingCycle } from '@/lib/mercadopago/pricing';
import { apiError } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';

const VALID_CYCLES = new Set<BillingCycle>(['monthly', 'yearly']);

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const rl = rateLimit('billing', ctx.orgId);
  if (rl) return rl;

  const body = await request.json();
  const { seatCount } = body;

  if (!seatCount || typeof seatCount !== 'number' || seatCount < 1 || seatCount > 20) {
    return NextResponse.json({ error: 'seatCount inválido' }, { status: 400 });
  }

  const db = getDb();
  const { data: org } = await db
    .from('organizations')
    .select('payment_subscription_id, billing_cycle')
    .eq('id', ctx.orgId)
    .single();

  if (!org?.payment_subscription_id) {
    return NextResponse.json({ error: 'No hay suscripción activa' }, { status: 400 });
  }

  const billingCycle = org.billing_cycle as BillingCycle;
  if (!VALID_CYCLES.has(billingCycle)) {
    return NextResponse.json({ error: 'billing_cycle inválido en la base de datos' }, { status: 500 });
  }

  try {
    await updateSubscriptionAmount(org.payment_subscription_id, billingCycle, seatCount);

    await db
      .from('organizations')
      .update({ max_seats: seatCount, subscription_seats: seatCount })
      .eq('id', ctx.orgId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, 'Error al actualizar los seats', 500, {
      route: '/api/billing/update-seats',
    });
  }
}
```

#### Step 4: Payment history — `apps/web/app/api/billing/payments/route.ts`

```typescript
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
```

#### Step 5: Commit

```bash
git add apps/web/app/api/billing/cancel/ apps/web/app/api/billing/pause/ apps/web/app/api/billing/update-seats/ apps/web/app/api/billing/payments/
git commit -m "feat: add billing management endpoints (cancel, pause, update-seats, payments)"
```

---

### Task 2.4: Actualizar usePlan hook

**Files:**
- Modify: `apps/web/lib/use-plan.ts`

**Step 1: Agregar `isPaused` al hook**

En `apps/web/lib/use-plan.ts`, actualizar la interface `PlanData`:

```typescript
interface PlanData {
  plan: 'free' | 'advance' | 'enterprise';
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  maxSeats: number | null;
  currentSeats: number;
  currentProjects: number;
  limits: (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];
}
```

Agregar en el return del hook:

```typescript
isPaused: data?.subscriptionStatus === 'paused',
```

**Step 2: Commit**

```bash
git add apps/web/lib/use-plan.ts
git commit -m "feat: add isPaused to usePlan hook"
```

---

### Task 2.5: Reescribir billing page con UI custom completa

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/billing/page.tsx`

**Step 1: Reescribir componente completo**

Cambios clave respecto al plan v1:
- Precios en ARS con `formatARS()` en vez de US$
- `handlePauseResume` usa `isPaused` para decidir la acción
- Status badge con colores para active (verde), paused (ámbar), past_due/canceled (rojo)
- Cancel en sección separada "Zona de riesgo" con AlertDialog
- Estado post-checkout con polling (`?checkout=pending`)
- past_due banner con link a Mercado Pago
- FAQ actualizado con info de métodos de pago

```typescript
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  CreditCard,
  Zap,
  AlertTriangle,
  Star,
  CheckCircle2,
  Lock,
  ChevronDown,
  Pause,
  Play,
  XCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { usePlan } from '@/lib/use-plan';
import { fetcher } from '@/lib/fetcher';
import { Button } from '@/components/ui/button';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const ADVANCE_PRICING = {
  monthly: { base: 30_000, seat: 5_000 },
  yearly: { base: 300_000, seat: 50_000 },
} as const;

function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

const PLAN_FEATURES = {
  free: ['1 proyecto', '20 comprobantes por proyecto', '1 usuario', 'Sin reportes'],
  advance: ['20 proyectos', 'Comprobantes ilimitados', 'Reportes de gastos', 'Seats flexibles'],
  enterprise: [
    'Proyectos ilimitados',
    'Comprobantes ilimitados',
    'Reportes de gastos',
    'Usuarios ilimitados',
    'Soporte prioritario',
  ],
};

const FAQ_ITEMS = [
  {
    question: '¿Puedo cancelar en cualquier momento?',
    answer:
      'Sí, podés cancelar tu suscripción en cualquier momento desde esta página. Tu plan volverá a Free inmediatamente.',
  },
  {
    question: '¿Qué métodos de pago aceptan?',
    answer:
      'Aceptamos tarjetas de crédito y débito (Visa, Mastercard, Amex, Naranja, Cabal) y saldo de Mercado Pago.',
  },
  {
    question: '¿Cómo funciona la extracción con AI?',
    answer:
      'Nuestra tecnología escanea tus tickets y facturas (fotos o PDF) y extrae automáticamente los datos como fecha, proveedor, montos e impuestos.',
  },
];

export default function BillingPage() {
  const searchParams = useSearchParams();
  const checkoutPending = searchParams.get('checkout') === 'pending';

  const {
    plan,
    subscriptionStatus,
    billingCycle,
    currentPeriodEnd,
    maxSeats,
    currentSeats,
    currentProjects,
    isPastDue,
    isPaused,
    isFreePlan,
    isLoading,
    mutate,
  } = usePlan();

  // Poll while checkout is pending and plan hasn't updated yet
  useSWR(
    checkoutPending && plan === 'free' ? '/api/billing/plan' : null,
    fetcher,
    {
      refreshInterval: 3000,
      onSuccess: () => mutate(),
    }
  );

  const [billingOption, setBillingOption] = useState<'monthly' | 'yearly'>('monthly');
  const [seatCount, setSeatCount] = useState(3);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setIsRedirecting(true);
    setUpgradeError(null);
    try {
      const res = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingCycle: billingOption, seatCount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUpgradeError(data.error ?? `Error ${res.status}`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setUpgradeError('Error de conexión. Intentá de nuevo.');
    } finally {
      setIsRedirecting(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading('cancel');
    setActionError(null);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error ?? 'Error al cancelar');
        return;
      }
      await mutate();
    } catch {
      setActionError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseResume = async () => {
    const action = isPaused ? 'resume' : 'pause';
    setActionLoading(action);
    setActionError(null);
    try {
      const res = await fetch('/api/billing/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error ?? 'Error');
        return;
      }
      await mutate();
    } catch {
      setActionError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return <LoadingCards count={3} />;
  }

  // Status badge styling
  const badgeStyle =
    subscriptionStatus === 'active'
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : subscriptionStatus === 'paused'
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        : 'bg-red-500/20 text-red-400 border-red-500/30';

  const pulseColor =
    subscriptionStatus === 'active'
      ? 'bg-emerald-400'
      : subscriptionStatus === 'paused'
        ? 'bg-amber-400'
        : 'bg-red-400';

  const statusLabel =
    subscriptionStatus === 'active'
      ? 'ACTIVO'
      : subscriptionStatus === 'paused'
        ? 'PAUSADO'
        : (subscriptionStatus ?? '').toUpperCase();

  return (
    <div className="space-y-6">
      {/* Checkout pending banner */}
      {checkoutPending && plan === 'free' && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <Loader2 className="h-5 w-5 shrink-0 text-blue-600 animate-spin" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">Procesando tu pago</p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Estamos confirmando tu suscripción con Mercado Pago. Esto puede demorar unos segundos.
            </p>
          </div>
        </div>
      )}

      {/* Past due warning */}
      {isPastDue && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="font-medium text-red-800 dark:text-red-200">Tu pago falló</p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Verificá tu método de pago en Mercado Pago para mantener tu plan activo.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://www.mercadopago.com.ar/subscriptions"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ir a Mercado Pago
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
      )}

      {/* Current plan summary — Advance */}
      {plan === 'advance' && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-2xl" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">
                Plan Actual
              </p>
              <h2 className="text-3xl font-bold tracking-tight">Advance</h2>
            </div>
            <span
              className={`${badgeStyle} text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 border`}
            >
              <span className={`w-2 h-2 rounded-full ${pulseColor} animate-pulse`} />
              {statusLabel}
            </span>
          </div>
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">
                {billingCycle === 'yearly' ? 'Renovación anual' : 'Renovación automática'}
              </span>
              {currentPeriodEnd && (
                <span className="font-medium">
                  {new Date(currentPeriodEnd).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
            <div className="h-px bg-gray-700" />
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">Proyectos Activos</span>
                  <span className="font-medium">{currentProjects} / 20</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min(((currentProjects ?? 0) / 20) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">Usuarios</span>
                  <span className="font-medium">
                    {currentSeats} / {maxSeats ?? '∞'}
                  </span>
                </div>
                {maxSeats && (
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${Math.min(((currentSeats ?? 0) / maxSeats) * 100, 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          {actionError && (
            <p className="text-sm text-red-400 mt-3 relative z-10">{actionError}</p>
          )}
          <div className="mt-6 pt-4 border-t border-gray-700 flex gap-3">
            <button
              type="button"
              className="flex-1 bg-white/10 hover:bg-white/20 transition-colors py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 text-white flex items-center justify-center gap-2"
              onClick={handlePauseResume}
              disabled={actionLoading !== null}
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4" />
                  {actionLoading === 'resume' ? 'Procesando...' : 'Reactivar'}
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  {actionLoading === 'pause' ? 'Procesando...' : 'Pausar'}
                </>
              )}
            </button>
          </div>

          {/* Danger zone — Cancel */}
          <div className="mt-4 pt-4 border-t border-gray-700/50 relative z-10">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50 flex items-center gap-1"
                  disabled={actionLoading !== null}
                >
                  <XCircle className="h-3 w-3" />
                  Cancelar suscripción
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cancelar suscripción?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tu plan volverá a Free inmediatamente. Perderás acceso a reportes,
                    administración, y se reducirá el límite a 1 proyecto y 1 usuario.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {actionLoading === 'cancel' ? 'Cancelando...' : 'Sí, cancelar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Current plan summary — Enterprise */}
      {plan === 'enterprise' && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-2xl" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">
                Plan Actual
              </p>
              <h2 className="text-3xl font-bold tracking-tight">Enterprise</h2>
            </div>
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ACTIVO
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-gray-300 text-sm">
              Proyectos ilimitados · Usuarios ilimitados · Soporte prioritario
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-700">
            <p className="text-gray-400 text-sm">Para cambios en tu plan, contactá a soporte.</p>
          </div>
        </div>
      )}

      {/* Pricing cards */}
      {plan !== 'enterprise' && (
        <>
          <div className="flex items-center justify-between pt-2">
            <h3 className="text-xl font-bold">Planes Disponibles</h3>
          </div>

          {isFreePlan && (
            <div className="flex items-center justify-center gap-4">
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

          <div className="space-y-4 md:grid md:grid-cols-3 md:gap-6 md:space-y-0">
            {/* Free */}
            <div
              className={`rounded-xl border bg-card p-5 shadow-sm transition-transform active:scale-[0.99] ${
                isFreePlan ? 'border-primary' : 'border-border'
              }`}
            >
              <div className="mb-3">
                <h4 className="text-lg font-bold">Free</h4>
                <span className="text-xl font-bold text-muted-foreground">
                  $0<span className="text-xs font-normal">/mes</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Para empezar</p>
              <ul className="space-y-2 mb-4">
                {PLAN_FEATURES.free.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {isFreePlan && (
                <Button variant="outline" className="w-full" disabled>
                  Plan actual
                </Button>
              )}
            </div>

            {/* Advance */}
            <div
              className={`rounded-xl p-5 shadow-sm relative overflow-hidden transition-transform active:scale-[0.99] ${
                plan === 'advance'
                  ? 'border-2 border-primary/30 bg-card'
                  : 'border-2 border-primary/20 bg-card'
              }`}
            >
              {plan === 'advance' && (
                <div className="absolute top-0 right-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                  PLAN ACTUAL
                </div>
              )}
              <div className="mb-3">
                <h4
                  className={`text-lg font-bold flex items-center gap-2 ${
                    plan === 'advance' ? 'text-primary' : ''
                  }`}
                >
                  Advance
                  <Zap className="h-4 w-4 text-amber-500" />
                </h4>
                <span className="text-xl font-bold">
                  {formatARS(ADVANCE_PRICING[billingOption].base)}
                  <span className="text-xs font-normal text-muted-foreground">
                    /{billingOption === 'monthly' ? 'mes' : 'año'}
                  </span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Para equipos en crecimiento</p>
              <p className="text-xs text-muted-foreground mb-4">
                + {formatARS(ADVANCE_PRICING[billingOption].seat)}/usuario
                {billingOption === 'monthly' ? '/mes' : '/año'}
              </p>
              <ul className="space-y-2 mb-4">
                {PLAN_FEATURES.advance.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {isFreePlan && (
                <div>
                  <div className="mb-4">
                    <label className="text-sm font-medium">Usuarios: {seatCount}</label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={seatCount}
                      onChange={(e) => setSeatCount(Number(e.target.value))}
                      className="mt-1 w-full"
                    />
                    <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base</span>
                        <span>{formatARS(ADVANCE_PRICING[billingOption].base)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {seatCount} usuario{seatCount > 1 ? 's' : ''} x{' '}
                          {formatARS(ADVANCE_PRICING[billingOption].seat)}
                        </span>
                        <span>
                          {formatARS(ADVANCE_PRICING[billingOption].seat * seatCount)}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between border-t pt-1 font-medium">
                        <span>Total</span>
                        <span>
                          {formatARS(
                            ADVANCE_PRICING[billingOption].base +
                              ADVANCE_PRICING[billingOption].seat * seatCount
                          )}
                          /{billingOption === 'monthly' ? 'mes' : 'año'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full" onClick={handleUpgrade} disabled={isRedirecting}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {isRedirecting ? 'Redirigiendo a Mercado Pago...' : 'Elegir plan'}
                  </Button>
                  {upgradeError && (
                    <p className="mt-2 text-sm text-red-600">{upgradeError}</p>
                  )}
                </div>
              )}
              {plan === 'advance' && (
                <Button
                  variant="outline"
                  className="w-full bg-muted/50 text-muted-foreground"
                  disabled
                >
                  Plan Seleccionado
                </Button>
              )}
            </div>

            {/* Enterprise */}
            <div className="bg-gradient-to-b from-gray-900 to-gray-800 dark:from-gray-800 dark:to-black rounded-xl p-6 text-white shadow-xl">
              <div className="mb-1">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-400" />
                  Enterprise
                </h4>
                <span className="text-xl font-bold text-white">Personalizado</span>
              </div>
              <p className="text-sm text-gray-300 mb-5">Para grandes organizaciones</p>
              <div className="space-y-3 mb-6">
                {PLAN_FEATURES.enterprise.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-gray-200">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30"
                asChild
              >
                <a href="mailto:soporte@agentect.com">Contactanos</a>
              </Button>
              <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> Procesado seguro con Mercado Pago
              </p>
            </div>
          </div>
        </>
      )}

      {/* FAQ Section */}
      <section className="pt-4">
        <h3 className="text-lg font-bold mb-3">Preguntas Frecuentes</h3>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl bg-card p-4 shadow-sm border border-border"
            >
              <summary className="flex justify-between items-center font-medium cursor-pointer text-sm [&::-webkit-details-marker]:hidden list-none">
                <span>{item.question}</span>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180 shrink-0 ml-2" />
              </summary>
              <p className="text-muted-foreground mt-3 text-sm">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/(dashboard)/settings/billing/page.tsx
git commit -m "feat: rewrite billing page with Mercado Pago, custom subscription management, and ARS pricing"
```

---

### Task 2.6: Actualizar CSP y landing page

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/app/(marketing)/page.tsx`

**Step 1: Actualizar CSP en next.config.ts**

Reemplazar dominios Stripe por Mercado Pago:

- Línea 7 `script-src`: `https://js.stripe.com` → `https://sdk.mercadopago.com`
- Línea 11 `connect-src`: `https://api.stripe.com` → `https://api.mercadopago.com https://www.mercadopago.com.ar`
- Línea 12 `frame-src`: `https://js.stripe.com https://hooks.stripe.com` → `https://www.mercadopago.com.ar https://mercadopago.com.ar`

**Step 2: Actualizar landing page**

En `apps/web/app/(marketing)/page.tsx`:

1. Línea 432: `Procesado seguro con Stripe` → `Procesado seguro con Mercado Pago`
2. Línea ~392: `US$30` → `$30.000` (o el equivalente ARS)
3. Línea ~396: `+ US$5/usuario/mes` → `+ $5.000/usuario/mes`

**Step 3: Commit**

```bash
git add apps/web/next.config.ts apps/web/app/\(marketing\)/page.tsx
git commit -m "fix: update CSP headers and landing page pricing for Mercado Pago"
```

---

### Task 2.7: Smoke test end-to-end

**Step 1: Verificar build**

Run:
```bash
npx turbo build --filter=web
```
Expected: SUCCESS

**Step 2: Test del flujo de checkout**

1. `npm run dev`
2. Abrir `/settings/billing` con usuario free
3. Seleccionar plan Advance, 3 usuarios, mensual
4. Click "Elegir plan" → debe redirigir a Mercado Pago
5. Completar pago con tarjeta de test: `5031 7557 3453 0604`, nombre "APRO"
6. Verificar redirect a `/settings/billing?checkout=pending`
7. Verificar que el banner "Procesando tu pago" aparece
8. Verificar que el plan cambia a Advance después de unos segundos

**Step 3: Test de pausa/reactivación**

1. Click "Pausar" → verificar badge cambia a PAUSADO (ámbar)
2. Click "Reactivar" → verificar badge vuelve a ACTIVO (verde)

**Step 4: Test de cancelación**

1. Click "Cancelar suscripción" → debe abrir AlertDialog
2. Confirmar → verificar plan vuelve a Free

---

## Phase 3: Cutover y Cleanup

> Solo ejecutar después de verificar que Phase 2 funciona en producción.

### Task 3.1: Eliminar código Stripe

**Files:**
- Delete: `apps/web/lib/stripe/client.ts`
- Delete: `apps/web/lib/stripe/checkout.ts`
- Delete: `apps/web/app/api/webhooks/stripe/route.ts`
- Delete: `apps/web/app/api/billing/portal-session/route.ts`

**Step 1: Desinstalar dependencia**

Run:
```bash
cd apps/web && npm uninstall stripe
```

**Step 2: Eliminar archivos**

Run:
```bash
rm -rf apps/web/lib/stripe/
rm -rf apps/web/app/api/webhooks/stripe/
rm -rf apps/web/app/api/billing/portal-session/
```

**Step 3: Remover env vars de Stripe de env.ts**

En `apps/web/lib/env.ts`, eliminar líneas 13-19 (las 7 vars de Stripe).

**Step 4: Buscar referencias huérfanas**

Run:
```bash
grep -r "stripe\|Stripe\|STRIPE" apps/web/lib/ apps/web/app/ --include="*.ts" --include="*.tsx" -l
```
Expected: Ningún resultado

**Step 5: Verificar build**

Run:
```bash
npx turbo build
```
Expected: SUCCESS

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove all Stripe code, SDK, and env vars"
```

---

### Task 3.2: DB migration — eliminar columnas legacy

**Files:**
- Create: `supabase/migrations/20260227120000_drop_stripe_columns.sql`

> Solo ejecutar después de confirmar que no hay suscripciones activas con stripe_subscription_id.

**Step 1: Verificar precondición**

```sql
SELECT count(*) FROM organizations
WHERE stripe_subscription_id IS NOT NULL
  AND payment_subscription_id IS NULL;
```
Expected: 0

**Step 2: Crear migración**

```sql
ALTER TABLE organizations DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE organizations DROP COLUMN IF EXISTS stripe_subscription_id;
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260227120000_drop_stripe_columns.sql
git commit -m "chore: drop legacy stripe columns from organizations"
```

---

### Task 3.3: Actualizar types — remover campos legacy

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Eliminar campos stripe de Organization**

Eliminar:
```typescript
stripe_customer_id: string | null;
stripe_subscription_id: string | null;
```

**Step 2: Verificar build**

Run:
```bash
npx turbo build
```

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "chore: remove stripe fields from Organization type"
```

---

### Task 3.4: Actualizar documentación

**Files:**
- Modify: `docs/CONTEXT.md`

**Step 1: Actualizar CONTEXT.md**

- Sección 2 (Stack): `Payments | Mercado Pago | mercadopago 2.x | PreApproval subscriptions + webhooks`
- Sección 7 (API Routes): Agregar `cancel`, `pause`, `update-seats`, `payments`. Quitar `portal-session`. Cambiar `webhooks/stripe` → `webhooks/mercadopago`
- Sección 11 (Env vars): Reemplazar 7 vars Stripe con `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`
- Sección 13 (Historial): Agregar punto 27: "Migración Stripe → Mercado Pago"
- Sección 14 (Deuda técnica): Quitar nota de Stripe webhooks locales

**Step 2: Commit**

```bash
git add docs/CONTEXT.md
git commit -m "docs: update CONTEXT.md for Mercado Pago migration"
```

---

## Resumen de Ejecución

| Phase | Tasks | Commits | Puede revertirse |
|-------|-------|---------|-----------------|
| **0** | 0.1 (setup externo) | 0 | N/A |
| **1** | 1.1–1.7 (infra aditiva) | 7 | Sí — borrar columnas y archivos nuevos |
| **2** | 2.1–2.7 (billing MP) | 7 | Sí — revertir a Stripe endpoints |
| **3** | 3.1–3.4 (cleanup) | 4 | No — Stripe eliminado |

**Total: ~1,200 LOC nuevas, ~800 LOC eliminadas, 18 commits.**
