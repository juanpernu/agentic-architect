'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Sparkles, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface PlanGatePageProps {
  title: string;
  description: string;
  features: string[];
  preview?: ReactNode;
  children: ReactNode;
}

const NOOP = () => {};

export function PlanGatePage({
  title,
  description,
  features,
  preview,
  children,
}: PlanGatePageProps) {
  return (
    <div className="relative">
      <div className="blur-sm opacity-50 pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      <Dialog open={true} onOpenChange={NOOP}>
        <DialogContent
          showCloseButton={false}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader className="items-center text-center">
            {preview ? (
              <div className="mx-auto mb-3 w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30 shadow-inner" aria-hidden="true">
                {preview}
              </div>
            ) : (
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
            )}
            <DialogTitle className="text-xl">
              Desbloqueá {title}
            </DialogTitle>
            <DialogDescription>
              {description}
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-3 py-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button asChild className="w-full">
              <Link href="/settings/billing">Ver planes</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al panel
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Mini-UI Preview Mockups ── */

function MiniKpiCard({ label, value, color, delay, mounted }: { label: string; value: string; color: string; delay: number; mounted: boolean }) {
  return (
    <div
      className="flex-1 rounded-md border border-border/40 bg-background p-2 opacity-0 translate-y-1.5 transition-all duration-400 ease-out"
      style={mounted ? { opacity: 1, transform: 'translateY(0)', transitionDelay: `${delay}ms` } : undefined}
    >
      <div className="text-[8px] text-muted-foreground truncate">{label}</div>
      <div className={`text-[11px] font-bold ${color}`}>{value}</div>
    </div>
  );
}

export function AdministrationPreview() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const months = [
    { income: 65, expense: 45 },
    { income: 50, expense: 55 },
    { income: 70, expense: 40 },
    { income: 80, expense: 60 },
    { income: 55, expense: 50 },
    { income: 90, expense: 65 },
  ];

  return (
    <div className="px-4 py-3 space-y-2.5">
      {/* KPI row */}
      <div className="flex gap-2">
        <MiniKpiCard label="Ingresado" value="$2.4M" color="text-green-600" delay={100} mounted={mounted} />
        <MiniKpiCard label="Egresado" value="$1.8M" color="text-red-500" delay={200} mounted={mounted} />
        <MiniKpiCard label="Balance" value="$620K" color="text-blue-600" delay={300} mounted={mounted} />
      </div>
      {/* Mini cashflow chart */}
      <div
        className="rounded-md border border-border/40 bg-background p-2 opacity-0 translate-y-1.5 transition-all duration-400 ease-out"
        style={mounted ? { opacity: 1, transform: 'translateY(0)', transitionDelay: '350ms' } : undefined}
      >
        <div className="text-[8px] text-muted-foreground mb-1.5">Flujo de caja mensual</div>
        <div className="flex items-end gap-1 h-[52px]">
          {months.map((month, i) => (
            <div key={i} className="flex-1 flex items-end gap-px h-full">
              <div
                className="flex-1 rounded-t-sm bg-green-400/70 transition-all duration-500 ease-out"
                style={{
                  height: mounted ? `${month.income}%` : '0%',
                  transitionDelay: `${450 + i * 80}ms`,
                }}
              />
              <div
                className="flex-1 rounded-t-sm bg-red-400/70 transition-all duration-500 ease-out"
                style={{
                  height: mounted ? `${month.expense}%` : '0%',
                  transitionDelay: `${490 + i * 80}ms`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'].map((m) => (
            <span key={m} className="text-[7px] text-muted-foreground/60 flex-1 text-center">{m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReportsPreview() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const rubros = [
    { name: 'Albañilería', pct: 85, color: 'bg-blue-500' },
    { name: 'Electricidad', pct: 62, color: 'bg-amber-500' },
    { name: 'Sanitarios', pct: 45, color: 'bg-emerald-500' },
    { name: 'Pintura', pct: 28, color: 'bg-purple-500' },
  ];

  return (
    <div className="px-4 py-3 space-y-2.5">
      {/* KPI row */}
      <div className="flex gap-2">
        <MiniKpiCard label="Total gastado" value="$1.8M" color="text-emerald-600" delay={100} mounted={mounted} />
        <MiniKpiCard label="Comprobantes" value="47" color="text-purple-600" delay={200} mounted={mounted} />
        <MiniKpiCard label="Mayor gasto" value="Obra Centro" color="text-blue-600" delay={300} mounted={mounted} />
      </div>
      {/* Mini rubro bars */}
      <div
        className="rounded-md border border-border/40 bg-background p-2 space-y-1.5 opacity-0 translate-y-1.5 transition-all duration-400 ease-out"
        style={mounted ? { opacity: 1, transform: 'translateY(0)', transitionDelay: '350ms' } : undefined}
      >
        <div className="text-[8px] text-muted-foreground mb-1">Gasto por rubro</div>
        {rubros.map((rubro, i) => (
          <div key={rubro.name} className="flex items-center gap-2">
            <span className="text-[8px] text-muted-foreground w-14 truncate">{rubro.name}</span>
            <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
              <div
                className={`h-full rounded-full ${rubro.color}/70 transition-all duration-600 ease-out`}
                style={{
                  width: mounted ? `${rubro.pct}%` : '0%',
                  transitionDelay: `${500 + i * 100}ms`,
                }}
              />
            </div>
            <span className="text-[8px] font-medium text-muted-foreground w-6 text-right">{rubro.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
