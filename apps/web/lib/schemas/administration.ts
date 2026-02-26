import { z } from 'zod';

// Income/Expense Type schemas
export const incomeTypeCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(100).transform(s => s.trim()),
});
export type IncomeTypeCreateInput = z.infer<typeof incomeTypeCreateSchema>;

export const incomeTypeUpdateSchema = incomeTypeCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});
export type IncomeTypeUpdateInput = z.infer<typeof incomeTypeUpdateSchema>;

export const expenseTypeCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(100).transform(s => s.trim()),
});
export type ExpenseTypeCreateInput = z.infer<typeof expenseTypeCreateSchema>;

export const expenseTypeUpdateSchema = expenseTypeCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});
export type ExpenseTypeUpdateInput = z.infer<typeof expenseTypeUpdateSchema>;

// Income schemas
export const incomeCreateSchema = z.object({
  project_id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
  income_type_id: z.string().uuid(),
  description: z.string().nullable().optional().transform(v => v?.trim() || null),
});
export type IncomeCreateInput = z.infer<typeof incomeCreateSchema>;

export const incomeUpdateSchema = incomeCreateSchema.partial();
export type IncomeUpdateInput = z.infer<typeof incomeUpdateSchema>;

// Expense schemas
export const expenseCreateSchema = z.object({
  project_id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
  expense_type_id: z.string().uuid(),
  rubro_id: z.string().uuid().nullable().optional(),
  receipt_id: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional().transform(v => v?.trim() || null),
});
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

export const expenseUpdateSchema = expenseCreateSchema.partial();
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
