import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { dbError } from '@/lib/api-error';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  // Architects cannot access org members list
  if (ctx.role === 'architect') return forbidden();

  const db = getDb();

  const { data, error } = await db
    .from('users')
    .select('id, full_name')
    .eq('organization_id', ctx.orgId)
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) {
    return dbError(error, 'select', { route: '/api/org-members' });
  }

  return NextResponse.json(data ?? []);
}
