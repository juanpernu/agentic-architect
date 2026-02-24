# Landing Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Agentect marketing landing page at `/` with a `(marketing)` route group, real content matching the approved design, and reusing existing Shadcn components.

**Architecture:** Create `app/(marketing)/` route group with its own layout (header + footer, light mode only). Move the current dashboard from `/` to `/dashboard`. Update Clerk middleware to allow `/` as public and redirect authenticated users. The landing page is a single-file server component with 6 sections, all using existing UI components.

**Tech Stack:** Next.js App Router, Tailwind CSS 4, Clerk middleware, Shadcn/ui (Button, Badge, Card, Table), Lucide React

---

## Context for the implementer

### Component reuse decisions

| Need | Decision | Rationale |
|------|----------|-----------|
| CTAs | Reuse `ui/button.tsx` | Has `default`, `outline`, `ghost`, `lg`, `sm` variants — covers all CTAs |
| Hero badge, status badges | Reuse `ui/badge.tsx` | For "Nuevo" pill and table status badges |
| Feature cards, pricing cards | Reuse `ui/card.tsx` | Card, CardHeader, CardTitle, CardDescription, CardContent |
| Multi-obra table | Reuse `ui/table.tsx` | Table, TableHeader, TableBody, TableHead, TableRow, TableCell |
| Bar chart (Presupuesto vs Real) | **CSS divs** (not Recharts) | Static decorative chart with 4 hardcoded bar pairs. Recharts adds unnecessary client-side JS for static data. CSS `h-[65%]` matches the HTML reference exactly. |
| Scan animation | CSS `@keyframes` | Pure CSS line animation for "Carga con IA" card. No JS needed. |
| Icons | Lucide React | Already installed. Replace Material Symbols: `Bot`, `BarChart3`, `Building2`, `Check`, `X`, `Camera`, `CloudUpload`, `LineChart`, `ArrowRight`, `Play`, `CheckCircle`, `Receipt`, `Table2`, `Clock` |

### What we are NOT doing

- **No dark mode** — landing is light-only (`bg-white`)
- **No Space Grotesk font** — use Inter for everything (already configured)
- **No new Shadcn components** — everything covered by existing ones
- **No Recharts** — CSS bars are simpler for static decorative data
- **No dark mode toggle button** — removed from nav

### Copy and voice rules

- **Idioma:** Espanol argentino, tuteo con "vos"
- **Tono:** Profesional pero cercano, directo, concreto

### Pricing data (from design, NOT from plans.ts — design has marketing-specific values)

- **Freelance:** $15.000/mes — 2 obras, 1 usuario, escaneo basico, reportes mensuales
- **Estudio (MAS POPULAR):** $35.000/mes — 10 obras, 5 usuarios, IA avanzada, comparativa precios, portal clientes
- **Empresa:** Consultar — ilimitado, API ERP, soporte 24/7, capacitacion

### Layout tree (final state)

```
app/layout.tsx  (RootLayout — html/body, Inter font)
  |
  +-- (marketing)/layout.tsx  (ClerkProvider, header + footer, bg-white)
  |     +-- page.tsx  → URL: /  (landing page)
  |
  +-- (auth)/layout.tsx
  |     +-- sign-in/  → /sign-in
  |     +-- sign-up/  → /sign-up
  |
  +-- (dashboard)/layout.tsx  (Sidebar + MobileHeader + auth)
        +-- dashboard/page.tsx  → /dashboard  (ex /)
        +-- projects/...        → /projects
        +-- (all other routes unchanged)
```

### Files that must NOT be modified

- `apps/web/app/(dashboard)/layout.tsx`
- `apps/web/app/(auth)/layout.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/next.config.ts`
- Any existing route or API route
- Any `components/ui/*.tsx` file

---

### Task 1: Update Clerk middleware — public `/` + auth redirect

**Files:**
- Modify: `apps/web/middleware.ts`

**Step 1: Update middleware with public route and auth redirect**

