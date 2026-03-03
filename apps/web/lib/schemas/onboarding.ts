import { z } from 'zod';
import { ONBOARDING_STEPS } from '@architech/shared';

export const onboardingUpdateSchema = z.object({
  step: z.enum(ONBOARDING_STEPS),
});

export type OnboardingUpdateInput = z.infer<typeof onboardingUpdateSchema>;
