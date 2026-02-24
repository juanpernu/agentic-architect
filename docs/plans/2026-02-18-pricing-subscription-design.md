# Design: Pricing & Subscription System

## Overview

Sistema de pricing con 3 tiers (Free, Advance, Enterprise), feature gating por plan, y cobro automático vía Stripe Checkout. Preparado para migración futura a Stripe Elements.

## Tiers

| | Free | Advance | Enterprise |
|---|---|---|---|
| **Precio** | Gratis | Base + $Y/seat (mensual o anual) | Contacto comercial |
| **Proyectos** | 1 | 20 | Ilimitado |
| **Comprobantes/proyecto** | 20 | Ilimitado | Ilimitado |
| **Usuarios** | 1 | Según seats comprados | Ilimitado |
| **Reportes** | No | Sí | Sí |
| **Soporte prioritario** | No | No | Sí |

- Advance: precio base + precio por seat. Ciclo mensual o anual (anual = 2 meses gratis).
- Enterprise: sin precio público, botón "Contactanos".

## Sección 1: Modelo de datos

Nuevos campos en la tabla `organizations` (no se crea tabla separada):

```sql
CREATE TYPE subscription_plan AS ENUM ('free', 'advance', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');

ALTER TABLE organizations ADD COLUMN plan subscription_plan DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN subscription_status subscription_status DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN stripe_subscription_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN max_seats INTEGER DEFAULT 1;
ALTER TABLE organizations ADD COLUMN billing_cycle TEXT; -- 'monthly' | 'yearly'
ALTER TABLE organizations ADD COLUMN current_period_end TIMESTAMPTZ;
```

Límites de plan como constantes en código (`packages/shared/src/plans.ts`):

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
    maxSeats: null, // dinámico, según seats comprados (org.max_seats)
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
```

## Sección 2: Integración Stripe

### Enfoque: Stripe Checkout + Webhooks

Stripe maneja todo el billing. La DB solo guarda el estado resultante. Webhooks actualizan el estado en Supabase.

### Pasos manuales en Stripe Dashboard

1. **Crear Products y Prices:**

| Product | Tipo | Descripción |
|---------|------|-------------|
| Agentect Advance — Base mensual | recurring/month | Cargo base mensual |
| Agentect Advance — Base anual | recurring/year | Cargo base anual (2 meses gratis) |
| Agentect Advance — Seat mensual | recurring/month | Por usuario adicional, mensual |
| Agentect Advance — Seat anual | recurring/year | Por usuario adicional, anual |

2. **Configurar Customer Portal** en dashboard.stripe.com/settings/billing/portal:
   - Habilitar "Cancel subscription"
   - Habilitar "Update payment method"
   - Return URL: `https://dominio/settings/billing`

3. **Crear Webhook endpoint** en Developers → Webhooks:
   - URL: `https://dominio/api/webhooks/stripe`
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.trial_will_end`

4. **Copiar keys** a env vars:
   - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_ADVANCE_MONTHLY_BASE_PRICE_ID`, `STRIPE_ADVANCE_YEARLY_BASE_PRICE_ID`
   - `STRIPE_ADVANCE_MONTHLY_SEAT_PRICE_ID`, `STRIPE_ADVANCE_YEARLY_SEAT_PRICE_ID`

### Flujo de upgrade

```
Usuario clickea "Elegir plan" en /settings/billing
  → POST /api/billing/checkout-session
    → stripe.checkout.sessions.create({ mode: 'subscription', line_items: [base + seats], metadata: { organization_id } })
    → Retorna session.url
  → Redirect a Stripe Checkout
  → Usuario paga
  → Stripe envía webhook checkout.session.completed
    → POST /api/webhooks/stripe
      → UPDATE organizations SET plan='advance', stripe_customer_id, stripe_subscription_id, max_seats, billing_cycle, current_period_end, subscription_status='active'
```

### Webhooks

| Evento | Acción |
|--------|--------|
| `checkout.session.completed` | Activar plan, guardar IDs de Stripe |
| `customer.subscription.updated` | Actualizar plan/seats/período |
| `customer.subscription.deleted` | Downgrade a free, limpiar IDs |
| `invoice.paid` | Marcar subscription_status = 'active' |
| `invoice.payment_failed` | Marcar subscription_status = 'past_due' |

