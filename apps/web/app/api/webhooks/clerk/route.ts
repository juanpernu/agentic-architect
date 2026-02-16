import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getDb } from '@/lib/supabase';

interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Syncs user metadata back to Clerk's publicMetadata.
 * This enables the fast path in useCurrentUser() hook.
 */
async function syncMetadataToClerk(
  clerkUserId: string,
  dbUserId: string,
  role: string
): Promise<void> {
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        role,
        db_user_id: dbUserId,
      },
    });
  } catch (error) {
    // Log but don't fail the webhook - DB sync is the critical path
    console.error('Failed to sync metadata to Clerk:', error);
  }
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing webhook secret' }, { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);
  const wh = new Webhook(WEBHOOK_SECRET);

  let event: ClerkWebhookEvent;
  try {
    event = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = getDb();

  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      const data = event.data;
      const orgMemberships = data.organization_memberships as Array<{
        organization: { id: string; name: string; slug: string };
        role: string;
      }> | undefined;

      const org = orgMemberships?.[0]?.organization;
      if (!org) break;

      // Upsert organization
      const { error: orgError } = await db.from('organizations').upsert({
        id: org.id,
        name: org.name,
        slug: org.slug,
      }, { onConflict: 'id' });

      if (orgError) {
        console.error('Failed to upsert organization:', orgError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      // Upsert user
      const roleMap: Record<string, string> = {
        'org:admin': 'admin',
        'org:member': 'architect',
      };

      const mappedRole = roleMap[orgMemberships![0].role] ?? 'architect';
      const clerkUserId = data.id as string;

      const { data: upsertedUser, error: userError } = await db.from('users')
        .upsert({
          clerk_user_id: clerkUserId,
          organization_id: org.id,
          role: mappedRole,
          full_name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
          email: (data.email_addresses as Array<{ email_address: string }>)?.[0]?.email_address ?? '',
          avatar_url: (data.image_url as string | undefined) ?? null,
        }, { onConflict: 'clerk_user_id' })
        .select('id, role')
        .single();

      if (userError || !upsertedUser) {
        console.error('Failed to upsert user:', userError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      // Sync metadata back to Clerk for fast path in useCurrentUser()
      await syncMetadataToClerk(clerkUserId, upsertedUser.id, upsertedUser.role);

      break;
    }

    case 'organizationMembership.created':
    case 'organizationMembership.updated': {
      // Handle role changes
      const data = event.data;
      const orgData = data.organization as { id: string; name: string; slug: string };
      const userData = data.public_user_data as { user_id: string };
      const role = data.role as string;

      const roleMap: Record<string, string> = {
        'org:admin': 'admin',
        'org:member': 'architect',
      };

      const mappedRole = roleMap[role] ?? 'architect';
      const clerkUserId = userData.user_id;

      const { data: updatedUser, error: roleError } = await db.from('users')
        .update({ role: mappedRole })
        .eq('clerk_user_id', clerkUserId)
        .eq('organization_id', orgData.id)
        .select('id, role')
        .single();

      if (roleError || !updatedUser) {
        console.error('Failed to update user role:', roleError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      // Sync metadata back to Clerk for fast path in useCurrentUser()
      await syncMetadataToClerk(clerkUserId, updatedUser.id, updatedUser.role);

      break;
    }
  }

  return NextResponse.json({ received: true });
}
