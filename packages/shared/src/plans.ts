export const PLAN_LIMITS = {
  free: {
    maxProjects: 1,
    maxReceiptsPerProject: 20,
    maxSeats: 1,
    reports: false,
    administration: false,
    prioritySupport: false,
  },
  advance: {
    maxProjects: 20,
    maxReceiptsPerProject: Infinity,
    maxSeats: null, // dynamic — uses org.max_seats from Stripe
    reports: true,
    administration: true,
    prioritySupport: false,
  },
  enterprise: {
    maxProjects: Infinity,
    maxReceiptsPerProject: Infinity,
    maxSeats: Infinity,
    reports: true,
    administration: true,
    prioritySupport: true,
  },
} as const;

export type SubscriptionPlan = keyof typeof PLAN_LIMITS;

export type PlanLimits = (typeof PLAN_LIMITS)[SubscriptionPlan];
