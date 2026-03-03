import { describe, it, expect } from 'vitest';
import { ONBOARDING_STEPS } from '@architech/shared';
import { CREATOR_STEPS, VIEWER_STEPS, STEP_ROUTES } from '../provider';

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
    expect(STEP_ROUTES['tour-1']).toBe('/');
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
