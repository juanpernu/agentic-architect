'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { fetcher } from '@/lib/fetcher';
import { OnboardingContext } from '@/lib/use-onboarding';
import type { OnboardingVariant } from '@/lib/use-onboarding';
import { useCurrentUser } from '@/lib/use-current-user';
import { OnboardingWelcome } from './welcome';
import { OnboardingSummary } from './summary';
import { OnboardingOverlay } from './overlay';
import { OnboardingTooltip } from './tooltip';
import { OnboardingSnackbar } from './snackbar';
import type { OnboardingStep } from '@architech/shared';

interface OnboardingState {
  step: OnboardingStep;
  completedAt: string | null;
}

export const CREATOR_STEPS: OnboardingStep[] = [
  'welcome', 'tour-1', 'tour-2', 'tour-3', 'tour-4', 'tour-5', 'tour-6', 'summary', 'completed',
];

export const VIEWER_STEPS: OnboardingStep[] = [
  'welcome', 'tour-1', 'tour-2', 'tour-3', 'summary', 'completed',
];

// Map step → expected route prefix (used by snackbar for resume logic)
export const STEP_ROUTES: Partial<Record<OnboardingStep, string>> = {
  'tour-1': '/projects',
  'tour-2': '/projects',
  'tour-3': '/projects/',
  'tour-4': '/projects/',
  'tour-5': '/budgets/',
  'tour-6': '/projects/',
};

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdminOrSupervisor, isLoaded: userLoaded } = useCurrentUser();
  const variant: OnboardingVariant = isAdminOrSupervisor ? 'creator' : 'viewer';
  const stepsForVariant = variant === 'creator' ? CREATOR_STEPS : VIEWER_STEPS;

  const { data, isLoading } = useSWR<OnboardingState>('/api/onboarding', fetcher);
  const [step, setStep] = useState<OnboardingStep>('completed');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (data && !isHydrated) {
      setStep(data.step as OnboardingStep);
      setIsHydrated(true);
    }
  }, [data, isHydrated]);

  const persistStep = useCallback(async (newStep: OnboardingStep) => {
    const prevStep = step;
    setStep(newStep);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: newStep }),
      });
      if (!res.ok) throw new Error(`Failed to persist onboarding step: ${res.status}`);
      globalMutate('/api/onboarding');
    } catch (err) {
      console.error('Failed to persist onboarding step:', err);
      setStep(prevStep);
    }
  }, [step]);

  const nextStep = useCallback(() => {
    const currentIndex = stepsForVariant.indexOf(step);
    if (currentIndex < stepsForVariant.length - 1) {
      const next = stepsForVariant[currentIndex + 1];
      persistStep(next);
    }
  }, [step, stepsForVariant, persistStep]);

  const goToStep = useCallback((newStep: OnboardingStep) => {
    persistStep(newStep);
  }, [persistStep]);

  const skipOnboarding = useCallback(async () => {
    await persistStep('completed');
  }, [persistStep]);

  const completeOnboarding = useCallback(async () => {
    await persistStep('completed');
    router.push('/');
  }, [persistStep, router]);

  const isActive = step !== 'completed' && isHydrated;

  const expectedRoute = STEP_ROUTES[step];
  const isOnExpectedRoute = !expectedRoute || pathname.startsWith(expectedRoute);
  const showSnackbar = isActive && !isOnExpectedRoute && step !== 'welcome' && step !== 'summary';

  const contextValue = useMemo(
    () => ({
      step,
      isActive,
      variant,
      projectId,
      setProjectId,
      nextStep,
      goToStep,
      skipOnboarding,
      completeOnboarding,
    }),
    [step, isActive, variant, projectId, nextStep, goToStep, skipOnboarding, completeOnboarding]
  );

  if (isLoading || !isHydrated) {
    return (
      <OnboardingContext.Provider value={contextValue}>
        {children}
      </OnboardingContext.Provider>
    );
  }

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}

      {/* Step: welcome */}
      <OnboardingWelcome
        open={step === 'welcome'}
        variant={variant}
        onComplete={() => {
          persistStep('tour-1');
          router.push('/projects');
        }}
        onSkip={skipOnboarding}
      />

      {/* ===== CREATOR STEPS (admin/supervisor) ===== */}

      {step === 'tour-1' && variant === 'creator' && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="nav-projects"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="nav-projects"]'
            title="Empezá acá"
            description="Creá tu primer proyecto para organizar una obra."
            ctaLabel="Ir a Proyectos"
            onCtaClick={() => {
              persistStep('tour-2');
              router.push('/projects');
            }}
            onSkip={skipOnboarding}
            side="right"
            currentStep={1}
            totalSteps={6}
          />
        </>
      )}

      {step === 'tour-2' && variant === 'creator' && pathname === '/projects' && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="create-project"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="create-project"]'
            title="Nuevo proyecto"
            description="Hacé click acá para crear tu primer proyecto."
            onSkip={skipOnboarding}
            side="bottom"
            currentStep={2}
            totalSteps={6}
          />
        </>
      )}

      {step === 'tour-3' && variant === 'creator' && pathname.startsWith('/projects/') && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="project-stats"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="project-stats"]'
            title="Vista del proyecto"
            description="Acá vas a ver el resumen financiero: presupuestado, gasto real y disponible. Ahora creemos un presupuesto."
            ctaLabel="Crear presupuesto"
            onCtaClick={() => persistStep('tour-4')}
            onSkip={skipOnboarding}
            side="bottom"
            currentStep={3}
            totalSteps={6}
          />
        </>
      )}

      {/* tour-4 is handled by the project detail page which reads onboarding context */}

      {step === 'tour-5' && variant === 'creator' && pathname.startsWith('/budgets/') && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="budget-editor"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="budget-editor"]'
            title="Editor de presupuesto"
            description="Podés agregar rubros (ej: Albañilería, Electricidad), items dentro de cada rubro, y Agentect guarda automáticamente cada cambio."
            ctaLabel="Entendido, volver al proyecto"
            onCtaClick={() => {
              persistStep('tour-6');
              if (projectId) router.push(`/projects/${projectId}`);
            }}
            onSkip={skipOnboarding}
            side="bottom"
            currentStep={5}
            totalSteps={6}
          />
        </>
      )}

      {/* ===== VIEWER STEPS (architect) ===== */}

      {step === 'tour-1' && variant === 'viewer' && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="nav-projects"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="nav-projects"]'
            title="Tus proyectos"
            description="Acá vas a ver los proyectos que te asignaron."
            ctaLabel="Ver Proyectos"
            onCtaClick={() => {
              persistStep('tour-2');
              router.push('/projects');
            }}
            onSkip={skipOnboarding}
            side="right"
            currentStep={1}
            totalSteps={3}
          />
        </>
      )}

      {step === 'tour-2' && variant === 'viewer' && pathname === '/projects' && (
        <OnboardingTooltip
          targetSelector='[data-onboarding="projects-list"]'
          title="Mis proyectos"
          description="Solo vas a ver los proyectos donde estés asignado como arquitecto. Desde acá podés ver comprobantes y presupuestos de cada obra."
          ctaLabel="Siguiente"
          onCtaClick={() => persistStep('tour-3')}
          onSkip={skipOnboarding}
          side="bottom"
          currentStep={2}
          totalSteps={3}
        />
      )}

      {step === 'tour-3' && variant === 'viewer' && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="nav-upload"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="nav-upload"]'
            title="Comprobantes con IA"
            description="Podés cargar comprobantes sacándole una foto. La IA extrae proveedor, monto y CUIT automáticamente."
            ctaLabel="Siguiente"
            onCtaClick={() => persistStep('summary')}
            onSkip={skipOnboarding}
            side="right"
            currentStep={3}
            totalSteps={3}
          />
        </>
      )}

      {/* tour-6 (creator only) -- back to project, show budget impacted */}
      {step === 'tour-6' && variant === 'creator' && pathname.startsWith('/projects/') && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="project-stats"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="project-stats"]'
            title="Presupuesto impactado"
            description="Ya podés ver tu presupuesto acá. A medida que cargues comprobantes, vas a ver el gasto real vs. presupuestado."
            ctaLabel="Siguiente"
            onCtaClick={() => persistStep('summary')}
            onSkip={skipOnboarding}
            side="bottom"
            currentStep={6}
            totalSteps={6}
          />
        </>
      )}

      {/* Step: summary */}
      <OnboardingSummary
        open={step === 'summary'}
        variant={variant}
        onComplete={completeOnboarding}
      />

      {showSnackbar && (
        <OnboardingSnackbar
          onResume={() => {
            if (step === 'tour-1' || step === 'tour-2') router.push('/projects');
            else if (step === 'tour-3' || step === 'tour-4' || step === 'tour-6') {
              if (projectId) router.push(`/projects/${projectId}`);
              else router.push('/projects');
            }
            else if (step === 'tour-5') router.push('/budgets');
          }}
          onDismiss={skipOnboarding}
        />
      )}
    </OnboardingContext.Provider>
  );
}
