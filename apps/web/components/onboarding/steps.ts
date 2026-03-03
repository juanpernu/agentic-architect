import type { OnboardingStep } from '@architech/shared';

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
