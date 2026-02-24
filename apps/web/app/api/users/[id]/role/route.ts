import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { UserRole } from '@architech/shared';
import { validateBody } from '@/lib/validate';
import { dbError } from '@/lib/api-error';

const roleUpdateSchema = z.object({
  role: z.enum(['admin', 'supervisor', 'architect']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  // Only admins can change roles
  if (ctx.role !== 'admin') return forbidden();

  // Guard incomplete session metadata
  if (!ctx.dbUserId) {
    return NextResponse.json(
      { error: 'Sesión incompleta. Por favor, cerrá sesión y volvé a iniciar.' },
      { status: 500 }
    );
  }

  const { id } = await params;

  // Prevent changing own role to avoid locking yourself out
  if (id === ctx.dbUserId) {
    return NextResponse.json(
      { error: 'No puedes cambiar tu propio rol' },
      { status: 400 }
    );
  }

  const result = await validateBody(roleUpdateSchema, req);
  if ('error' in result) return result.error;

  const { role } = result.data;

  const db = getDb();

  // Update user role (ensure it's in the same organization)
  const { data, error } = await db
    .from('users')
    .update({ role: role as UserRole })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) {
    return dbError(error, 'update', { route: '/api/users/[id]/role' });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Usuario no encontrado' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
