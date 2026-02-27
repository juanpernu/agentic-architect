# Agentect — Full Repository Context

> Documento de contexto completo para que un main planner pueda retomar el proyecto sin conocimiento previo.
> Ultima actualizacion: 2026-02-27

---

## 1. Que es Agentect

**Agentect** es un SaaS de gestion de obras de construccion orientado a estudios de arquitectura argentinos. Permite:

- Gestionar **proyectos de obra** (casas, edificios, refacciones)
- Cargar **comprobantes** (facturas, tiques) y extraer datos automaticamente con **Claude Vision AI**
- Armar **presupuestos** con un editor tipo spreadsheet, con rubros, items, autosave y versionado
- Ver **reportes** de gastos agrupados por proyecto y rubro
- Gestionar **usuarios** con 3 roles (admin, supervisor, architect) y **suscripciones** (Free, Advance, Enterprise)
- Asociar **cuentas bancarias** y **proveedores** a comprobantes
- Clasificar comprobantes como **Ingreso** o **Egreso**, creando automaticamente el registro financiero correspondiente

El mercado target es Argentina. La interfaz esta en **espanol argentino**, la moneda es **ARS**, y los comprobantes fiscales siguen normativa AFIP.

---

## 2. Stack Tecnologico

| Capa | Tecnologia | Version | Notas |
|------|-----------|---------|-------|
| **Monorepo** | npm workspaces + Turbo | npm 11.6.2, turbo 2 | `apps/*` + `packages/*` |
| **Frontend** | Next.js (App Router) | 16.1.6 | Turbopack en dev |
| **React** | React | 19.2.3 | |
| **Lenguaje** | TypeScript | 5.x | Strict mode |
| **Styling** | Tailwind CSS | 4.x | CSS variables, tw-animate-css |
| **Componentes** | Shadcn/ui (new-york style) | Radix UI 1.4.3 | Customizados en `components/ui/` |
| **Iconos** | Lucide React | 0.564.0 | |
| **Auth** | Clerk | @clerk/nextjs 6.37.4 | Middleware + webhooks |
| **Database** | Supabase (PostgreSQL) | @supabase/supabase-js 2.x | Service role key (admin) |
| **AI** | Anthropic SDK | 0.39.0 | Claude Sonnet 4.5 para vision |
| **Payments** | Stripe | 20.3.1 | Checkout sessions + webhooks |
| **Charts** | Recharts | 3.7.0 | |
| **Data Fetching** | SWR | 2.3.4 | Client-side |
| **Validation** | Zod | 4.3.6 | Client + API schemas |
| **Toasts** | Sileo | 0.1.4 | Top-right, auto-dismiss |
| **Webhook verification** | Svix | 1.85.0 | Para Clerk webhooks |
| **Deploy** | Vercel | | Proyecto: prj_euCgIveHxc3eln8eFwwQsYAts8uI |

---

## 3. Estructura del Monorepo

