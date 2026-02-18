# Clerk Organization Seed — Design

**Date:** 2026-02-17
**Status:** Approved

## Goal

When a user creates an organization in Clerk (with name and logo), seed those values into the app's organization record in Supabase. This is a one-time seed — the user can overwrite the data from Settings afterwards.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Source of truth | Supabase (Clerk is seed only) | User should control org data from app Settings |
| Sync frequency | `organization.created` only | One-time seed, no ongoing sync |
| Logo storage | CDN URL from Clerk (no re-upload) | Temporary — user can upload own logo from Settings |
| Sidebar branding | Keep "Architech" hardcoded | No change to sidebar |

## Approach: Webhook `organization.created`

### Changes to `apps/web/app/api/webhooks/clerk/route.ts`

1. Add `'organization.created'` to `WebhookEventType` union
2. New switch case for `organization.created`:
   - Extract `id`, `name`, `slug`, `image_url` from `event.data`
   - Upsert into `organizations` table with `logo_url = image_url`
3. Improve existing `user.created/updated` org upsert:
   - Include `logo_url` from org's `image_url` only if not already set (don't overwrite manual edits)

### Clerk Dashboard Configuration

- Enable `organization.created` event in webhook settings

### No Changes Needed

- `Organization` type in `@architech/shared` — already has `logo_url`
- `organizations` table — already has `logo_url` column
- `OrgSettingsForm` — already displays and edits `logo_url`
- Sidebar — stays as-is

## Scope

~20 lines changed in webhook handler + Clerk dashboard config.
