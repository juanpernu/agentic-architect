import { z } from 'zod';

export const budgetItemSchema = z.object({
  description: z.string(),
  unit: z.string(),
  quantity: z.number().min(0),
  cost: z.number().min(0),
  subtotal: z.number().min(0),
});

export const budgetSectionSchema = z.object({
  rubro_id: z.string().uuid(),
  rubro_name: z.string(),
  is_additional: z.boolean(),
  subtotal: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  items: z.array(budgetItemSchema),
});

export const budgetSnapshotSchema = z.object({
  sections: z.array(budgetSectionSchema),
});

export type BudgetSnapshotFormData = z.infer<typeof budgetSnapshotSchema>;
