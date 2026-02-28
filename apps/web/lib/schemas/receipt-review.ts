import { z } from 'zod';

const itemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  subtotal: z.number(),
});

const baseFields = {
  vendor: z.string().min(1, 'El proveedor es requerido'),
  date: z.string().min(1, 'La fecha es requerida'),
  total: z.string().refine((v) => parseFloat(v) > 0, 'El total debe ser mayor a 0'),
  projectId: z.string().min(1, 'Debes seleccionar un proyecto'),
  receiptNumber: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Debes tener al menos un ítem'),
};

export const receiptReviewSchema = z.discriminatedUnion('category', [
  z.object({
    ...baseFields,
    category: z.literal('expense'),
    rubroId: z.string().min(1, 'Debes seleccionar un rubro'),
    paidById: z.string().min(1, 'Debes seleccionar quién pagó'),
  }),
  z.object({
    ...baseFields,
    category: z.literal('income'),
  }),
]);

export type ReceiptReviewFormData = z.infer<typeof receiptReviewSchema>;
