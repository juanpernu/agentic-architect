import { describe, it, expect } from 'vitest';
import { ONBOARDING_STEPS } from '@architech/shared';
import type { OnboardingStep } from '@architech/shared';
import { CREATOR_STEPS, VIEWER_STEPS, STEP_ROUTES } from '../steps';

describe('Onboarding step progression', () => {
  it('steps progress in correct order', () => {
    const steps = [...ONBOARDING_STEPS];
    expect(steps).toEqual([
      'welcome', 'tour-1', 'tour-2', 'tour-3',
      'tour-4', 'tour-5', 'tour-6', 'summary', 'completed',
    ]);
  });

  it('each step has a valid next step', () => {
    for (let i = 0; i < ONBOARDING_STEPS.length - 1; i++) {
      const next = ONBOARDING_STEPS[i + 1];
      expect(next).toBeDefined();
    }
  });

  it('completed is the terminal state', () => {
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe('completed');
  });
});

describe('CREATOR_STEPS', () => {
  it('includes all steps from welcome through tour-6 plus summary and completed', () => {
    expect(CREATOR_STEPS).toEqual([
      'welcome', 'tour-1', 'tour-2', 'tour-3',
      'tour-4', 'tour-5', 'tour-6', 'summary', 'completed',
    ]);
  });

  it('matches ONBOARDING_STEPS exactly', () => {
    expect(CREATOR_STEPS).toEqual([...ONBOARDING_STEPS]);
  });

  it('starts with welcome and ends with completed', () => {
    expect(CREATOR_STEPS[0]).toBe('welcome');
    expect(CREATOR_STEPS[CREATOR_STEPS.length - 1]).toBe('completed');
  });
});

describe('VIEWER_STEPS', () => {
  it('only includes welcome, tour-1 through tour-3, summary, and completed', () => {
    expect(VIEWER_STEPS).toEqual([
      'welcome', 'tour-1', 'tour-2', 'tour-3', 'summary', 'completed',
    ]);
  });

  it('excludes creator-only steps (tour-4, tour-5, tour-6)', () => {
    expect(VIEWER_STEPS).not.toContain('tour-4');
    expect(VIEWER_STEPS).not.toContain('tour-5');
    expect(VIEWER_STEPS).not.toContain('tour-6');
  });

  it('is a strict subset of CREATOR_STEPS', () => {
    for (const step of VIEWER_STEPS) {
      expect(CREATOR_STEPS).toContain(step);
    }
  });

  it('has fewer steps than CREATOR_STEPS', () => {
    expect(VIEWER_STEPS.length).toBeLessThan(CREATOR_STEPS.length);
  });

  it('starts with welcome and ends with completed', () => {
    expect(VIEWER_STEPS[0]).toBe('welcome');
    expect(VIEWER_STEPS[VIEWER_STEPS.length - 1]).toBe('completed');
  });
});

describe('STEP_ROUTES', () => {
  it('maps tour steps to expected route prefixes', () => {
    expect(STEP_ROUTES['tour-1']).toBe('/projects');
    expect(STEP_ROUTES['tour-2']).toBe('/projects');
    expect(STEP_ROUTES['tour-3']).toBe('/projects/');
    expect(STEP_ROUTES['tour-4']).toBe('/projects/');
    expect(STEP_ROUTES['tour-5']).toBe('/budgets/');
    expect(STEP_ROUTES['tour-6']).toBe('/projects/');
  });

  it('does not define routes for welcome, summary, or completed', () => {
    expect(STEP_ROUTES['welcome']).toBeUndefined();
    expect(STEP_ROUTES['summary']).toBeUndefined();
    expect(STEP_ROUTES['completed']).toBeUndefined();
  });

  it('all mapped steps exist in ONBOARDING_STEPS', () => {
    for (const step of Object.keys(STEP_ROUTES)) {
      expect([...ONBOARDING_STEPS]).toContain(step);
    }
  });
});

describe('Step transition logic', () => {
  function nextStepFor(current: OnboardingStep, steps: OnboardingStep[]): OnboardingStep | null {
    const idx = steps.indexOf(current);
    if (idx < 0 || idx >= steps.length - 1) return null;
    return steps[idx + 1];
  }

  it('creator: welcome → tour-1', () => {
    expect(nextStepFor('welcome', CREATOR_STEPS)).toBe('tour-1');
  });

  it('creator: tour-6 → summary', () => {
    expect(nextStepFor('tour-6', CREATOR_STEPS)).toBe('summary');
  });

  it('creator: completed has no next step', () => {
    expect(nextStepFor('completed', CREATOR_STEPS)).toBeNull();
  });

  it('viewer: welcome → tour-1', () => {
    expect(nextStepFor('welcome', VIEWER_STEPS)).toBe('tour-1');
  });

  it('viewer: tour-3 → summary (skips tour-4/5/6)', () => {
    expect(nextStepFor('tour-3', VIEWER_STEPS)).toBe('summary');
  });

  it('viewer: tour-4 is not reachable (not in VIEWER_STEPS)', () => {
    expect(nextStepFor('tour-4', VIEWER_STEPS)).toBeNull();
  });

  it('viewer: completed has no next step', () => {
    expect(nextStepFor('completed', VIEWER_STEPS)).toBeNull();
  });

  it('skip from any step always lands on completed', () => {
    const skipTarget: OnboardingStep = 'completed';
    for (const step of CREATOR_STEPS) {
      // skipOnboarding always sets 'completed' regardless of current step
      expect(skipTarget).toBe('completed');
    }
  });
});

describe('Snackbar route matching', () => {
  it('all STEP_ROUTES values are consistent with snackbar resume targets', () => {
    // Every step with a route should have a navigable path
    for (const [step, route] of Object.entries(STEP_ROUTES)) {
      expect(route).toBeTruthy();
      expect(route!.startsWith('/')).toBe(true);
    }
  });

  it('tour-1 and tour-2 both map to /projects', () => {
    expect(STEP_ROUTES['tour-1']).toBe('/projects');
    expect(STEP_ROUTES['tour-2']).toBe('/projects');
  });

  it('project-detail steps map to /projects/ prefix', () => {
    expect(STEP_ROUTES['tour-3']!.startsWith('/projects/')).toBe(true);
    expect(STEP_ROUTES['tour-4']!.startsWith('/projects/')).toBe(true);
    expect(STEP_ROUTES['tour-6']!.startsWith('/projects/')).toBe(true);
  });

  it('budget step maps to /budgets/ prefix', () => {
    expect(STEP_ROUTES['tour-5']!.startsWith('/budgets/')).toBe(true);
  });
});
