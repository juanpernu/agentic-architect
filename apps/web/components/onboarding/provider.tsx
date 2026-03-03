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

const CREATOR_STEPS: OnboardingStep[] = [
  'welcome', 'tour-1', 'tour-2', 'tour-3', 'tour-4', 'tour-5', 'tour-6', 'summary', 'completed',
];

const VIEWER_STEPS: OnboardingStep[] = [
  'welcome', 'tour-1', 'tour-2', 'tour-3', 'summary', 'completed',
];

// Map step → expected route prefix (used by snackbar for resume logic)
export const STEP_ROUTES: Partial<Record<OnboardingStep, string>> = {
  'tour-1': '/',
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
    setStep(newStep);
    await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: newStep }),
    });
    globalMutate('/api/onboarding');
  }, []);

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

  const skipOnboarding = useCallback(() => {
    persistStep('completed');
  }, [persistStep]);

  const completeOnboarding = useCallback(() => {
    persistStep('completed');
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
            title="Empeza aca"
            description="Crea tu primer proyecto para organizar una obra."
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
            description="Hace click aca para crear tu primer proyecto."
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
            description="Aca vas a ver el resumen financiero: presupuestado, gasto real y disponible. Ahora creemos un presupuesto."
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
            description="Podes agregar rubros (ej: Albanileria, Electricidad), items dentro de cada rubro, y Agentect guarda automaticamente cada cambio."
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
            description="Aca vas a ver los proyectos que te asignaron."
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
          description="Solo vas a ver los proyectos donde estes asignado como arquitecto. Desde aca podes ver comprobantes y presupuestos de cada obra."
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
            description="Podes cargar comprobantes sacandole una foto. La IA extrae proveedor, monto y CUIT automaticamente."
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
            description="Ya podes ver tu presupuesto aca. A medida que cargues comprobantes, vas a ver el gasto real vs. presupuestado."
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
