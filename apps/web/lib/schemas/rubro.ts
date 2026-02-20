import { z } from 'zod';

export const rubroCreateSchema = z.object({
  budget_id: z.string().uuid(),
  name: z.string().min(1, 'El nombre es requerido').max(100).trim(),
  color: z.string().nullable().optional(),
});

export const rubroUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  color: z.string().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export type RubroCreateInput = z.infer<typeof rubroCreateSchema>;
export type RubroUpdateInput = z.infer<typeof rubroUpdateSchema>;
