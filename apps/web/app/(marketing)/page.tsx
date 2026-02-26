import type { Metadata } from 'next';
import Link from 'next/link';

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
import {
  BarChart3, Building2, Check, X,
  FileSpreadsheet, TrendingDown, MessageSquare,
  ArrowRight, CheckCircle, CheckCircle2,
  Zap, Star, Lock,
  TableProperties, DollarSign, Camera,
  Quote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { BackgroundRippleEffect } from '@/components/ui/background-ripple-effect';

const PROJECTS = [
  { name: 'Casa Martínez', income: 4_200_000, expense: 3_150_000, status: 'En Curso' as const, statusColor: 'bg-green-100 text-green-800' },
  { name: 'Edificio Alvear', income: 12_800_000, expense: 13_100_000, status: 'Revisión' as const, statusColor: 'bg-yellow-100 text-yellow-800' },
  { name: 'Oficinas Centro', income: 1_500_000, expense: 450_000, status: 'Inicio' as const, statusColor: 'bg-blue-100 text-blue-800' },
];

function formatARS(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function formatCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$ ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$ ${(abs / 1_000).toFixed(0)}K`;
  return `$ ${abs}`;
}

function signedBalance(n: number, formatter: (v: number) => string) {
  const formatted = formatter(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}

export default function LandingPage() {
  return (
    <>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-32 overflow-hidden">
        {/* Grid background */}
        <BackgroundRippleEffect />
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-white pointer-events-none z-[4]" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Gestión de obras inteligente
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Sabé exactamente cuánto{' '}
            <br />
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              ganás en cada obra
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
            Agentect reemplaza tus planillas de Excel con presupuestos integrados,
            seguimiento de gastos por rubro y control de rentabilidad en tiempo real.
            Diseñado para estudios de arquitectura que quieren crecer.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="w-full sm:w-auto text-lg px-8 py-4 md:py-6 rounded-xl shadow-lg shadow-primary/25">
              <Link href="/sign-up">
                Probar Gratis <ArrowRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="w-full sm:w-auto text-lg px-8 py-4 md:py-6 rounded-xl">
              <Link href="#features">
                Ver Funcionalidades
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
              <span>Setup en 5 minutos</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ COMPARISON ═══════════════ */}
      <section className="py-12 md:py-20 bg-slate-50 border-y">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              El problema que todo estudio conoce
            </h2>
            <p className="text-muted-foreground">
              Presupuestás en Excel, cargás gastos a mano, y al final de la obra no sabés si ganaste o perdiste.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Old way */}
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

            {/* New way — with gradient border */}
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
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section id="features" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Todo lo que necesitás para controlar tus obras
            </h2>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">

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
                  <Badge variant="secondary" className="rounded-full text-[10px] sm:text-xs flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-300" />Presupuestado</Badge>
                  <Badge variant="secondary" className="rounded-full text-[10px] sm:text-xs flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" />Costo</Badge>
                  <Badge variant="secondary" className="rounded-full text-[10px] sm:text-xs flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Gasto Real</Badge>
                </div>
              </div>

              {/* CSS bar chart — 3 bars per rubro */}
              <div className="h-40 sm:h-56 w-full relative" aria-hidden="true">
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
                    {PROJECTS.map((p) => {
                      const balance = p.income - p.expense;
                      return (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{formatARS(p.income)}</TableCell>
                          <TableCell className="text-right">{formatARS(p.expense)}</TableCell>
                          <TableCell className={`text-right font-semibold ${balance >= 0 ? 'text-primary' : 'text-red-500'}`}>
                            {signedBalance(balance, formatARS)}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.statusColor}`}>
                              {p.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {PROJECTS.map((p) => {
                  const balance = p.income - p.expense;
                  return (
                    <div key={p.name} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{p.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${p.statusColor}`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Ingresos: {formatCompact(p.income)}</span>
                        <span className="text-muted-foreground">Egresos: {formatCompact(p.expense)}</span>
                        <span className={`font-semibold ${balance >= 0 ? 'text-primary' : 'text-red-500'}`}>
                          {signedBalance(balance, formatCompact)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </section>

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
            <div className="flex-1 max-w-sm w-full" aria-hidden="true">
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

      {/* ═══════════════ SOCIAL PROOF (hidden until real quotes) ═══════════════ */}
      {/* TODO: Uncomment when real beta tester testimonials are available
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-10">
            Lo que dicen los estudios que ya lo usan
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                quote: 'Quote real del beta tester',
                name: 'Nombre real',
                role: 'Rol',
                studio: 'Estudio',
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
        </div>
      </section>
      */}

      {/* ═══════════════ PRICING ═══════════════ */}
      <section id="pricing" className="py-16 md:py-24 bg-slate-50 border-y">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 md:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Elegí el plan que acompañe tu crecimiento
            </h2>
            <p className="text-lg text-muted-foreground">
              Empezá gratis con un proyecto. Escalá cuando tu estudio lo necesite.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col">
              <div className="mb-3">
                <h3 className="text-2xl font-bold">Free</h3>
                <span className="text-xl font-bold text-muted-foreground">
                  $0<span className="text-xs font-normal">/mes</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Para empezar</p>
              <ul className="space-y-2 mb-4">
                {['1 proyecto', '20 comprobantes por proyecto', '1 usuario', 'Sin reportes'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full mt-auto" asChild>
                <Link href="/sign-up">Comenzar Gratis</Link>
              </Button>
            </div>

            {/* Advance */}
            <div className="rounded-xl border-2 border-primary/20 bg-card p-5 shadow-sm relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                MÁS POPULAR
              </div>
              <div className="mb-3">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  Advance
                  <Zap className="h-5 w-5 text-amber-500" />
                </h3>
                <span className="text-xl font-bold">
                  $30.000<span className="text-xs font-normal text-muted-foreground">/mes</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Para equipos en crecimiento</p>
              <p className="text-xs text-muted-foreground mb-4">+ $5.000/usuario/mes</p>
              <ul className="space-y-2 mb-4">
                {['20 proyectos', 'Comprobantes ilimitados', 'Reportes de gastos', 'Seats flexibles'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full mt-auto" asChild>
                <Link href="/sign-up">Probar 14 días gratis</Link>
              </Button>
            </div>

            {/* Enterprise — dark gradient */}
            <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-6 text-white shadow-xl flex flex-col">
              <div className="mb-1">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-400" />
                  Enterprise
                </h3>
                <span className="text-xl font-bold text-white">Personalizado</span>
              </div>
              <p className="text-sm text-gray-300 mb-5">Para grandes organizaciones</p>
              <div className="space-y-3 mb-6">
                {['Proyectos ilimitados', 'Comprobantes ilimitados', 'Reportes de gastos', 'Usuarios ilimitados', 'Soporte prioritario'].map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-gray-200">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-auto bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30" asChild>
                <Link href="/sign-up">Contactanos</Link>
              </Button>
              <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> Procesado seguro con Mercado Pago
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA + FOOTER ═══════════════ */}
      <section className="py-12 md:py-20 border-t">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">
            Tu próxima obra merece mejor control
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Creá tu cuenta gratis y armá tu primer presupuesto en minutos. Sin Excel, sin sorpresas al cierre.
          </p>
          <Button size="lg" asChild className="px-8 py-4 md:py-6 rounded-xl text-lg shadow-lg shadow-primary/20">
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