### Customer Portal

Para gestión self-service (cancelar, cambiar método de pago, ver facturas):

```ts
const portalSession = await stripe.billingPortal.sessions.create({
  customer: org.stripe_customer_id,
  return_url: `${baseUrl}/settings/billing`,
});
// redirect to portalSession.url
```

### Preparación para Stripe Elements

El checkout se encapsula en `lib/stripe/checkout.ts`. Para migrar a Elements:
1. Reemplazar `checkout.ts` por `payment-intent.ts` (crea `SetupIntent`)
2. Agregar `<PaymentForm />` con `@stripe/react-stripe-js`
3. Agregar `<Elements>` provider con `stripePromise`
4. Webhooks, gating, y portal **no cambian**

Comentarios `// FUTURE: Elements migration` marcan los puntos de reemplazo.

## Sección 3: Feature Gating

### Server-side: `checkPlanLimit()`

```ts
// lib/plan-guard.ts
export async function checkPlanLimit(
  orgId: string,
  resource: 'project' | 'receipt' | 'user' | 'reports'
): Promise<{ allowed: true } | { allowed: false; reason: string }>
```

| Recurso | Query | Check |
|---------|-------|-------|
| `project` | `count(*) FROM projects WHERE org_id` | count < maxProjects |
| `receipt` | `count(*) FROM receipts WHERE project_id` | count < maxReceiptsPerProject |
| `user` | `count(*) FROM users WHERE org_id AND is_active` | count < org.max_seats (Advance) o maxSeats (otros) |
| `reports` | — | PLAN_LIMITS[plan].reports === true |

### Enforcement en API routes

Se agrega `checkPlanLimit()` antes de crear recursos:
- `POST /api/projects` → guard 'project'
- `POST /api/receipts` → guard 'receipt'
- `POST /api/invitations` → guard 'user'
- `GET /api/reports/by-cost-center` → guard 'reports'

Retorna 403 con `{ error: reason }` si no está permitido.

### Client-side: `usePlan()` hook

```ts
// lib/use-plan.ts
// Expone: plan, limits, canCreate(resource), isFreePlan
// Se alimenta de GET /api/billing/plan
// Retorna: { plan, max_seats, current_seats, current_projects, subscription_status }
```

### UI: UpgradeBanner

Componente reutilizable que aparece cuando se alcanza un límite:

```tsx
<UpgradeBanner message="Alcanzaste el límite de proyectos en tu plan" />
// → alert con ícono + texto + link a /settings/billing
```

### Sidebar

Link de Reportes solo visible si `isAdminOrSupervisor && plan !== 'free'`.

## Sección 4: UI — Página de Billing

### Nueva pestaña: `/settings/billing` (solo admins)

3 estados según plan actual:

### Plan Free
- Muestra las 3 pricing cards (Free, Advance, Enterprise)
- Advance: toggle mensual/anual + selector de seats
- "Elegir plan" → Stripe Checkout
- "Contactar" en Enterprise → WhatsApp o formulario

### Plan Advance
- Resumen: plan, seats usados/totales, próxima facturación
- "Gestionar suscripción" → Stripe Customer Portal
- "Agregar seats" → Portal o nueva checkout session
- Banner rojo si subscription_status === 'past_due'

### Plan Enterprise
- Resumen de features
- "Para cambios, contactá a soporte"
- Se gestiona manualmente

### Nuevos API routes

| Route | Método | Propósito |
|-------|--------|-----------|
| `/api/billing/plan` | GET | Plan actual + usage + limits |
| `/api/billing/checkout-session` | POST | Crea Stripe Checkout Session |
| `/api/billing/portal-session` | POST | Crea Stripe Portal Session |
| `/api/webhooks/stripe` | POST | Recibe eventos de Stripe |

## Decisiones clave

1. **Subscription state en organizations** (no tabla separada) — relación 1:1, Stripe guarda el historial
2. **Límites en código** (no en DB) — se cambian sin migración
3. **Checkout Session** (no Elements) — menos código, Stripe maneja PCI compliance total
4. **Customer Portal** — self-service sin código custom para cancelar/cambiar método de pago
5. **Enterprise manual** — sin checkout, se gestiona por contacto comercial
6. **Preparación Elements** — módulo aislado + comentarios FUTURE en puntos de reemplazo
