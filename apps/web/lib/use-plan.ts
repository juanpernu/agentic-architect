'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { PLAN_LIMITS } from '@architech/shared/plans';

interface PlanData {
  plan: 'free' | 'advance' | 'enterprise';
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing';
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  maxSeats: number | null;
  currentSeats: number;
  currentProjects: number;
  limits: (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];
}

export function usePlan() {
  const { data, isLoading, error, mutate } = useSWR<PlanData>(
    '/api/billing/plan',
    fetcher
  );

  const plan = data?.plan ?? 'free';
  const limits = data?.limits ?? PLAN_LIMITS.free;

  const canCreateProject =
    limits.maxProjects === Infinity ||
    (data?.currentProjects ?? 0) < limits.maxProjects;

  const canInviteUser =
    data?.maxSeats === null ||
    data?.maxSeats === Infinity ||
    (data?.currentSeats ?? 0) < (data?.maxSeats ?? 1);

  const canViewAdministration = limits.administration === true;

  return {
    plan,
    limits,
    subscriptionStatus: data?.subscriptionStatus ?? 'active',
    billingCycle: data?.billingCycle,
    currentPeriodEnd: data?.currentPeriodEnd,
    maxSeats: data?.maxSeats,
    currentSeats: data?.currentSeats ?? 0,
    currentProjects: data?.currentProjects ?? 0,
    canCreateProject,
    canInviteUser,
    canViewAdministration,
    isFreePlan: plan === 'free',
    isPastDue: data?.subscriptionStatus === 'past_due',
    isLoading,
    error,
    mutate,
  };
}