```
agentic-architect/
├── apps/
│   └── web/                    # Next.js 16 app
│       ├── app/                # App Router
│       │   ├── (auth)/         # Route group: sign-in, sign-up
│       │   ├── (dashboard)/    # Route group: todas las paginas autenticadas
│       │   │   ├── page.tsx            # Dashboard (/)
│       │   │   ├── projects/           # /projects, /projects/[id]
│       │   │   ├── receipts/           # /receipts, /receipts/[id]
│       │   │   ├── upload/             # /upload (3 steps)
│       │   │   ├── budgets/            # /budgets, /budgets/[id], /budgets/[id]/history
│       │   │   ├── administration/     # /administration (resumen, ingresos, egresos)
│       │   │   ├── reports/            # /reports
│       │   │   └── settings/           # /settings/{general,users,banks,billing,administration}
│       │   └── api/            # API routes (ver seccion 7)
│       ├── components/         # Componentes React
│       │   ├── ui/             # Shadcn/ui base components (25+)
│       │   ├── dashboard/      # KPIs, charts, recent receipts, create-project-card
│       │   ├── administration/ # cashflow-chart, balance-by-project-table, vs-budget-table
│       │   ├── reports/        # Chart de reportes
│       │   └── *.tsx           # Feature components (sidebar, budget-table, receipt-review, etc.)
│       ├── lib/                # Utilidades y hooks
│       │   ├── schemas/        # Zod schemas (9 archivos)
│       │   ├── stripe/         # Stripe client + checkout
│       │   ├── auth.ts         # getAuthContext() — core auth
│       │   ├── supabase.ts     # DB access + storage URLs
│       │   ├── plan-guard.ts   # checkPlanLimit()
│       │   ├── fetcher.ts      # SWR fetcher
│       │   ├── format.ts       # formatCurrency (es-AR)
│       │   ├── date-utils.ts   # Argentina TZ date formatting (relative days, compact)
│       │   ├── avatar-utils.ts # Deterministic avatar colors + initials
│       │   ├── use-current-user.ts  # Hook: role, fullName, isAdmin
│       │   ├── use-plan.ts     # Hook: plan limits, canCreate
│       │   ├── use-autosave.ts # Hook: budget autosave con debounce
│       │   └── ...
│       ├── middleware.ts       # Clerk auth middleware
│       └── next.config.ts      # transpilePackages, images
├── packages/
│   ├── shared/                 # @architech/shared
│   │   └── src/
│   │       ├── types.ts        # Todas las interfaces TypeScript
│   │       ├── enums.ts        # UserRole, ProjectStatus, etc.
│   │       ├── plans.ts        # PLAN_LIMITS (free/advance/enterprise)
│   │       └── index.ts        # Re-exports
│   ├── ai/                     # @architech/ai
│   │   └── src/
│   │       ├── extract.ts      # extractReceiptData() — Claude Vision
│   │       ├── prompt.ts       # EXTRACTION_PROMPT (comprobantes argentinos)
│   │       └── __tests__/      # Tests
│   └── db/                     # @architech/db
│       └── src/
│           ├── client.ts       # getSupabaseAdmin(), getSupabaseClient()
│           └── index.ts
├── supabase/
│   └── migrations/             # SQL migrations
├── docs/                       # Documentacion y planes
│   ├── plans/                  # 27 documentos de design + implementation
│   ├── agent-training/         # Training cases para AI extraction
│   ├── flowchart/              # Diagramas Mermaid + PDF generator
│   └── designer-prompt.md      # Prompt para agente disenador
├── package.json                # Root monorepo config
└── turbo.json                  # Build orchestration
```

---

## 4. Modelo de Datos

### 4.1 Entidades principales

```
organizations (multi-tenant root)
├── users (clerk_user_id, role, is_active)
├── projects (name, address, status, color, architect_id)
│   ├── receipts (vendor, total, date, type, ai_confidence, category)
│   │   └── receipt_items (description, qty, unit_price, subtotal)
│   ├── budgets (status: draft|published, snapshot JSON)
│   │   ├── rubros (name, color, sort_order)
│   │   └── budget_versions (version_number, snapshot, total)
│   ├── incomes (amount, date, income_type_id?, description, created_by, receipt_id?)
│   └── expenses (amount, date, expense_type_id?, rubro_id?, receipt_id?, paid_by?, description, created_by)
├── income_types (name, is_active) — seeded on org creation
├── expense_types (name, is_active)
├── suppliers (name, cuit, fiscal_condition, address)
└── bank_accounts (name, bank_name, cbu, alias, currency)
```

### 4.2 Campos clave de Organization

```typescript
{
  plan: 'free' | 'advance' | 'enterprise',
  subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing',
  stripe_customer_id: string | null,
  stripe_subscription_id: string | null,
  max_seats: number,  // dinamico para Advance (viene de Stripe)
  logo_url: string | null,
  // address fields, phone, email, social links...
}
```

### 4.3 Roles y permisos

| Funcionalidad | admin | supervisor | architect |
|---------------|-------|------------|-----------|
| Dashboard | Todo | Todo | Solo sus proyectos |
| Proyectos — crear/editar | Si | Si | No |
| Comprobantes — cargar | Si | Si | Si |
| Presupuestos — editar | Si | Si | No (read-only) |
| Administracion — CRUD ingresos/egresos | Si | Si | No |
| Administracion — tipos ingreso/egreso | Si | No | No |
| Reportes | Si | Si | No |
| Settings — General | Si | Si | Si |
| Settings — Usuarios | Si | No | No |
| Settings — Bancos | Si | Si | No |
| Settings — Administracion | Si | No | No |
| Settings — Billing | Si | No | No |
| Sidebar — Administracion | Visible | Visible | Oculto |
| Sidebar — Reportes | Visible | Visible | Oculto |

