import { z } from 'zod';

// Income schemas
export const incomeCreateSchema = z.object({
  project_id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
  category: z.string().min(1, 'category is required').max(100).transform(s => s.trim()),
  description: z.string().optional().transform(v => v?.trim() || null),
});
export type IncomeCreateInput = z.infer<typeof incomeCreateSchema>;

export const incomeUpdateSchema = incomeCreateSchema.partial();
export type IncomeUpdateInput = z.infer<typeof incomeUpdateSchema>;

// Expense schemas
export const expenseCreateSchema = z.object({
  project_id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
  category: z.string().min(1, 'category is required').max(100).transform(s => s.trim()),
  rubro_id: z.string().uuid().nullable().optional(),
  receipt_id: z.string().uuid().nullable().optional(),
  description: z.string().optional().transform(v => v?.trim() || null),
});
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

export const expenseUpdateSchema = expenseCreateSchema.partial();
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
