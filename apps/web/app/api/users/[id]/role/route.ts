import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { UserRole } from '@obralink/shared';

const VALID_ROLES = ['admin', 'supervisor', 'architect'] as const;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  // Only admins can change roles
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await context.params;

  // Prevent changing own role to avoid locking yourself out
  if (id === ctx.dbUserId) {
    return NextResponse.json(
      { error: 'No puedes cambiar tu propio rol' },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { role } = body;

  // Validate role
  if (!role || !VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json(
      { error: 'Rol inválido. Debe ser admin, supervisor o architect' },
      { status: 400 }
    );
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Usuario no encontrado' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
