import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { validateBody } from '@/lib/validate';
import { inviteCreateSchema } from '@/lib/schemas';

const ROLE_MAP: Record<string, string> = {
  admin: 'org:admin',
  supervisor: 'org:member',
  architect: 'org:member',
};

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

  const result = await validateBody(inviteCreateSchema, req);
  if ('error' in result) return result.error;
  const { email, role } = result.data;

  const clerkRole = ROLE_MAP[role];

  try {
    const client = await clerkClient();
    const invitation = await client.organizations.createOrganizationInvitation({
      organizationId: ctx.orgId,
      emailAddress: email,
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