### 4.4 Limites por plan

```typescript
PLAN_LIMITS = {
  free: { maxProjects: 1, maxReceiptsPerProject: 20, maxSeats: 1, reports: false, administration: false },
  advance: { maxProjects: 20, maxReceiptsPerProject: Infinity, maxSeats: null, reports: true, administration: true },
  enterprise: { maxProjects: Infinity, maxReceiptsPerProject: Infinity, maxSeats: Infinity, reports: true, administration: true },
}
```

### 4.5 Budget Snapshot (JSON en DB)

```typescript
{
  sections: [{
    rubro_id: string,
    rubro_name: string,
    is_additional: boolean,
    subtotal?: number,    // override manual (si undefined, se calcula de items)
    cost?: number,        // override manual
    items: [{
      description: string,
      unit: string,       // "gl", "m2", "ml", etc.
      quantity: number,
      cost: number,       // costo interno
      subtotal: number,   // precio al cliente
    }]
  }]
}
```

---

## 5. Autenticacion y Multi-tenancy

### Flow de auth

1. **Clerk middleware** protege todas las rutas excepto `/sign-in`, `/sign-up`, `/api/webhooks`
2. **`getAuthContext()`** en cada API route:
   - Fast path: lee `db_user_id` y `role` de Clerk session metadata
   - Slow path: busca en DB por `clerk_user_id` + `organization_id`
   - Auto-bootstrap: si no existe, crea el usuario (primer usuario = admin, resto = architect)
3. **Clerk webhook** sincroniza usuarios y orgs a Supabase, setea metadata en Clerk
4. **`is_active` check**: usuarios desactivados reciben 403

### RLS (Row Level Security)

- Todas las tablas usan RLS con helpers:
  - `public.get_org_id()` — aislamiento por organizacion
  - `public.get_user_role()` — enforcement de roles a nivel DB
- La app usa **service role key** (admin bypass) en el server, pero las policies sirven como safety net

### Storage

- **Bucket `receipts`**: imagenes de comprobantes, path: `{orgId}/{uuid}.{ext}`
- **Bucket `org-assets`**: logos de organizacion, path: `org-logos/{orgId}/{uuid}.{ext}`
- Ambos buckets son publicos para lectura. Upload restringido por auth.

---

## 6. AI Extraction

### Flujo completo

1. Usuario sube imagen (drag-drop, file picker, o camara mobile)
2. Si formato HEIC (iOS), se convierte a JPEG via canvas
3. `POST /api/receipts/upload` → Supabase Storage → `image_url` + `storage_path`
4. Imagen se convierte a base64 → `POST /api/receipts/extract`
5. Backend llama a Claude Sonnet 4.5 Vision con `EXTRACTION_PROMPT`
6. Respuesta JSON se parsea con `parseExtractionResponse()`
7. Usuario revisa en `ReceiptReview` component — puede editar todos los campos
8. Usuario selecciona **categoria** (Ingreso/Egreso) — toggle pill-style, default "Egreso"
9. Al confirmar: `POST /api/receipts` crea receipt + items + upsert supplier + crea expense o income automaticamente

### Extraction prompt highlights

- Especializado en comprobantes fiscales argentinos (facturas, tiques, notas de credito)
- Regla critica: emisor (arriba) vs receptor (despues de metadata) — solo extraer emisor
- Numeros en parentesis (21), (10.5) = alicuota IVA, NUNCA cantidad
- Si qty/unit_price no son visibles, default qty=1, unit_price=IMPORTE
- CUIT lenient: normaliza formato, descarta invalidos en vez de bloquear
- Confidence: 0-1, determina badge visual (verde >0.85, amarillo 0.6-0.85, rojo <0.6)

### Training cases

- `docs/agent-training/2026-02-16-tique-factura-a-ferreteria.md` — primer caso documentado

---

## 7. API Routes (completo)

### Users & Auth

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/me` | GET | Any | Devuelve role del usuario actual |
| `/api/users` | GET | Admin | Lista usuarios de la org |
| `/api/users/[id]/role` | PATCH | Admin | Cambiar rol |
| `/api/users/[id]/status` | PATCH | Admin | Activar/desactivar |
| `/api/invitations` | GET, POST | Admin | Clerk invitations, valida plan limits |

### Organization

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/organization` | GET, PATCH | Any/Admin | Get org / Update org fields |
| `/api/organization/logo` | POST | Admin | Upload logo a Supabase |
| `/api/org-members` | GET | !Architect | Lista usuarios activos de la org (id, full_name) — para dropdown "Quien pago" |

