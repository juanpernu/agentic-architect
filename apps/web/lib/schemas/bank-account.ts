import { z } from 'zod';

export const bankAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  bank_name: z.string().min(1, 'El banco es requerido').max(100, 'Máximo 100 caracteres'),
  cbu: z
    .string()
    .regex(/^\d{22}$/, 'El CBU debe tener 22 dígitos')
    .optional()
    .or(z.literal('')),
  alias: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
});
