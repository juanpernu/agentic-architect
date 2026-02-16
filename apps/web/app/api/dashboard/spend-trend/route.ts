import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  // Last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data, error } = await db
    .from('receipts')
    .select('total_amount, receipt_date, projects!inner(organization_id)')
    .eq('projects.organization_id', ctx.orgId)
    .eq('status', 'confirmed')
    .gte('receipt_date', sixMonthsAgo.toISOString().split('T')[0]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by month
  const monthMap = new Map<string, number>();
  for (const receipt of data ?? []) {
    const month = receipt.receipt_date.substring(0, 7); // YYYY-MM
    monthMap.set(month, (monthMap.get(month) ?? 0) + Number(receipt.total_amount));
  }

  const result = Array.from(monthMap.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json(result);
}