### Projects

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/projects` | GET, POST | Any / !Architect | Lista (architect solo asignados) / Crear (plan limit) |
| `/api/projects/[id]` | GET, PATCH, DELETE | Any / !Architect / Admin | |

### Receipts

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/receipts` | GET, POST | Any | Lista / Crear (con items + supplier upsert + expense/income auto-creation) |
| `/api/receipts/[id]` | GET, PATCH, DELETE | Any / !Architect / Admin | Detalle con signed URL |
| `/api/receipts/upload` | POST | Any | Upload imagen (max 10MB) |
| `/api/receipts/extract` | POST | Any | AI extraction con Claude Vision |

### Budgets

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/budgets` | GET, POST | Any / !Architect | Lista / Crear (1 por proyecto) |
| `/api/budgets/[id]` | GET, PATCH, PUT, DELETE | Various | GET: detalle, PATCH: autosave/revert, PUT: publish version |
| `/api/budgets/[id]/versions` | GET | Any | Historial de versiones |

### Rubros

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/rubros` | GET, POST | Any / !Architect | Lista (filtro budget_id) / Crear (auto sort_order) |
| `/api/rubros/[id]` | PATCH, DELETE | !Architect | Editar / Eliminar (solo si sin receipts) |

### Bank Accounts

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/bank-accounts` | GET, POST | Any / Admin | Lista activas / Crear |
| `/api/bank-accounts/[id]` | PATCH, DELETE | Admin | Update / Soft-delete (is_active=false) |

### Administration (Advance+ plans)

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/incomes` | GET, POST | !Architect | Lista (paginada, filtros) / Crear |
| `/api/incomes/[id]` | GET, PATCH, DELETE | !Architect | Detalle / Editar / Eliminar |
| `/api/expenses` | GET, POST | !Architect | Lista (paginada, filtros) / Crear |
| `/api/expenses/[id]` | GET, PATCH, DELETE | !Architect | Detalle / Editar / Soft-delete |
| `/api/income-types` | GET, POST | Any / Admin | Lista activos / Crear |
| `/api/income-types/[id]` | PATCH, DELETE | Admin | Editar / Soft-delete |
| `/api/expense-types` | GET, POST | Any / Admin | Lista activos / Crear |
| `/api/expense-types/[id]` | PATCH, DELETE | Admin | Editar / Soft-delete |
| `/api/administration/summary` | GET | !Architect | Totals: income, expense, balance (filtros: year, projectId) |
| `/api/administration/cashflow` | GET | !Architect | 12 meses: income, expense, balance por mes |
| `/api/administration/vs-budget` | GET | !Architect | Presupuestado vs real por rubro (requiere projectId) |

