import { z } from 'zod';
import { CURRENCIES } from '@architech/shared';

export const bankAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  bank_name: z.string().min(1, 'El banco es requerido'),
  cbu: z.string().optional().or(z.literal('')),
  alias: z.string().optional().or(z.literal('')),
  currency: z.enum(CURRENCIES),
});

export type BankAccountFormData = z.infer<typeof bankAccountSchema>;

// API schemas
export const bankAccountCreateSchema = z.object({
  name: z.string().min(1, 'name is required').transform(s => s.trim()),
  bank_name: z.string().min(1, 'bank_name is required').transform(s => s.trim()),
  cbu: z.string().nullish().transform(v => v?.trim() || null),
  alias: z.string().nullish().transform(v => v?.trim() || null),
  currency: z.enum(CURRENCIES).optional().default('ARS'),
});

export type BankAccountCreateInput = z.infer<typeof bankAccountCreateSchema>;

export const bankAccountUpdateSchema = bankAccountCreateSchema.partial();
export type BankAccountUpdateInput = z.infer<typeof bankAccountUpdateSchema>;