Replace the entire file with:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  // Authenticated users on landing → redirect to dashboard
  if (request.nextUrl.pathname === '/' && userId) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

Changes:
- Added `'/'` to `isPublicRoute`
- Import `NextResponse`
- Call `await auth()` to get `userId`
- Redirect authenticated users on `/` to `/dashboard`

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat: allow / as public route with auth redirect to /dashboard"
```

---

### Task 2: Move dashboard from `/` to `/dashboard`

**Files:**
- Move: `apps/web/app/(dashboard)/page.tsx` → `apps/web/app/(dashboard)/dashboard/page.tsx`
- Modify: `apps/web/components/sidebar.tsx`

**Step 1: Move the dashboard page**

```bash
mkdir -p apps/web/app/\(dashboard\)/dashboard
git mv apps/web/app/\(dashboard\)/page.tsx apps/web/app/\(dashboard\)/dashboard/page.tsx
```

File content stays exactly the same.

**Step 2: Update sidebar navItems**

In `apps/web/components/sidebar.tsx`, change:

```typescript
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
```

To:

```typescript
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
```

**Step 3: Search for stale references**

Run: `grep -rn "href: '/'" apps/web/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v .next`
Expected: No results.

Run: `grep -rn "redirect('/')" apps/web/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v .next`
Expected: No results.

**Step 4: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/page.tsx apps/web/components/sidebar.tsx
git rm apps/web/app/\(dashboard\)/page.tsx
git commit -m "refactor: move dashboard from / to /dashboard to free root for landing"
```

---

### Task 3: Create marketing layout

**Files:**
- Create: `apps/web/app/(marketing)/layout.tsx`

**Step 1: Create the marketing layout**

Create `apps/web/app/(marketing)/layout.tsx` with:

```tsx
import { ClerkProvider } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <div className="min-h-screen flex flex-col bg-white text-foreground">
        {/* Navbar */}
        <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-2">
              <div className="bg-primary/20 p-1.5 rounded-lg">
                <span className="text-primary font-bold text-sm">A</span>
              </div>
              <span className="font-bold text-xl tracking-tight">Agentect</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Funcionalidades
              </a>
              <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Precios
              </a>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/sign-in">Ingresar</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-up">Empezar Gratis</Link>
              </Button>
            </div>
          </div>
        </nav>

        <main className="flex-1">{children}</main>

        {/* Footer is part of the CTA section in the page */}
      </div>
    </ClerkProvider>
  );
}
```