### Dashboard & Reports

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/dashboard/stats` | GET | Any | KPIs: active_projects, monthly_spend, etc. |
| `/api/dashboard/spend-by-project` | GET | Any | Bar chart data |
| `/api/dashboard/spend-trend` | GET | Any | Line chart — `?granularity=month` (6 meses) o `week` (28 dias, por dia) |
| `/api/reports/by-rubro` | GET | Any | Gasto por rubro, filtros: date_from, date_to, project_id |

### Billing

| Endpoint | Methods | Auth | Notes |
|----------|---------|------|-------|
| `/api/billing/plan` | GET | Any | Plan actual + usage + limits |
| `/api/billing/checkout-session` | POST | Admin | Crear Stripe checkout |
| `/api/billing/portal-session` | POST | Admin | Stripe billing portal |

### Webhooks

| Endpoint | Methods | Notes |
|----------|---------|-------|
| `/api/webhooks/clerk` | POST | user.created/updated, orgMembership, org.created |
| `/api/webhooks/stripe` | POST | checkout.completed, subscription.updated/deleted, invoice.paid/failed |

---

## 8. Componentes Clave

### Layout

- **`sidebar.tsx`** — Exporta `navItems` (con tipado `UserRole[]`), `SidebarContent` (nav links + user footer reutilizable) y `Sidebar` (desktop aside `hidden md:flex md:w-64 md:fixed`). Props: `onNavigate?: () => void`, `showUserFooter?: boolean`. Role gates, UserButton de Clerk + badge de rol, `aria-current="page"` en links activos.
- **`mobile-header.tsx`** — Header mobile sticky (`md:hidden`): hamburger button + titulo dinamico (mapeado de `navItems` + `EXTRA_TITLES`) + UserButton. Abre Shadcn Sheet (`side="left"`) con `SidebarContent`. Auto-cierra al navegar. Accesibilidad: `aria-expanded`, `aria-haspopup="dialog"`, `VisuallyHidden` SheetTitle.
- **Dashboard layout** — `md:pl-64 pt-[52px] md:pt-0` para compensar sidebar (desktop) y mobile header

### Feature Components

| Componente | Archivo | Descripcion |
|------------|---------|-------------|
| ReceiptReview | `receipt-review.tsx` | Paso 3 del upload: image + category toggle (Ingreso/Egreso) + Nro. Comprobante + editable fields + "Quien pago" (expenses) + items accordion |
| BudgetTable | `budget-table.tsx` | Editor spreadsheet: sections/items editables, autosave, publish, cost toggle |
| CameraCapture | `camera-capture.tsx` | Overlay full-screen para captura mobile (environment/user facing) |
| ProjectFormDialog | `project-form-dialog.tsx` | Dialog crear/editar proyecto |
| CreateBudgetDialog | `create-budget-dialog.tsx` | Dialog crear presupuesto |
| SaveBudgetDialog | `save-budget-dialog.tsx` | Confirmacion de publicar version |
| InviteUserDialog | `invite-user-dialog.tsx` | Dialog invitar usuario (email + rol) |
| BankAccountFormDialog | `bank-account-form-dialog.tsx` | Dialog CRUD cuenta bancaria |
| OrgSettingsForm | `org-settings-form.tsx` | Form de config de organizacion |
| ExpenseFormDialog | `expense-form-dialog.tsx` | Dialog crear/editar egreso (project, type, rubro, receipt, amount) |
| IncomeFormDialog | `income-form-dialog.tsx` | Dialog crear/editar ingreso (project, type, amount) |
| UpgradeBanner | `upgrade-banner.tsx` | Banner cuando se alcanza un limite de plan |

### Dashboard Components

- `dashboard-kpis.tsx` — 3 KPI StatCards con footer links: Proyectos Activos (→ /projects), Gasto Mensual (→ /administration/expenses), Comprobantes Semanales (→ /administration/receipts)
- `recent-receipts.tsx` — Tabla de ultimos comprobantes
- `create-project-card.tsx` — CTA card para crear primer proyecto
- `spend-by-project-chart.tsx` — ProgressBarList de egresos por proyecto (query a `expenses` table)
- `spend-trend-chart.tsx` — Client component: Recharts LineChart + shadcn ChartContainer, toggle Semana (diario 28d) / Mes (mensual 6m), query a `expenses` table

### Administration Components

- `cashflow-chart.tsx` — Recharts LineChart: ingresos vs egresos mensual (azul/naranja)
- `balance-by-project-table.tsx` — Tabla de balance por proyecto (ingreso, egreso, saldo)
- `vs-budget-table.tsx` — Presupuestado vs ejecutado por rubro con barras de progreso y semaforo (verde <80%, ambar 80-100%, rojo >100%)

### UI Components (Shadcn customizados)

AlertDialog, Avatar, Badge, Button, Card (con CardAction), Chart (shadcn Recharts wrapper: ChartContainer, ChartTooltip, ChartTooltipContent), Collapsible, CurrencyInput, Dialog, DropdownMenu, EmptyState, Field/FieldGroup/FieldLabel, Input, KpiCard, Label, LoadingSkeleton, PageHeader, RouteError, Select, Separator, Sheet, Skeleton, StatCard (title, value, icon, badge, footer link), Switch, Table, Tabs, Textarea

---

## 9. Hooks y Utilidades

| Hook/Util | Archivo | Descripcion |
|-----------|---------|-------------|
| `useCurrentUser()` | `use-current-user.ts` | Role, fullName, isAdmin, isAdminOrSupervisor. Fast path via Clerk metadata, fallback a /api/me |
| `usePlan()` | `use-plan.ts` | Plan, limits, canCreateProject, canInviteUser, isFreePlan, isPastDue |
| `useAutosave()` | `use-autosave.ts` | Autosave con debounce 2s, status indicator, flush on unmount (keepalive), retry |
| `useFormValidation()` | `use-form-validation.ts` | Hook para validacion con Zod |
| `formatRelativeShort()` | `date-utils.ts` | "Hoy", "Ayer", "Hace 3d", "15/02" — Argentina TZ aware |
| `formatRelativeDay()` | `date-utils.ts` | "Hoy", "Ayer", "15 feb 2026" — para receipts |
| `getInitials()` | `avatar-utils.ts` | "Juan Perez" → "JP" — max 2 chars |
| `getAvatarColor()` | `avatar-utils.ts` | Hash-based deterministic color from 8-color palette |
| `getAuthContext()` | `auth.ts` | Server-side: extrae userId, orgId, role, dbUserId. Con cache is_active (60s TTL, max 500 entries) |
| `checkPlanLimit()` | `plan-guard.ts` | Verifica limites de plan para project/receipt/user/reports |
| `requireAdministrationAccess()` | `plan-guard.ts` | Guard: retorna 403 si org en plan free, null si permitido |
| `validateBody()` | `validate.ts` | Parsea request body con Zod schema, retorna 400 con field errors |
| `formatCurrency()` | `format.ts` | Intl.NumberFormat es-AR ARS. Compact: $1.2M, $50K |
| `fetcher` | `fetcher.ts` | SWR fetcher con error handling |
| `getDb()` | `supabase.ts` | Wrapper de getSupabaseAdmin() |
| `getSignedImageUrl()` | `supabase.ts` | Signed URLs para imagenes de receipts (1h TTL) |
| `getPublicFileUrl()` | `supabase.ts` | URLs publicas para storage |

---

## 10. Validation Schemas (Zod)

Todos en `apps/web/lib/schemas/`:

| Schema | Archivo | Uso |
|--------|---------|-----|
| `projectCreateSchema` / `projectUpdateSchema` | `project.ts` | API: crear/editar proyecto |
| `projectSchema` | `project.ts` | Form client-side |
| `receiptReviewSchema` | `receipt-review.ts` | Discriminated union en `category`: expense (requiere rubro + paidBy) / income |
| `budgetSnapshotSchema` | `budget.ts` | Validar snapshot JSON |
| `bankAccountCreateSchema` / `bankAccountUpdateSchema` | `bank-account.ts` | API: CRUD cuentas |
| `inviteCreateSchema` | `invite.ts` | API: invitar usuario |
| `organizationUpdateSchema` | `organization.ts` | API: actualizar org |
| `rubroCreateSchema` / `rubroUpdateSchema` | `rubro.ts` | API: CRUD rubros |
| `incomeCreateSchema` / `incomeUpdateSchema` | `administration.ts` | API: CRUD ingresos |
| `expenseCreateSchema` / `expenseUpdateSchema` | `administration.ts` | API: CRUD egresos |
| `incomeTypeCreateSchema` / `incomeTypeUpdateSchema` | `administration.ts` | API: CRUD tipos ingreso |
| `expenseTypeCreateSchema` / `expenseTypeUpdateSchema` | `administration.ts` | API: CRUD tipos egreso |

---

## 11. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Anthropic (AI)
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_ADVANCE_MONTHLY_BASE_PRICE_ID=
STRIPE_ADVANCE_MONTHLY_SEAT_PRICE_ID=
STRIPE_ADVANCE_YEARLY_BASE_PRICE_ID=
STRIPE_ADVANCE_YEARLY_SEAT_PRICE_ID=
```

