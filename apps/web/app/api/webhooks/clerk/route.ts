import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getDb } from '@/lib/supabase';
import type { UserRole } from '@architech/shared';

// S4: Narrow event types to handled cases
type WebhookEventType =
  | 'user.created'
  | 'user.updated'
  | 'organization.created'
  | 'organizationMembership.created'
  | 'organizationMembership.updated';

interface ClerkWebhookEvent {
  type: WebhookEventType | string;
  data: Record<string, unknown>;
}

// S2: Deduplicate roleMap to module scope
const CLERK_ROLE_MAP: Record<string, UserRole> = {
  'org:admin': 'admin',
  'org:member': 'architect',
};

/**
 * Syncs user metadata back to Clerk's publicMetadata.
 * This enables the fast path in useCurrentUser() hook.
 * C1 fix: includes idempotency guard to prevent infinite webhook loops.
 */
async function syncMetadataToClerk(
  clerkUserId: string,
  dbUserId: string,
  role: UserRole,
  currentPublicMetadata?: Record<string, unknown>
): Promise<void> {
  // C1: Skip if metadata already matches — prevents user.updated re-trigger loop
  if (
    currentPublicMetadata?.role === role &&
    currentPublicMetadata?.db_user_id === dbUserId
  ) {
    return;
  }

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        role,
        db_user_id: dbUserId,
      },
    });
  } catch (error) {
    // Log but don't fail the webhook — DB sync is the critical path
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
        organization: { id: string; name: string; slug: string; image_url?: string };
        role: string;
      }> | undefined;

      const org = orgMemberships?.[0]?.organization;
      if (!org) break;

      // Upsert organization — seed logo_url only on first insert to avoid overwriting user edits
      const { data: existingOrg, error: lookupError } = await db.from('organizations')
        .select('id')
        .eq('id', org.id)
        .maybeSingle();

      // Fail-safe: if lookup fails, assume org exists (skip logo to avoid overwrite)
      if (lookupError) {
        console.error('Failed to check existing org:', lookupError);
      }

      const orgPayload: Record<string, string | null> = {
        id: org.id,
        name: org.name,
        slug: org.slug,
      };

      // Only seed logo on first insert
      if (!existingOrg && !lookupError && org.image_url) {
        orgPayload.logo_url = org.image_url;
      }

      const { error: orgError } = await db.from('organizations').upsert(
        orgPayload,
        { onConflict: 'id' }
      );

      if (orgError) {
        console.error('Failed to upsert organization:', orgError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      const mappedRole = CLERK_ROLE_MAP[orgMemberships![0].role] ?? 'architect';
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

      // C1: Pass current publicMetadata for idempotency check
      const currentPublicMetadata = data.public_metadata as Record<string, unknown> | undefined;
      await syncMetadataToClerk(
        clerkUserId,
        upsertedUser.id,
        upsertedUser.role as UserRole,
        currentPublicMetadata
      );

      break;
    }

    case 'organizationMembership.created':
    case 'organizationMembership.updated': {
      const data = event.data;
      const orgData = data.organization as { id: string; name: string; slug: string };
      const userData = data.public_user_data as {
        user_id: string;
        first_name?: string;
        last_name?: string;
        identifier?: string;
        image_url?: string;
      };
      const role = data.role as string;

      const mappedRole = CLERK_ROLE_MAP[role] ?? 'architect';
      const clerkUserId = userData.user_id;

      // Try to update existing user first
      const { data: updatedUser } = await db.from('users')
        .update({ role: mappedRole })
        .eq('clerk_user_id', clerkUserId)
        .eq('organization_id', orgData.id)
        .select('id, role')
        .single();

      if (updatedUser) {
        await syncMetadataToClerk(clerkUserId, updatedUser.id, updatedUser.role as UserRole);
        break;
      }

      // User doesn't exist yet — create them (common for invited users)
      // Ensure org exists
      await db.from('organizations').upsert(
        { id: orgData.id, name: orgData.name, slug: orgData.slug },
        { onConflict: 'id' }
      );

      // Get user details from Clerk
      let fullName = `${userData.first_name ?? ''} ${userData.last_name ?? ''}`.trim() || 'Usuario';
      let email = userData.identifier ?? '';

      if (fullName === 'Usuario' || !email) {
        try {
          const client = await clerkClient();
          const clerkUser = await client.users.getUser(clerkUserId);
          fullName = `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || fullName;
          email = email || (clerkUser.emailAddresses?.[0]?.emailAddress ?? '');
        } catch (e) {
          console.error('Failed to fetch Clerk user for membership creation:', e);
        }
      }

      const { data: newUser, error: insertError } = await db.from('users')
        .insert({
          clerk_user_id: clerkUserId,
          organization_id: orgData.id,
          role: mappedRole,
          full_name: fullName,
          email,
          avatar_url: userData.image_url ?? null,
        })
        .select('id, role')
        .single();

      if (insertError || !newUser) {
        console.error('Failed to create user from membership webhook:', insertError);
        break;
      }

      await syncMetadataToClerk(clerkUserId, newUser.id, newUser.role as UserRole);

      break;
    }

    case 'organization.created': {
      const data = event.data;
      const orgId = data.id as string;
      const orgName = data.name as string;
      const orgSlug = data.slug as string;
      const imageUrl = (data.image_url as string | undefined) ?? null;

      const { error: orgError } = await db.from('organizations').upsert({
        id: orgId,
        name: orgName,
        slug: orgSlug,
        logo_url: imageUrl,
      }, { onConflict: 'id' });

      if (orgError) {
        console.error('Failed to upsert organization from org.created:', orgError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      break;
    }
  }

  return NextResponse.json({ received: true });
}
