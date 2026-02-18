import { z } from 'zod';

export const organizationSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  address_street: z.string().optional().or(z.literal('')),
  address_locality: z.string().optional().or(z.literal('')),
  address_province: z.string().optional().or(z.literal('')),
  address_postal_code: z.string().optional().or(z.literal('')),
  social_instagram: z.string().optional().or(z.literal('')),
  social_linkedin: z.string().optional().or(z.literal('')),
});

export type OrganizationFormData = z.infer<typeof organizationSchema>;