Key details:
- `ClerkProvider` wraps everything for auth state
- Sticky nav with `backdrop-blur-lg` and `bg-white/80`
- Logo with teal background square + "A" letter (matching design)
- Nav links as anchor scrolls to `#features` and `#pricing`
- "Ingresar" hidden on small screens (`hidden sm:inline-flex`)
- No footer in layout — the CTA section at page bottom includes the copyright (matching the design)

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/layout.tsx
git commit -m "feat: add marketing layout with navbar and ClerkProvider"
```

---

### Task 4: Create landing page with all sections

This is the main task. The landing page is a single server component with 6 sections matching the design.

**Files:**
- Create: `apps/web/app/(marketing)/page.tsx`

**Step 1: Create the landing page**

Create `apps/web/app/(marketing)/page.tsx` with:

```tsx
import Link from 'next/link';
import {
  Bot, BarChart3, Building2, Check, X,
  Receipt, Table2, Clock, Camera, CloudUpload,
  LineChart, ArrowRight, CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';

/* ── Scan animation (used in "Carga con IA" card) ── */
const scanKeyframes = `
@keyframes scan {
  0% { top: 0%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
`;

export default function LandingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scanKeyframes }} />

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-32 overflow-hidden">
        {/* Glow background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Nuevo: Escaneo de Facturas AFIP
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Gestioná tus obras{' '}
            <br />
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              sin planillas de Excel
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Agentect utiliza IA para extraer datos de tus facturas y recibos
            automáticamente. Controlá gastos, materiales y proveedores en tiempo
            real, diseñado específicamente para estudios argentinos.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="w-full sm:w-auto text-lg px-8 py-6 rounded-xl shadow-lg shadow-primary/25">
              <Link href="/sign-up">
                Probar Gratis <ArrowRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="w-full sm:w-auto text-lg px-8 py-6 rounded-xl">
              <Link href="#features">
                Ver Demo
              </Link>
            </Button>
          </div>

          {/* Trust badges */}
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span>Sin tarjeta de crédito</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span>14 días de prueba</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ COMPARISON ═══════════════ */}
      <section className="py-20 bg-slate-50 border-y">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              La evolución de la gestión de obra
            </h2>
            <p className="text-muted-foreground">
              Dejá de perder comprobantes y empezá a tomar decisiones con datos.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Old way */}
            <Card className="p-8 relative overflow-hidden">
              <div className="absolute top-4 right-4 opacity-10">
                <X className="h-24 w-24 text-red-500" />
              </div>
              <div className="relative z-10">
                <h3 className="text-red-500 font-bold mb-4 flex items-center gap-2">
                  <X className="h-5 w-5" /> La vieja forma
                </h3>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <Receipt className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                    <span>Caja de zapatos llena de tickets que se borran.</span>
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <Table2 className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                    <span>Excel interminable con fórmulas rotas #REF!.</span>
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <Clock className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                    <span>Días perdidos cargando facturas manualmente.</span>
                  </li>
                </ul>
                <div className="h-32 bg-muted rounded-lg border-2 border-dashed flex items-center justify-center">
                  <span className="text-muted-foreground font-mono text-sm">spreadsheet_error.xlsx</span>
                </div>
              </div>
            </Card>

            {/* New way — with gradient border */}
            <div className="p-0.5 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 shadow-xl shadow-primary/10">
              <Card className="p-8 rounded-[14px] h-full relative overflow-hidden border-0">
                <div className="absolute top-4 right-4 opacity-10">
                  <CheckCircle className="h-24 w-24 text-primary" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-primary font-bold mb-4 flex items-center gap-2">
                    <Check className="h-5 w-5" /> Con Agentect
                  </h3>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3">
                      <Camera className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <span>Foto al ticket y la IA extrae el CUIT, fecha y monto.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CloudUpload className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <span>Sincronización automática con tu presupuesto.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <LineChart className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <span>Reportes en tiempo real para el cliente.</span>
                    </li>
                  </ul>
                  <div className="h-32 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-center">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-primary/10">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Procesado</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid lg:grid-cols-3 gap-8">

            {/* Feature 1: Carga con IA (1 col) */}
            <Card className="p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="h-12 w-12 bg-primary/20 rounded-lg flex items-center justify-center mb-6 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl mb-2">Carga con IA</CardTitle>
              <CardDescription className="mb-6">
                Nuestro motor reconoce facturas A, B y C de AFIP al instante. Olvidate de tipear CUITs.
              </CardDescription>

              {/* Scan illustration */}
              <div className="bg-slate-50 rounded-xl p-4 border relative overflow-hidden">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                    <span>Escaneando...</span>
                    <span className="text-primary font-mono">98%</span>
                  </div>
                  <div className="bg-white p-3 rounded shadow-sm border w-3/4 mx-auto relative overflow-hidden">
                    <div className="h-2 w-1/2 bg-muted rounded mb-2" />
                    <div className="h-2 w-3/4 bg-muted rounded mb-4" />
                    <div className="border-t border-dashed my-2" />
                    <div className="flex justify-between">
                      <div className="h-2 w-8 bg-muted rounded" />
                      <div className="h-2 w-12 bg-primary/40 rounded" />
                    </div>
                    <div
                      className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(22,196,85,0.8)]"
                      style={{ animation: 'scan 2s infinite linear' }}
                    />
                  </div>
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 flex items-center gap-2 mt-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <div className="text-xs">
                      <div className="text-muted-foreground">Total</div>
                      <div className="font-bold">$15.231,89</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Feature 2: Presupuesto vs Real (2 col) */}
            <Card className="lg:col-span-2 p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <div>
                  <div className="h-12 w-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 text-blue-500">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">Presupuesto vs. Real</CardTitle>
                  <CardDescription className="mt-1">Detectá desvíos antes de que sea tarde.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="rounded-full">Materiales</Badge>
                  <Badge variant="secondary" className="rounded-full">Mano de Obra</Badge>
                </div>
              </div>

              {/* CSS bar chart */}
              <div className="h-48 sm:h-56 w-full relative">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="w-full border-b border-border/50 h-0" />
                  ))}
                </div>
                {/* Bars */}
                <div className="absolute inset-0 flex items-end justify-around px-4">
                  {[
                    { label: 'Rubro 1', budget: '80%', real: '65%' },
                    { label: 'Rubro 2', budget: '40%', real: '45%' },
                    { label: 'Rubro 3', budget: '90%', real: '70%' },
                    { label: 'Rubro 4', budget: '30%', real: '25%' },
                  ].map((rubro) => (
                    <div key={rubro.label} className="w-12 sm:w-16 flex flex-col items-center">
                      <div className="w-full flex gap-1 items-end h-40">
                        <div className={`w-1/2 bg-gray-300 rounded-t-sm`} style={{ height: rubro.budget }} />
                        <div className={`w-1/2 bg-primary rounded-t-sm`} style={{ height: rubro.real }} />
                      </div>
                      <span className="text-xs text-muted-foreground mt-2">{rubro.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Feature 3: Control Multi-obra (full width) */}
            <Card className="lg:col-span-3 p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-primary" />
                    Control Multi-obra
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Todo tu estudio en una sola pantalla. Accedé al estado de cada proyecto.
                  </CardDescription>
                </div>
                <span className="text-primary font-medium flex items-center gap-1 text-sm">
                  Ver reporte completo <ArrowRight className="h-4 w-4" />
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Avance Financiero</TableHead>
                    <TableHead className="text-right">Última Actividad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { name: 'Casa Martínez', status: 'En Curso', statusColor: 'bg-green-100 text-green-800', progress: 65, barColor: 'bg-primary', time: 'Hace 2h' },
                    { name: 'Edificio Alvear', status: 'Revisión', statusColor: 'bg-yellow-100 text-yellow-800', progress: 22, barColor: 'bg-yellow-500', time: 'Ayer' },
                    { name: 'Remodelación Oficinas', status: 'Planificación', statusColor: 'bg-blue-100 text-blue-800', progress: 5, barColor: 'bg-blue-500', time: 'Hace 3 días' },
                  ].map((project) => (
                    <TableRow key={project.name}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.statusColor}`}>
                          {project.status}
                        </span>
                      </TableCell>
                      <TableCell className="w-1/3">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground w-8">{project.progress}%</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${project.barColor} rounded-full`} style={{ width: `${project.progress}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{project.time}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══════════════ PRICING ═══════════════ */}
      <section id="pricing" className="py-24 bg-slate-50 border-y">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Planes diseñados para tu estudio
            </h2>
            <p className="text-lg text-muted-foreground">
              Elegí el plan que mejor se adapte a tu volumen de obras. Sin contratos a largo plazo.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* Freelance */}
            <Card className="p-8 hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold mb-2">Freelance</h3>
              <p className="text-sm text-muted-foreground mb-6">Para arquitectos independientes.</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$15.000</span>
                <span className="text-muted-foreground">/mes</span>
              </div>
              <Button variant="outline" className="w-full mb-8 rounded-xl" asChild>
                <Link href="/sign-up">Comenzar Gratis</Link>
              </Button>
              <ul className="space-y-4 text-sm text-muted-foreground">
                {['Hasta 2 obras activas', '1 usuario', 'Escaneo básico de facturas', 'Reportes mensuales'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Estudio (highlighted) */}
            <div className="p-0.5 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 shadow-xl shadow-primary/20 relative md:-translate-y-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-emerald-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg">
                Más Popular
              </div>
              <Card className="p-8 rounded-[14px] h-full border-0">
                <h3 className="text-xl font-bold mb-2">Estudio</h3>
                <p className="text-sm text-muted-foreground mb-6">Para estudios en crecimiento.</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">$35.000</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
                <Button className="w-full mb-8 rounded-xl shadow-lg shadow-primary/25" asChild>
                  <Link href="/sign-up">Probar 14 días gratis</Link>
                </Button>
                <ul className="space-y-4 text-sm text-muted-foreground">
                  {[
                    'Hasta 10 obras activas',
                    '5 usuarios',
                    <><strong className="text-foreground">IA Avanzada</strong> (Lectura de items)</>,
                    'Comparativa de precios',
                    'Portal de clientes',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* Empresa */}
            <Card className="p-8 hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold mb-2">Empresa</h3>
              <p className="text-sm text-muted-foreground mb-6">Para constructoras grandes.</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">Consultar</span>
              </div>
              <Button variant="outline" className="w-full mb-8 rounded-xl" asChild>
                <Link href="/sign-up">Contactar Ventas</Link>
              </Button>
              <ul className="space-y-4 text-sm text-muted-foreground">
                {['Obras ilimitadas', 'Usuarios ilimitados', 'API para integración ERP', 'Soporte prioritario 24/7', 'Capacitación al equipo'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA + FOOTER ═══════════════ */}
      <section className="py-20 border-t">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Empezá a ordenar tus obras hoy
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Sumate a más de 500 estudios de arquitectura en Argentina que ya confían en Agentect.
          </p>
          <Button size="lg" asChild className="px-8 py-6 rounded-xl text-lg shadow-lg shadow-primary/20">
            <Link href="/sign-up">Crear cuenta gratis</Link>
          </Button>
          <p className="mt-10 text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Agentect. Hecho en Buenos Aires.
          </p>
        </div>
      </section>
    </>
  );
}
```

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds. `/` serves the landing with all 6 sections.

**Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "feat: add landing page with hero, comparison, features, pricing and CTA"
```

---

### Task 5: Verify Clerk redirect env vars

**Files:**
- Check: `.env.local` (or Vercel environment settings)

**Step 1: Check if Clerk redirect vars exist**

Run: `grep -n "CLERK_AFTER_SIGN" apps/web/.env.local 2>/dev/null || echo "No vars found"`

**Step 2: If vars exist and point to `/`, update to `/dashboard`**

If found:
```
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

If not found: middleware redirect handles it — no action needed.

---

### Task 6: Final verification

**Step 1: Full build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 2: Verify route structure**

Build output should include:
- `/` — landing page (static)
- `/dashboard` — dashboard (dynamic)
- All other existing routes unchanged

**Step 3: Verify no stale `/` references**

Run: `grep -rn "href: '/'" apps/web/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v .next`
Expected: No results.

**Step 4: Verify middleware**

Check `apps/web/middleware.ts`: `'/'` in public routes, redirect to `/dashboard`.

**Step 5: Verify no files were modified that shouldn't have been**

Run: `git diff --name-only HEAD~5`
Confirm NO changes to: `(dashboard)/layout.tsx`, `(auth)/layout.tsx`, `app/layout.tsx`, `next.config.ts`, any `api/` route, any `components/ui/` file.

---

## Files summary

| Action | File | Notes |
|--------|------|-------|
| MODIFY | `apps/web/middleware.ts` | Add `/` to public, auth redirect to `/dashboard` |
| MOVE | `apps/web/app/(dashboard)/page.tsx` → `dashboard/page.tsx` | Dashboard now at `/dashboard` |
| MODIFY | `apps/web/components/sidebar.tsx` | `href: '/'` → `href: '/dashboard'` |
| CREATE | `apps/web/app/(marketing)/layout.tsx` | ClerkProvider + navbar, light-only |
| CREATE | `apps/web/app/(marketing)/page.tsx` | Full landing: hero, comparison, features, pricing, CTA |
| CHECK | `.env.local` / Vercel | Clerk redirect vars if they exist |
