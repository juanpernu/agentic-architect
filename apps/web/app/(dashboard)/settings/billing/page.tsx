'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { MP_PRICING } from '@/lib/mercadopago/pricing';
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

const ADVANCE_PRICING = MP_PRICING;

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
  const router = useRouter();
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
    { refreshInterval: 3000, onSuccess: () => mutate() }
  );

  // Clear ?checkout=pending once plan upgrades
  useEffect(() => {
    if (checkoutPending && plan !== 'free') {
      router.replace('/settings/billing', { scroll: false });
    }
  }, [checkoutPending, plan, router]);

  const [billingOption, setBillingOption] = useState<'monthly' | 'yearly'>('monthly');
  const [seatCount, setSeatCount] = useState(3);
  const [newSeatCount, setNewSeatCount] = useState(maxSeats ?? 1);
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

  const handleUpdateSeats = async () => {
    setActionLoading('seats');
    setActionError(null);
    try {
      const res = await fetch('/api/billing/update-seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatCount: newSeatCount }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error ?? 'Error al actualizar seats');
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

  const STATUS_LABELS: Record<string, string> = {
    active: 'ACTIVO',
    paused: 'PAUSADO',
    past_due: 'PAGO PENDIENTE',
    canceled: 'CANCELADO',
    trialing: 'PRUEBA',
  };
  const statusLabel = STATUS_LABELS[subscriptionStatus ?? ''] ?? (subscriptionStatus ?? '').toUpperCase();

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
          {/* Seat management */}
          <div className="mt-4 pt-4 border-t border-gray-700 relative z-10">
            <p className="text-sm text-gray-300 mb-2">Ajustar usuarios</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={20}
                value={newSeatCount}
                onChange={(e) => setNewSeatCount(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-sm font-medium w-8 text-center">{newSeatCount}</span>
              <button
                type="button"
                className="bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 text-white"
                onClick={handleUpdateSeats}
                disabled={actionLoading !== null || newSeatCount === maxSeats}
              >
                {actionLoading === 'seats' ? 'Actualizando...' : 'Actualizar'}
              </button>
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 transition-colors py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={actionLoading !== null}
                >
                  <XCircle className="h-4 w-4" />
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
                      className="mt-1 w-full accent-primary"
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