---

## 12. Patrones de Desarrollo

### Convenios

- **Commits:** Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- **Idioma UI:** Espanol argentino (tuteo con "vos": Selecciona, Carga, Ingresa)
- **Idioma codigo:** Ingles
- **Branches:** Feature branches → PR → merge a master
- **Docs:** Cada feature tiene design doc + implementation plan en `docs/plans/`

### Patrones de API routes

```typescript
// Patron comun en cada route handler:
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  // Optional role check
  if (ctx.role === 'architect') return forbidden();

  // Optional plan check
  const limit = await checkPlanLimit(ctx.orgId, 'project');
  if (!limit.allowed) return NextResponse.json({ error: limit.reason }, { status: 403 });

  const db = getDb();
  // ... query scoped by ctx.orgId
}
```

### Patron de data fetching (client)

```typescript
// SWR para todo el fetching client-side
const { data, error, isLoading } = useSWR<Type[]>('/api/endpoint', fetcher);
// Mutate despues de writes:
await mutate('/api/endpoint');
```

### Patron de formularios

```typescript
// 1. Schema Zod en lib/schemas/
// 2. Hook useFormValidation() o validacion manual con schema.safeParse()
// 3. API usa validateBody(schema, req) que retorna { data } o { error: NextResponse }
```

### Autosave (budgets)

