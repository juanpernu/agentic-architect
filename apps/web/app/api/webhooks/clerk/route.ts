import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/supabase';

interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
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
      await db.from('organizations').upsert({
        id: org.id,
        name: org.name,
        slug: org.slug,
      }, { onConflict: 'id' });

      // Upsert user
      const roleMap: Record<string, string> = {
        'org:admin': 'admin',
        'org:member': 'architect',
      };

      await db.from('users').upsert({
        clerk_user_id: data.id as string,
        organization_id: org.id,
        role: roleMap[orgMemberships![0].role] ?? 'architect',
        full_name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
        email: (data.email_addresses as Array<{ email_address: string }>)?.[0]?.email_address ?? '',
        avatar_url: data.image_url as string ?? null,
      }, { onConflict: 'clerk_user_id' });

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

      await db.from('users')
        .update({ role: roleMap[role] ?? 'architect' })
        .eq('clerk_user_id', userData.user_id)
        .eq('organization_id', orgData.id);

      break;
    }
  }

  return NextResponse.json({ received: true });
}
