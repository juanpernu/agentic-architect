# Landing Value Proposition Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the landing page copy and structure to center on project tracking and profitability instead of AI receipt scanning.

**Architecture:** Single-file change to `apps/web/app/(marketing)/page.tsx` plus minor icon swaps. Same Shadcn components, same Tailwind classes, same layout patterns. No new dependencies. The marketing layout (`layout.tsx`) stays unchanged.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Shadcn/ui, Lucide React icons

**Design doc:** `docs/plans/2026-02-26-landing-value-proposition-design.md`

---

### Task 1: Update Hero section

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx:4-92`

**Step 1: Update metadata**

Replace the existing metadata export (lines 4-14) with:

```tsx
export const metadata: Metadata = {
  title: 'Agentect — Sabé cuánto ganás en cada obra',
  description:
    'Presupuestos integrados, seguimiento de gastos por rubro y control de rentabilidad en tiempo real. Diseñado para estudios de arquitectura argentinos.',
  openGraph: {
    title: 'Agentect — Gestión de obras para estudios que quieren crecer',
    description:
      'Reemplazá Excel con presupuestos integrados y control de rentabilidad obra por obra.',
    type: 'website',
  },
};
```

**Step 2: Update Hero badge text**

Replace the badge text `Escanea tus comprobantes con IA` (line 48) with:

```
Gestión de obras inteligente
```

**Step 3: Update Hero headline**

Replace the h1 content (lines 52-58) with:

```tsx
<h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
  Sabé exactamente cuánto{' '}
  <br />
  <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
    ganás en cada obra
  </span>
</h1>
```

**Step 4: Update Hero subheadline**

Replace the p content (lines 60-64) with:

```tsx
<p className="text-lg sm:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
  Agentect reemplaza tus planillas de Excel con presupuestos integrados,
  seguimiento de gastos por rubro y control de rentabilidad en tiempo real.
  Diseñado para estudios de arquitectura que quieren crecer.
</p>
```

**Step 5: Update Hero secondary CTA**

Change "Ver Demo" to "Ver Funcionalidades" (line 74):

```tsx
<Button variant="outline" size="lg" asChild className="w-full sm:w-auto text-lg px-8 py-4 md:py-6 rounded-xl">
  <Link href="#features">
    Ver Funcionalidades
  </Link>
</Button>
```

**Step 6: Update trust badges**

Replace "14 días de prueba" (line 89) with "Setup en 5 minutos":

```tsx
<div className="flex items-center gap-2">
  <CheckCircle className="h-4 w-4 text-primary" />
  <span>Setup en 5 minutos</span>
</div>
```

**Step 7: Verify visually**

Run: `npm run dev` and open `http://localhost:3000`
Expected: Hero shows new headline, subheadline, badge, CTAs, and trust badges.

**Step 8: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "feat(landing): rewrite hero — rentabilidad al centro"
```

---

### Task 2: Update Comparison section

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx:15-20` (imports) and `:94-171` (comparison section)

**Step 1: Update icon imports**

Replace the current lucide import block (lines 16-20) with icons needed for the full redesign. Remove unused icons and add new ones:

```tsx
import {
  BarChart3, Building2, Check, X,
  FileSpreadsheet, TrendingDown, MessageSquare,
  ArrowRight, CheckCircle, CheckCircle2,
  Zap, Star, Lock,
  TableProperties, DollarSign, Camera,
  Clock, Quote,
} from 'lucide-react';
```

Icons removed: `Bot`, `Receipt`, `Table2`, `CloudUpload`, `LineChart`.
Icons added: `FileSpreadsheet`, `TrendingDown`, `MessageSquare`, `TableProperties`, `DollarSign`, `Quote`.
Icon `Camera` kept (used in facilitator section). `Clock` kept (used in facilitator section).

**Step 2: Rewrite comparison section title**

Replace lines 98-103 with:

```tsx
<div className="text-center mb-10 md:mb-16">
  <h2 className="text-3xl font-bold tracking-tight mb-4">
    El problema que todo estudio conoce
  </h2>
  <p className="text-muted-foreground">
    Presupuestás en Excel, cargás gastos a mano, y al final de la obra no sabés si ganaste o perdiste.
  </p>
</div>
```

**Step 3: Rewrite "old way" card items**

Replace the "La vieja forma" card content (lines 108-133) — keep Card wrapper and layout, replace inner content:

```tsx
<Card className="p-5 md:p-8 relative overflow-hidden">
  <div className="absolute top-4 right-4 opacity-10">
    <X className="h-24 w-24 text-red-500" />
  </div>
  <div className="relative z-10">
    <h3 className="text-red-500 font-bold mb-4 flex items-center gap-2">
      <X className="h-5 w-5" /> Hoy
    </h3>
    <ul className="space-y-4 mb-8">
      <li className="flex items-start gap-3 text-muted-foreground">
        <FileSpreadsheet className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
        <span>Presupuesto en Excel que nadie actualiza después del día 1.</span>
      </li>
      <li className="flex items-start gap-3 text-muted-foreground">
        <MessageSquare className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
        <span>Gastos sueltos entre tickets, transferencias y WhatsApps.</span>
      </li>
      <li className="flex items-start gap-3 text-muted-foreground">
        <TrendingDown className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
        <span>Recién al cerrar la obra descubrís que perdiste plata.</span>
      </li>
    </ul>
    <div className="h-32 bg-muted rounded-lg border-2 border-dashed flex items-center justify-center">
      <span className="text-muted-foreground font-mono text-sm">planilla_obra_v23_FINAL.xlsx</span>
    </div>
  </div>
</Card>
```

**Step 4: Rewrite "new way" card items**

Replace the "Con Agentect" card content (lines 137-168) — keep gradient border wrapper:

```tsx
<div className="p-0.5 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 shadow-xl shadow-primary/10">
  <Card className="p-5 md:p-8 rounded-[14px] h-full relative overflow-hidden border-0">
    <div className="absolute top-4 right-4 opacity-10">
      <CheckCircle className="h-24 w-24 text-primary" />
    </div>
    <div className="relative z-10">
      <h3 className="text-primary font-bold mb-4 flex items-center gap-2">
        <Check className="h-5 w-5" /> Con Agentect
      </h3>
      <ul className="space-y-4 mb-8">
        <li className="flex items-start gap-3">
          <TableProperties className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <span>Presupuesto integrado que se compara con gastos reales automáticamente.</span>
        </li>
        <li className="flex items-start gap-3">
          <DollarSign className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <span>Cada egreso e ingreso asociado a su obra y rubro.</span>
        </li>
        <li className="flex items-start gap-3">
          <BarChart3 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <span>Rentabilidad visible en tiempo real, obra por obra.</span>
        </li>
      </ul>
      <div className="h-32 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-center">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-primary/10">
          <CheckCircle className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Rentabilidad: +12,4%</span>
        </div>
      </div>
    </div>
  </Card>
</div>
```

**Step 5: Verify visually**

Run dev server, check comparison section renders correctly on desktop and mobile.

**Step 6: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "feat(landing): rewrite comparison section — Excel vs Agentect"
```

---

### Task 3: Rewrite Features section

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx:174-344`

**Step 1: Update section title**

Replace lines 175-176 inner content:

```tsx
<section id="features" className="py-16 sm:py-24">
  <div className="mx-auto max-w-7xl px-4 sm:px-8">
    <div className="text-center mb-10 md:mb-16">
      <h2 className="text-3xl font-bold tracking-tight mb-4">
        Todo lo que necesitás para controlar tus obras
      </h2>
    </div>
    <div className="grid lg:grid-cols-3 gap-8">
```

Note: Add the centered title + margin above the grid. The current code goes straight into the grid without a section title.

**Step 2: Replace Feature 1 — "Armá presupuestos profesionales"**

Replace the "Carga con IA" card (lines 179-216) with:

```tsx
{/* Feature 1: Presupuestos (1 col) */}
<Card className="gap-0 p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 sm:mb-6 text-primary">
    <TableProperties className="h-5 w-5 sm:h-6 sm:w-6" />
  </div>
  <CardTitle className="text-lg sm:text-xl mb-2">Armá presupuestos profesionales</CardTitle>
  <CardDescription className="mb-4 sm:mb-6">
    Editor integrado con rubros, ítems, unidades y costos. Publicá versiones y compartí con tu cliente.
  </CardDescription>

  {/* Budget editor mockup */}
  <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border">
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted-foreground mb-1 font-medium">Presupuesto — Casa Martínez</div>
      {[
        { rubro: 'Albañilería', items: 3, total: '$2.450.000' },
        { rubro: 'Electricidad', items: 5, total: '$890.000' },
        { rubro: 'Sanitaria', items: 2, total: '$1.120.000' },
      ].map((section) => (
        <div key={section.rubro} className="bg-white p-2 rounded shadow-sm border">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">{section.rubro}</span>
            <span className="text-xs text-muted-foreground">{section.items} ítems</span>
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-xs font-bold">{section.total}</span>
          </div>
        </div>
      ))}
      <div className="border-t pt-2 flex justify-between items-center">
        <span className="text-xs font-medium">Total</span>
        <span className="text-sm font-bold">$4.460.000</span>
      </div>
    </div>
  </div>
</Card>
```