- Debounce de 2 segundos
- Status indicator: idle → saving (spinner) → saved (check verde, 3s) → error (rojo + retry)
- Flush on unmount con `keepalive: true` para que el request complete despues de navigation
- Baseline skip: no guarda en el render inicial

---

## 13. Historial de Features (orden cronologico)

1. MVP base: projects, receipts, AI extraction, dashboard
2. UX polish: Field components, loading/error/empty states
3. Receipt extraction v2: mejor prompt para comprobantes argentinos
4. User schema improvements: is_active, role management
5. Bank accounts: CRUD + linking a receipts
6. Clerk org seed: auto-sync name/logo desde Clerk
7. Receipts filters + sort + totals
8. Reports: gasto por rubro con drill-down
9. Settings: org profile, users, banks tabs con role gates
10. Unified Zod validation: schemas compartidos client/API
11. Pricing & subscription: Free/Advance/Enterprise + Stripe
12. Presupuestos v1: budget editor con rubros
13. Budget editor redesign: spreadsheet-style con Shadcn Table
14. Rubros + autosave: draft/publish workflow, autosave con debounce
15. Refactor: cost_center → rubro (renaming completo)
16. Flowchart + designer prompt (documentacion)
17. UX redesign: mobile-first layouts, shared date-utils/avatar-utils, a11y improvements
18. Modulo Administracion: ingresos/egresos CRUD, tipos configurables, cashflow chart, balance por proyecto, presupuestado vs real por rubro
19. Remove receipt status: eliminado campo `status` (siempre era `confirmed`), enum `ReceiptStatus`, KPI "Pendientes Review", filtros/columnas de estado, y componente `StatusBadge` (sin consumidores)
20. Rename a Agentect: rename global de ObraLink/Architech → Agentect en UI, metadata, docs e internal cache keys. Se preservo el scope npm `@architech/*`. PR #39.
21. Mobile nav redesign: reemplazo de `bottom-nav.tsx` (tabs inferiores) por `mobile-header.tsx` (hamburger menu + slide-in sidebar Sheet). Extraccion de `SidebarContent` para reuso desktop/mobile. Titulo dinamico por ruta. PR #41.
22. Database reset para produccion: truncado de las 14 tablas y vaciado de buckets storage (receipts + org-assets). DB lista para lanzamiento.
23. Receipt categorization (Ingreso/Egreso): toggle pill-style en receipt review, campo "Nro. Comprobante" editable, campo "Quien pago" (expenses), creacion automatica de expense/income al confirmar comprobante. Category read-only post-creacion. Badge Ingreso/Egreso en `/receipts/[id]`. Migracion: `receipts.category`, `expenses.paid_by`, `incomes.receipt_id`, type IDs nullable.
24. Dashboard overhaul: sidebar renombrado "Panel", KPI StatCards con footer links, chart de egresos con Recharts/shadcn (LineChart + toggle Semana/Mes), gasto por proyecto basado en `expenses` table. Project detail cards con links a presupuesto y egresos filtrados.
25. Colored project badges: tablas de egresos e ingresos muestran proyecto como Badge con color (usando `PROJECT_BADGE_STYLES`), consistente con tabla de comprobantes.
26. `/api/org-members` endpoint: lista lightweight (id, full_name) de usuarios activos de la org, accesible por admin+supervisor.

---

## 14. Estado Actual y Deuda Tecnica

