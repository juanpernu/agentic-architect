'use client';

import { useState } from 'react';
import { CreditCard, ExternalLink, Zap, Building2, AlertTriangle, Star, CheckCircle2, Lock, ChevronDown } from 'lucide-react';
import { usePlan } from '@/lib/use-plan';
import { Button } from '@/components/ui/button';
import { LoadingCards } from '@/components/ui/loading-skeleton';

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

const FAQ_ITEMS = [
  {
    question: '¿Puedo cancelar en cualquier momento?',
    answer: 'Sí, puedes cancelar tu suscripción en cualquier momento desde la configuración de tu cuenta. El acceso continuará hasta el final del periodo de facturación actual.',
  },
  {
    question: '¿Cómo funciona la extracción con AI?',
    answer: 'Nuestra tecnología escanea tus tickets y facturas (fotos o PDF) y extrae automáticamente los datos como fecha, proveedor, montos e impuestos para categorizarlos.',
  },
];

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
    return <LoadingCards count={3} />;
  }

  return (
    <div className="space-y-6">
      {/* Past due warning */}
      {isPastDue && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="font-medium text-red-800 dark:text-red-200">Tu pago falló</p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Actualizá tu método de pago para mantener tu plan activo.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleManageSubscription}>
            Actualizar pago
          </Button>
        </div>
      )}

      {/* Current plan summary — dark gradient card (Advance) */}
      {plan === 'advance' && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-2xl" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Plan Actual</p>
              <h2 className="text-3xl font-bold tracking-tight">Advance</h2>
            </div>
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {subscriptionStatus === 'active' ? 'ACTIVO' : (subscriptionStatus ?? '').toUpperCase()}
            </span>
          </div>
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">
                {billingCycle === 'yearly' ? 'Renovación anual' : 'Renovación automática'}
              </span>
              {currentPeriodEnd && (
                <span className="font-medium">
                  {new Date(currentPeriodEnd).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                    style={{ width: `${Math.min(((currentProjects ?? 0) / 20) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">Usuarios</span>
                  <span className="font-medium">{currentSeats} / {maxSeats ?? '∞'}</span>
                </div>
                {maxSeats && (
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(((currentSeats ?? 0) / maxSeats) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-700 flex gap-3">
            <button
              type="button"
              className="flex-1 bg-white/10 hover:bg-white/20 transition-colors py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 text-white"
              onClick={handleManageSubscription}
              disabled={isRedirecting}
            >
              Historial de Pagos
            </button>
            <button
              type="button"
              className="flex-1 bg-white dark:bg-gray-100 text-gray-900 hover:bg-gray-100 dark:hover:bg-white transition-colors py-2.5 rounded-lg text-sm font-bold shadow-md disabled:opacity-50"
              onClick={handleManageSubscription}
              disabled={isRedirecting}
            >
              Gestionar
            </button>
          </div>
        </div>
      )}

      {/* Current plan summary — dark gradient card (Enterprise) */}
      {plan === 'enterprise' && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-2xl" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Plan Actual</p>
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
            <p className="text-gray-400 text-sm">
              Para cambios en tu plan, contactá a soporte.
            </p>
          </div>
        </div>
      )}

      {/* Pricing cards — shown for free and advance plans */}
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
            <div className={`rounded-xl border bg-card p-5 shadow-sm transition-transform active:scale-[0.99] ${
              isFreePlan ? 'border-primary' : 'border-border'
            }`}>
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
            <div className={`rounded-xl p-5 shadow-sm relative overflow-hidden transition-transform active:scale-[0.99] ${
              plan === 'advance'
                ? 'border-2 border-primary/30 bg-card'
                : 'border-2 border-primary/20 bg-card'
            }`}>
              {plan === 'advance' && (
                <div className="absolute top-0 right-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                  PLAN ACTUAL
                </div>
              )}
              <div className="mb-3">
                <h4 className={`text-lg font-bold flex items-center gap-2 ${plan === 'advance' ? 'text-primary' : ''}`}>
                  Advance
                  <Zap className="h-4 w-4 text-amber-500" />
                </h4>
                <span className="text-xl font-bold">
                  US${ADVANCE_PRICING[billingOption].base}
                  <span className="text-xs font-normal text-muted-foreground">
                    /{billingOption === 'monthly' ? 'mes' : 'año'}
                  </span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Para equipos en crecimiento</p>
              <p className="text-xs text-muted-foreground mb-4">
                + US${ADVANCE_PRICING[billingOption].seat}/usuario
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
                    <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
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
                  <Button className="w-full" onClick={handleUpgrade} disabled={isRedirecting}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {isRedirecting ? 'Redirigiendo...' : 'Elegir plan'}
                  </Button>
                  {upgradeError && (
                    <p className="mt-2 text-sm text-red-600">{upgradeError}</p>
                  )}
                </div>
              )}
              {plan === 'advance' && (
                <Button variant="outline" className="w-full bg-muted/50 text-muted-foreground" disabled>
                  Plan Seleccionado
                </Button>
              )}
            </div>

            {/* Enterprise — dark gradient card */}
            <div className="bg-gradient-to-b from-gray-900 to-gray-800 dark:from-gray-800 dark:to-black rounded-xl p-6 text-white shadow-xl">
              <div className="mb-1">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-400" />
                  Enterprise
                </h4>
                <span className="text-xl font-bold text-white">
                  Personalizado
                </span>
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
                <a
                  href="https://wa.me/TUNUMERO"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contactanos
                </a>
              </Button>
              <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> Procesado seguro con Stripe
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
              <p className="text-muted-foreground mt-3 text-sm">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
