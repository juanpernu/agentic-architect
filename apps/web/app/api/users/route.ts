import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  // Only admins can list users
  if (ctx.role !== 'admin') return forbidden();

  const db = getDb();

  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