### Funcional y completo
- Auth + multi-tenancy con Clerk + Supabase RLS
- CRUD completo de projects, receipts, budgets, rubros, bank accounts, users
- AI extraction con Claude Vision funcionando
- Subscription system con Stripe
- Dashboard ("Panel") con KPIs (StatCards con footer links), chart de egresos (Recharts LineChart con toggle Semana/Mes), gasto por proyecto
- Reports con drill-down
- Budget editor con autosave y versionado
- Modulo Administracion: ingresos, egresos, cashflow, balance, presupuestado vs real
- Receipt categorization: Ingreso/Egreso toggle, creacion automatica de expense/income, "Quien pago", Nro. Comprobante editable
- UX mobile: hamburger menu + slide-in sidebar Sheet (reemplaza bottom tabs), layouts responsive, a11y (keyboard nav, aria-current, aria-expanded), shared utils
- Colored project badges en tablas de comprobantes, egresos e ingresos
- Base de datos de produccion limpia (reset 2026-02-24), storage vaciado

### Pendientes / mejoras posibles
- **Stripe Elements migration**: `lib/stripe/checkout.ts` tiene un comment FUTURE sobre migrar de Checkout Sessions a SetupIntent + Subscription con Elements embebidos
- **Tests**: solo hay tests en `packages/ai/src/__tests__/` — el resto del codigo no tiene tests
- **Notifications**: no hay sistema de notificaciones (email, push)
- **Export**: no hay export de datos a CSV/Excel
- **Soft deletes**: solo bank_accounts usa soft delete (is_active). Receipts y projects son hard delete.
- **i18n**: UI hardcoded en espanol, no hay soporte multi-idioma
- **Optimistic updates**: SWR revalida despues de mutaciones pero no hay optimistic UI
- **Search**: no hay full-text search, solo filtros por campos especificos

---

## 15. Como Correr el Proyecto

```bash
# Instalar dependencias
npm install

# Configurar environment
cp .env.example .env.local
# Llenar las variables (Supabase, Clerk, Anthropic, Stripe)

# Dev server
npm run dev
# Levanta en http://localhost:3000 (o 3001 si 3000 esta ocupado)

# Build
npm run build

# Generar flowchart PDF
cd docs/flowchart && npm install && node generate-pdf.mjs
```

---

## 16. Archivos Importantes (quick reference)

| Necesidad | Archivo |
|-----------|---------|
| Tipos compartidos | `packages/shared/src/types.ts` |
| Enums (roles, project status, colors) | `packages/shared/src/enums.ts` |
| Limites de plan | `packages/shared/src/plans.ts` |
| Auth server-side | `apps/web/lib/auth.ts` |
| Plan guard | `apps/web/lib/plan-guard.ts` |
| AI extraction | `packages/ai/src/extract.ts` + `prompt.ts` |
| Supabase client | `packages/db/src/client.ts` |
| Nav + role gates | `apps/web/components/sidebar.tsx` |
| Mobile hamburger nav | `apps/web/components/mobile-header.tsx` |
| Budget editor | `apps/web/components/budget-table.tsx` |
| Receipt review (AI) | `apps/web/components/receipt-review.tsx` |
| Upload flow | `apps/web/app/(dashboard)/upload/page.tsx` |
| Settings tabs | `apps/web/app/(dashboard)/settings/layout.tsx` (general, users, banks, administration, billing) |
| Zod schemas | `apps/web/lib/schemas/` (9 archivos) |
| Stripe checkout | `apps/web/lib/stripe/checkout.ts` |
| Documentacion visual | `docs/flowchart/index.html` (abrir en browser) |
| Date utilities (ARG TZ) | `apps/web/lib/date-utils.ts` |
| Avatar utilities | `apps/web/lib/avatar-utils.ts` |
| Administration schemas | `apps/web/lib/schemas/administration.ts` |
| Administration module plan | `docs/plans/2026-02-20-administration-module.md` |
| Rename design + plan | `docs/plans/2026-02-23-rename-to-agentect-design.md`, `...-rename-to-agentect.md` |
| Mobile nav design + plan | `docs/plans/2026-02-24-mobile-nav-design.md`, `...-mobile-nav.md` |
| StatCard component | `apps/web/components/ui/stat-card.tsx` |
| Shadcn Chart wrapper | `apps/web/components/ui/chart.tsx` |
| Spend trend chart (client) | `apps/web/components/dashboard/spend-trend-chart.tsx` |
| Org members endpoint | `apps/web/app/api/org-members/route.ts` |
| Project badge styles | `apps/web/lib/project-colors.ts` |
| Receipt category migration | `supabase/migrations/20260226120000_receipt_category.sql` |
| Designer prompt | `docs/designer-prompt.md` |
