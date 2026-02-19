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

// API schema
const MAX_FIELD_LENGTH = 500;
const optionalField = z.string().max(MAX_FIELD_LENGTH).nullish().transform(v => v?.trim() || null);

export const organizationUpdateSchema = z.object({
  name: z.string().min(1).max(MAX_FIELD_LENGTH).transform(s => s.trim()).optional(),
  contact_email: z.string().email().max(MAX_FIELD_LENGTH).nullish().transform(v => v?.trim() || null),
  phone: optionalField,
  website: z.string().url().max(MAX_FIELD_LENGTH).nullish().transform(v => v?.trim() || null),
  address_street: optionalField,
  address_locality: optionalField,
  address_province: optionalField,
  address_postal_code: optionalField,
  social_instagram: optionalField,
  social_linkedin: optionalField,
});

export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;
