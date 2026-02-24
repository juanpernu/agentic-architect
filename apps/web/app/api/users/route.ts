import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { dbError } from '@/lib/api-error';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  // Only admins can list users
  if (ctx.role !== 'admin') return forbidden();

  const db = getDb();

  const { data, error } = await db
    .from('users')
    .select('id, clerk_user_id, organization_id, role, full_name, email, avatar_url, is_active, created_at')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false });

  if (error) {
    return dbError(error, 'select', { route: '/api/users' });
  }

  return NextResponse.json(data ?? []);
}
