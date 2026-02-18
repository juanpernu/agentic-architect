import { z } from 'zod';

export const receiptReviewSchema = z.object({
  vendor: z.string().min(1, 'El proveedor es requerido'),
  date: z.string().min(1, 'La fecha es requerida'),
  total: z.string().refine((v) => parseFloat(v) > 0, 'El total debe ser mayor a 0'),
  projectId: z.string().min(1, 'Debes seleccionar un proyecto'),
  costCenterId: z.string().min(1, 'Debes seleccionar un centro de costos'),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unit_price: z.number(),
    subtotal: z.number(),
  })).min(1, 'Debes tener al menos un ítem'),
});

export type ReceiptReviewFormData = z.infer<typeof receiptReviewSchema>;
