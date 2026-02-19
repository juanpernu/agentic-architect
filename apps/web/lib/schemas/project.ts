import { z } from 'zod';
import { PROJECT_COLORS } from '@architech/shared';

export const projectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  address: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'paused', 'completed']),
  architect_id: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

// API schemas
export const projectCreateSchema = z.object({
  name: z.string().min(1, 'name is required').transform(s => s.trim()),
  address: z.string().nullish().transform(v => v?.trim() || null),
  status: z.enum(['active', 'paused', 'completed']).optional().default('active'),
  architect_id: z.string().uuid().nullish().transform(v => v || null),
  color: z.enum(PROJECT_COLORS).nullish().transform(v => v || null),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = projectCreateSchema.partial();
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