**Step 3: Replace Feature 2 — "Visualizá la rentabilidad rubro por rubro"**

Replace the "Presupuesto vs. Real" card (lines 219-263) with updated content. Keep the 2-col span and bar chart layout but change to 3 bars per rubro:

```tsx
{/* Feature 2: Rentabilidad por rubro (2 col) */}
<Card className="lg:col-span-2 gap-0 p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
  <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
    <div>
      <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3 sm:mb-4 text-blue-500">
        <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <CardTitle className="text-lg sm:text-xl">Visualizá la rentabilidad rubro por rubro</CardTitle>
      <CardDescription className="mt-1">Semáforo verde/amarillo/rojo para detectar desvíos al instante.</CardDescription>
    </div>
    <div className="flex gap-2">
      <Badge variant="secondary" className="rounded-full text-[10px] sm:text-xs">Presupuestado</Badge>
      <Badge variant="secondary" className="rounded-full text-[10px] sm:text-xs">Costo</Badge>
      <Badge variant="secondary" className="rounded-full text-[10px] sm:text-xs">Gasto Real</Badge>
    </div>
  </div>

  {/* CSS bar chart — 3 bars per rubro */}
  <div className="h-40 sm:h-56 w-full relative">
    <div className="absolute inset-0 flex flex-col justify-between">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="w-full border-b border-border/50 h-0" />
      ))}
    </div>
    <div className="absolute inset-0 flex items-end justify-around px-1 sm:px-4">
      {[
        { label: 'Albañilería', shortLabel: 'Alb', budget: '80%', cost: '70%', real: '65%', color: 'bg-primary' },
        { label: 'Electricidad', shortLabel: 'Elec', budget: '40%', cost: '35%', real: '55%', color: 'bg-red-500' },
        { label: 'Sanitaria', shortLabel: 'San', budget: '90%', cost: '75%', real: '70%', color: 'bg-primary' },
        { label: 'Pintura', shortLabel: 'Pint', budget: '30%', cost: '25%', real: '20%', color: 'bg-primary' },
      ].map((rubro) => (
        <div key={rubro.label} className="w-10 sm:w-16 flex flex-col items-center">
          <div className="w-full flex gap-px sm:gap-0.5 items-end h-32 sm:h-40">
            <div className="w-1/3 bg-gray-300 rounded-t-sm" style={{ height: rubro.budget }} />
            <div className="w-1/3 bg-blue-400 rounded-t-sm" style={{ height: rubro.cost }} />
            <div className={`w-1/3 ${rubro.color} rounded-t-sm`} style={{ height: rubro.real }} />
          </div>
          <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">
            <span className="sm:hidden">{rubro.shortLabel}</span>
            <span className="hidden sm:inline">{rubro.label}</span>
          </span>
        </div>
      ))}
    </div>
  </div>
</Card>
```

Note: Electricidad has `real > cost` so it gets `bg-red-500` to show the red semaphore effect.

**Step 4: Replace Feature 3 — "Cada peso asociado a su obra"**

Replace the "Control Multi-obra" card (lines 266-341) with updated columns:

```tsx
{/* Feature 3: Seguimiento por obra (full width) */}
<Card className="lg:col-span-3 gap-0 p-4 sm:p-8 shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 gap-3 sm:gap-4">
    <div>
      <CardTitle className="text-lg sm:text-2xl flex items-center gap-2">
        <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        Cada peso asociado a su obra
      </CardTitle>
      <CardDescription className="mt-1 sm:mt-2">
        Ingresos, egresos y comprobantes centralizados por proyecto. Sabé al instante cuánto va cada obra.
      </CardDescription>
    </div>
  </div>

  {/* Desktop table */}
  <div className="hidden sm:block">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Proyecto</TableHead>
          <TableHead className="text-right">Ingresos</TableHead>
          <TableHead className="text-right">Egresos</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[
          { name: 'Casa Martínez', income: '$4.200.000', expense: '$3.150.000', balance: '$1.050.000', balanceColor: 'text-primary', status: 'En Curso', statusColor: 'bg-green-100 text-green-800' },
          { name: 'Edificio Alvear', income: '$12.800.000', expense: '$13.100.000', balance: '-$300.000', balanceColor: 'text-red-500', status: 'Revisión', statusColor: 'bg-yellow-100 text-yellow-800' },
          { name: 'Oficinas Centro', income: '$1.500.000', expense: '$450.000', balance: '$1.050.000', balanceColor: 'text-primary', status: 'Inicio', statusColor: 'bg-blue-100 text-blue-800' },
        ].map((project) => (
          <TableRow key={project.name}>
            <TableCell className="font-medium">{project.name}</TableCell>
            <TableCell className="text-right">{project.income}</TableCell>
            <TableCell className="text-right">{project.expense}</TableCell>
            <TableCell className={`text-right font-semibold ${project.balanceColor}`}>{project.balance}</TableCell>
            <TableCell>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.statusColor}`}>
                {project.status}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>

  {/* Mobile cards */}
  <div className="sm:hidden space-y-3">
    {[
      { name: 'Casa Martínez', income: '$4.2M', expense: '$3.1M', balance: '+$1.05M', balanceColor: 'text-primary', status: 'En Curso', statusColor: 'bg-green-100 text-green-800' },
      { name: 'Edificio Alvear', income: '$12.8M', expense: '$13.1M', balance: '-$300K', balanceColor: 'text-red-500', status: 'Revisión', statusColor: 'bg-yellow-100 text-yellow-800' },
      { name: 'Oficinas Centro', income: '$1.5M', expense: '$450K', balance: '+$1.05M', balanceColor: 'text-primary', status: 'Inicio', statusColor: 'bg-blue-100 text-blue-800' },
    ].map((project) => (
      <div key={project.name} className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{project.name}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${project.statusColor}`}>
            {project.status}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Ingresos: {project.income}</span>
          <span className="text-muted-foreground">Egresos: {project.expense}</span>
          <span className={`font-semibold ${project.balanceColor}`}>{project.balance}</span>
        </div>
      </div>
    ))}
  </div>
</Card>
```

**Step 5: Verify visually**

Check all 3 feature cards on desktop and mobile.

**Step 6: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "feat(landing): rewrite features — presupuestos, rentabilidad, seguimiento"
```

---

### Task 4: Add Facilitator and Social Proof sections

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx` — insert two new sections between Features and Pricing

**Step 1: Add Facilitator section after Features closing `</section>`**

Insert after the features section closing tag (before the pricing section):

```tsx
{/* ═══════════════ FACILITATOR ═══════════════ */}
<section className="py-12 md:py-20 bg-slate-50 border-y">
  <div className="mx-auto max-w-7xl px-4 md:px-8">
    <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
      {/* Text */}
      <div className="flex-1 text-center md:text-left">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
          Cargá los gastos de tu obra en segundos
        </h2>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Sacale una foto al comprobante y Agentect extrae proveedor, monto,
          CUIT y fecha automáticamente. Vos solo confirmás.
        </p>
      </div>

      {/* Scan illustration — compact reuse */}
      <div className="flex-1 max-w-sm w-full">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <span>Escaneando...</span>
              </div>
              <span className="text-primary font-mono">98%</span>
            </div>
            <div className="bg-slate-50 p-3 rounded border w-3/4 mx-auto relative overflow-hidden">
              <div className="h-2 w-1/2 bg-muted rounded mb-2" />
              <div className="h-2 w-3/4 bg-muted rounded mb-4" />
              <div className="border-t border-dashed my-2" />
              <div className="flex justify-between">
                <div className="h-2 w-8 bg-muted rounded" />
                <div className="h-2 w-12 bg-primary/40 rounded" />
              </div>
              <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(22,196,85,0.8)] animate-scan" />
            </div>
            <div className="space-y-1.5">
              {[
                { label: 'Proveedor', value: 'Ferretería San Martín' },
                { label: 'Total', value: '$15.231,89' },
                { label: 'CUIT', value: '30-71234567-9' },
              ].map((field) => (
                <div key={field.label} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="font-medium">{field.value}</span>
                </div>
              ))}
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-medium">Listo para confirmar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

**Step 2: Add Social Proof section after Facilitator**

Insert after the facilitator section:

```tsx
{/* ═══════════════ SOCIAL PROOF ═══════════════ */}
<section className="py-12 md:py-20">
  <div className="mx-auto max-w-4xl px-4 md:px-8 text-center">
    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-10">
      Lo que dicen los estudios que ya lo usan
    </h2>
    <div className="grid md:grid-cols-2 gap-6">
      {[
        {
          quote: 'Antes cerraba cada obra sin saber si había ganado o perdido. Ahora lo veo en tiempo real.',
          name: 'Nombre Apellido',
          role: 'Arquitecto',
          studio: 'Estudio Beta Tester 1',
        },
        {
          quote: 'Armar presupuestos me llevaba días en Excel. Con Agentect lo hago en una tarde y después puedo comparar contra los gastos reales.',
          name: 'Nombre Apellido',
          role: 'Directora de Obra',
          studio: 'Estudio Beta Tester 2',
        },
      ].map((testimonial) => (
        <Card key={testimonial.studio} className="p-6 text-left">
          <Quote className="h-8 w-8 text-primary/20 mb-3" />
          <p className="text-muted-foreground leading-relaxed mb-4">
            &ldquo;{testimonial.quote}&rdquo;
          </p>
          <div>
            <p className="font-semibold text-sm">{testimonial.name}</p>
            <p className="text-xs text-muted-foreground">{testimonial.role} — {testimonial.studio}</p>
          </div>
        </Card>
      ))}
    </div>
    <p className="text-xs text-muted-foreground mt-6">
      * Nombres y estudios de beta testers. Se actualizarán con testimonios finales.
    </p>
  </div>
</section>
```

**Step 3: Verify visually**

Check both new sections on desktop and mobile. Verify the scan animation works in the facilitator section.

**Step 4: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "feat(landing): add facilitator and social proof sections"
```

---

### Task 5: Update Pricing and CTA sections

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx` — pricing title/subtitle and CTA section

**Step 1: Update Pricing title and subtitle**

Replace the pricing section header (lines ~350-356 area) with:

```tsx
<div className="text-center max-w-3xl mx-auto mb-10 md:mb-16">
  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
    Elegí el plan que acompañe tu crecimiento
  </h2>
  <p className="text-lg text-muted-foreground">
    Empezá gratis con un proyecto. Escalá cuando tu estudio lo necesite.
  </p>
</div>
```

Keep all pricing cards unchanged.

**Step 2: Update CTA section**

Replace the CTA section content with:

```tsx
<section className="py-12 md:py-20 border-t">
  <div className="mx-auto max-w-4xl px-4 text-center">
    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">
      Tu próxima obra merece mejor control
    </h2>
    <p className="text-muted-foreground mb-8 text-lg">
      Creá tu cuenta gratis y armá tu primer presupuesto en minutos.
      Sin Excel, sin sorpresas al cierre.
    </p>
    <Button size="lg" asChild className="px-8 py-4 md:py-6 rounded-xl text-lg shadow-lg shadow-primary/20">
      <Link href="/sign-up">Crear cuenta gratis</Link>
    </Button>
    <p className="mt-10 text-sm text-muted-foreground">
      &copy; {new Date().getFullYear()} Agentect. Hecho en Buenos Aires.
    </p>
  </div>
</section>
```

**Step 3: Verify visually**

Full scroll through the entire page on desktop and mobile.

**Step 4: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "feat(landing): update pricing title and CTA copy"
```

---

### Task 6: Clean up unused imports and final review

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx` — imports only

**Step 1: Verify all imported icons are used**

Search the file for each imported icon name. Remove any that are no longer referenced in JSX. The `BackgroundRippleEffect` import stays (used in Hero). The `Badge` import stays (used in Feature 2).

**Step 2: Run build to verify no errors**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

**Step 3: Final visual QA**

Run dev server, check every section on:
- Desktop (1280px+)
- Tablet (768px)
- Mobile (375px)

Verify:
- No broken layouts
- Scan animation works in facilitator section
- All links work (#features, #pricing, /sign-up)
- Mobile cards render correctly in Feature 3

**Step 4: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "chore(landing): clean up unused imports"
```

---

## Summary

| Task | What | Commits |
|------|------|---------|
| 1 | Hero: headline, subheadline, badge, CTAs, trust badges | 1 |
| 2 | Comparison: title, icons, card content | 1 |
| 3 | Features: 3 cards rewritten (presupuestos, rentabilidad, seguimiento) | 1 |
| 4 | Facilitator + Social proof (new sections) | 1 |
| 5 | Pricing title + CTA copy | 1 |
| 6 | Cleanup + build verification | 1 |

Total: 6 tasks, 6 commits, 1 file modified (`page.tsx`), 1 import line updated.
