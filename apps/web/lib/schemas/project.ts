import { z } from 'zod';

export const projectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  address: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'paused', 'completed']),
  architect_id: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
});

export type ProjectFormData = z.infer<typeof projectSchema>;
