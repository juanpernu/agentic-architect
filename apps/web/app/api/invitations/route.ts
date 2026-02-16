import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  try {
    const client = await clerkClient();
    const invitations = await client.organizations.getOrganizationInvitationList({
      organizationId: ctx.orgId,
    });

    return NextResponse.json(invitations.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invitations';
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

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email es requerido' }, { status: 400 });
  }

  // Map our app roles to Clerk org roles
  const ROLE_MAP: Record<string, string> = {
    admin: 'org:admin',
    supervisor: 'org:member',
    architect: 'org:member',
  };
  const clerkRole = ROLE_MAP[role as string] ?? 'org:member';

  try {
    const client = await clerkClient();
    const invitation = await client.organizations.createOrganizationInvitation({
      organizationId: ctx.orgId,
      emailAddress: email,
      role: clerkRole,
      inviterUserId: ctx.userId,
    });

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al enviar invitación';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
