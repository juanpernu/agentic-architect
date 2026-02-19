'use client';

import { useState } from 'react';
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

const ADVANCE_PRICING = {
  monthly: { base: 30, seat: 5 },
  yearly: { base: 300, seat: 50 },
} as const;

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

  const [upgradeError, setUpgradeError] = useState<string | null>(null);

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

      {/* Current plan summary for Advance */}
      {plan === 'advance' && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plan Advance
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
              <Button variant="outline" onClick={handleManageSubscription} disabled={isRedirecting}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Gestionar suscripción
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Enterprise summary */}
      {plan === 'enterprise' && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Plan Enterprise</CardTitle>
            <CardDescription>
              Proyectos ilimitados · Usuarios ilimitados · Soporte prioritario
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Para cambios en tu plan, contactá a soporte.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pricing cards — shown for free and advance plans */}
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
                <div>
                  <p className="text-3xl font-bold">
                    US${ADVANCE_PRICING[billingOption].base}
                    <span className="text-base font-normal text-muted-foreground">
                      /{billingOption === 'monthly' ? 'mes' : 'año'}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    + US${ADVANCE_PRICING[billingOption].seat}/usuario
                    {billingOption === 'monthly' ? '/mes' : '/año'}
                  </p>
                </div>
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
                      <div className="mt-2 rounded-md bg-muted/50 p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Base</span>
                          <span>US${ADVANCE_PRICING[billingOption].base}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {seatCount} usuario{seatCount > 1 ? 's' : ''} x US${ADVANCE_PRICING[billingOption].seat}
                          </span>
                          <span>US${ADVANCE_PRICING[billingOption].seat * seatCount}</span>
                        </div>
                        <div className="mt-1 flex justify-between border-t pt-1 font-medium">
                          <span>Total</span>
                          <span>
                            US${ADVANCE_PRICING[billingOption].base + ADVANCE_PRICING[billingOption].seat * seatCount}
                            /{billingOption === 'monthly' ? 'mes' : 'año'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      className="mt-4 w-full"
                      onClick={handleUpgrade}
                      disabled={isRedirecting}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      {isRedirecting ? 'Redirigiendo...' : 'Elegir plan'}
                    </Button>
                    {upgradeError && (
                      <p className="mt-2 text-sm text-red-600">{upgradeError}</p>
                    )}
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
