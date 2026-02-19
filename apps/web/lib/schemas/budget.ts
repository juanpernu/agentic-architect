import { z } from 'zod';

export const budgetItemSchema = z.object({
  description: z.string().min(1, 'La descripción es requerida'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unit: z.string().min(1, 'La unidad es requerida'),
  unit_price: z.number().min(0, 'El precio unitario debe ser mayor o igual a 0'),
  subtotal: z.number(),
});

export const budgetSectionSchema = z.object({
  cost_center_id: z.string().uuid(),
  cost_center_name: z.string(),
  subtotal: z.number(),
  items: z.array(budgetItemSchema).min(1, 'Cada rubro debe tener al menos un ítem'),
});

export const budgetSnapshotSchema = z.object({
  sections: z.array(budgetSectionSchema).min(1, 'El presupuesto debe tener al menos un rubro'),
});

export type BudgetSnapshotFormData = z.infer<typeof budgetSnapshotSchema>;
