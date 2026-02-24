import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Agentect — Gestión de obras con IA para estudios argentinos',
  description:
    'Escaneá facturas AFIP con IA, controlá gastos y materiales en tiempo real. Diseñado para arquitectos y constructoras en Argentina.',
  openGraph: {
    title: 'Agentect — Gestioná tus obras sin planillas de Excel',
    description:
      'IA para extraer datos de facturas AFIP. Control de gastos, materiales y proveedores en tiempo real.',
    type: 'website',
  },
};
import {
  Bot, BarChart3, Building2, Check, X,
  Receipt, Table2, Clock, Camera, CloudUpload,
  LineChart, ArrowRight, CheckCircle, CheckCircle2,
  Zap, Star, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';

export default function LandingPage() {
  return (
    <>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-32 overflow-hidden">
        {/* Glow background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
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
                      className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(22,196,85,0.8)] animate-scan"
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
                        <div className="w-1/2 bg-gray-300 rounded-t-sm" style={{ height: rubro.budget }} />
                        <div className="w-1/2 bg-primary rounded-t-sm" style={{ height: rubro.real }} />
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
                  US$30<span className="text-xs font-normal text-muted-foreground">/mes</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Para equipos en crecimiento</p>
              <p className="text-xs text-muted-foreground mb-4">+ US$5/usuario/mes</p>
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
                <Lock className="h-3 w-3" /> Procesado seguro con Stripe
              </p>
            </div>
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
