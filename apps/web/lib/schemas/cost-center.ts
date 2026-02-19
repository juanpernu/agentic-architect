import { z } from 'zod';
import { PROJECT_COLORS } from '@architech/shared';

export const costCenterSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  description: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
});

export type CostCenterFormData = z.infer<typeof costCenterSchema>;

// API schemas
export const costCenterCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(100).transform(s => s.trim()),
  description: z.string().nullish().transform(v => v?.trim() || null),
  color: z.enum(PROJECT_COLORS).nullish().transform(v => v || null),
});

export type CostCenterCreateInput = z.infer<typeof costCenterCreateSchema>;

export const costCenterUpdateSchema = costCenterCreateSchema.partial();
export type CostCenterUpdateInput = z.infer<typeof costCenterUpdateSchema>;
