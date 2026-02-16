import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden, invalidateIsActiveCache } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  if (!ctx.dbUserId) {
    return NextResponse.json(
      { error: 'Sesión incompleta. Por favor, cerrá sesión y volvé a iniciar.' },
      { status: 500 }
    );
  }

  const { id } = await params;

  // Prevent deactivating yourself
  if (id === ctx.dbUserId) {
    return NextResponse.json(
      { error: 'No podés desactivar tu propio usuario' },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json(
      { error: 'is_active debe ser true o false' },
      { status: 400 }
    );
  }

  const db = getDb();
  const { data, error } = await db
    .from('users')
    .update({ is_active: body.is_active })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  // Bust the is_active cache so the change takes effect immediately
  invalidateIsActiveCache(id);

  return NextResponse.json(data);
}
