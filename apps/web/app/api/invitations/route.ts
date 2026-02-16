import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';

const VALID_ROLES = ['admin', 'supervisor', 'architect'] as const;
const ROLE_MAP: Record<string, string> = {
  admin: 'org:admin',
  supervisor: 'org:member',
  architect: 'org:member',
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  try {
    const client = await clerkClient();
    const invitations = await client.organizations.getOrganizationInvitationList({
      organizationId: ctx.orgId,
    });

    const sanitized = invitations.data.map((inv) => ({
      id: inv.id,
      emailAddress: inv.emailAddress,
      role: inv.role,
      status: inv.status,
      createdAt: inv.createdAt,
    }));

    return NextResponse.json(sanitized);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener invitaciones';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { email, role } = body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  if (!role || typeof role !== 'string' || !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    return NextResponse.json(
      { error: 'Rol inválido. Debe ser admin, supervisor o architect' },
      { status: 400 }
    );
  }

  const clerkRole = ROLE_MAP[role];

  try {
    const client = await clerkClient();
    const invitation = await client.organizations.createOrganizationInvitation({
      organizationId: ctx.orgId,
      emailAddress: email.trim(),
      role: clerkRole,
      inviterUserId: ctx.userId,
    });

    return NextResponse.json(
      { id: invitation.id, emailAddress: invitation.emailAddress, status: invitation.status },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al enviar invitación';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
