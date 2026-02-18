import { z } from 'zod';

export const costCenterSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  description: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
});

export type CostCenterFormData = z.infer<typeof costCenterSchema>;
