# User Schema Improvements — Design Document

**Date:** 2026-02-16
**Status:** Approved
**Approach:** Incremental (3 iterations)

---

## Problem Statement

The current user management system has several gaps:
1. User names display as "Usuario" because `auth.ts` reads `sessionClaims.name` which doesn't exist in Clerk's token structure
2. The sidebar `<UserButton />` only shows the avatar — no name or role visible
3. No way to invite users to the organization
4. Organizations table only has id/name/slug — no address, logo, contact info
5. Admins can change user roles but cannot deactivate users

## Design

### Iteration 1: Fix User Data + Sidebar (no DB migration)

**1.1 Fix user name resolution in `auth.ts`**
- Clerk session claims expose name via `sessionClaims.firstName` / `sessionClaims.lastName` (or `sessionClaims.fullName`)
- Replace `(sessionClaims as Record<string, unknown>)?.name` with correct Clerk fields
- Fallback chain: full name > email > 'Usuario'
- Retroactive SQL fix for existing users with full_name = 'Usuario'

**1.2 Sidebar: name + role badge**
- Wrap `<UserButton />` in a flex container
- Display user's full name from `useUser()` (Clerk hook)
- Display role in a `<Badge />` component (shadcn/ui)
- Update `useCurrentUser()` hook to also expose `fullName`

Layout:
```
┌─────────────────────────────┐
│ [Avatar] Juan Pernumian     │
│          [Admin]            │
└─────────────────────────────┘
```

### Iteration 2: Organization Settings + User Management (DB migration already applied)

**2.1 DB schema (already applied by user in Supabase)**

Organizations expanded with:
- address_street, address_locality, address_province, address_postal_code
- phone, logo_url, website, contact_email
- social_instagram, social_linkedin

Users expanded with:
- is_active (boolean, default true)

**2.2 Organization Settings API**
- `GET /api/organization` — returns current org data (any authenticated user)
- `PATCH /api/organization` — updates org fields (admin-only)
- Logo upload via Supabase Storage

**2.3 Organization Settings UI**
- New section in `/settings` page with form for org data
- Logo upload with preview
- Address fields, contact info, social media links

**2.4 User deactivation**
- `PATCH /api/users/[id]/status` — toggles `is_active` (admin-only)
- `getAuthContext()` checks `is_active` and returns null for deactivated users
- UI: toggle switch in user list on Settings page

### Iteration 3: Invitations

**3.1 Invitation API**
- `POST /api/invitations` — admin-only, calls `clerkClient.organizations.createInvitation({ emailAddress, role })`
- `GET /api/invitations` — lists pending invitations from Clerk

**3.2 Invitation UI**
- "Invitar usuario" button in Settings
- Modal: email input + role selector (supervisor/architect)
- List of pending invitations with status

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Name source (sidebar) | `useUser()` from Clerk | Direct access to user profile, always up to date |
| Name source (auth.ts) | Clerk session claims fields | Available server-side without extra API call |
| Org settings storage | Columns in organizations table | Queryable, typed, no JSONB overhead |
| Invitation mechanism | Clerk API | Handles email delivery, signup flow, org assignment automatically |
| User deactivation | `is_active` column + auth gate | Simple, reversible, no data loss |
| Logo storage | Supabase Storage | Already used for receipt images, consistent approach |
