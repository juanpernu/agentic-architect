import { z } from 'zod';

export const inviteSchema = z.object({
  email: z.string().min(1, 'El email es requerido').email('Email inválido'),
  role: z.string().min(1, 'El rol es requerido'),
});

export type InviteFormData = z.infer<typeof inviteSchema>;
