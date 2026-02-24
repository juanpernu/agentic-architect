export const UserRole = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  ARCHITECT: 'architect',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ProjectStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const PROJECT_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export const CURRENCIES = ['ARS', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const SubscriptionPlan = {
  FREE: 'free',
  ADVANCE: 'advance',
  ENTERPRISE: 'enterprise',
} as const;

export const SubscriptionStatus = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  TRIALING: 'trialing',
} as const;
