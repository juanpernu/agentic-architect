'use client';

import { createContext, useContext } from 'react';
import type { OnboardingStep } from '@architech/shared';

export type OnboardingVariant = 'creator' | 'viewer';

export interface OnboardingContextValue {
  step: OnboardingStep;
  isActive: boolean;
  variant: OnboardingVariant;
  projectId: string | null;
  setProjectId: (id: string) => void;
  nextStep: () => void;
  goToStep: (step: OnboardingStep) => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue | null {
  return useContext(OnboardingContext);
}
