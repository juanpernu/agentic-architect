import { z } from 'zod';

export const budgetItemSchema = z.object({
  description: z.string(),
  unit: z.string(),
  quantity: z.number().min(0),
  cost: z.number().min(0),
  subtotal: z.number().min(0),
});

export const budgetSectionSchema = z.object({
  cost_center_id: z.string().uuid(),
  cost_center_name: z.string(),
  is_additional: z.boolean(),
  items: z.array(budgetItemSchema).min(1),
});

export const budgetSnapshotSchema = z.object({
  sections: z.array(budgetSectionSchema).min(1),
});

export type BudgetSnapshotFormData = z.infer<typeof budgetSnapshotSchema>;
