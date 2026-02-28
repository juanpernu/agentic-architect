import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { dbError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { searchParams } = req.nextUrl;
  const granularity = searchParams.get('granularity') === 'week' ? 'week' : 'month';

  const db = getDb();

  const since = new Date();
  if (granularity === 'week') {
    // Last 28 days for daily view
    since.setDate(since.getDate() - 28);
  } else {
    since.setMonth(since.getMonth() - 6);
  }

  const { data, error } = await db
    .from('expenses')
    .select('amount, date')
    .eq('org_id', ctx.orgId)
    .gte('date', since.toISOString().split('T')[0]);

  if (error) return dbError(error, 'select', { route: '/api/dashboard/spend-trend' });

  const bucketMap = new Map<string, number>();
  for (const expense of data ?? []) {
    // week → group by day (YYYY-MM-DD), month → group by month (YYYY-MM)
    const key = granularity === 'week'
      ? expense.date
      : expense.date.substring(0, 7);
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + Number(expense.amount));
  }

  // For daily view, fill in days with zero so the line is continuous
  if (granularity === 'week') {
    const today = new Date();
    for (let d = new Date(since); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      if (!bucketMap.has(key)) bucketMap.set(key, 0);
    }
  }

  const result = Array.from(bucketMap.entries())
    .map(([bucket, total]) => ({ bucket, total }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  return NextResponse.json(result);
}
