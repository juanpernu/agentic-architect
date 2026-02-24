# Landing Page — Design

**Date:** 2026-02-24
**Status:** Approved

## Goal

Create the technical architecture for a single-page marketing landing at `/` using a `(marketing)` route group with its own layout. Content and visual design will be provided separately by a design agent.

## Current State

- No landing page exists — `/` redirects authenticated users to the dashboard
- Public routes: only `/sign-in`, `/sign-up`, and webhook endpoints
- Clerk middleware protects all other routes
- Dashboard lives in `app/(dashboard)/` route group

## Decisions

- **Single page scrolleable** at `/` — no multi-page marketing routes
- **Auth redirect:** authenticated users visiting `/` get redirected to dashboard
- **Light mode only** for the landing — dashboard keeps dark mode support
- **Route group `(marketing)`** for clean separation from dashboard
- **Content is placeholder** — a design agent will fill in hero, features, pricing, etc.

## Architecture

### File Structure

```
apps/web/app/(marketing)/
├── layout.tsx          # Marketing layout: force light, header + footer
└── page.tsx            # Landing (server component, auth redirect)

apps/web/components/marketing/
├── marketing-header.tsx   # Sticky header: logo + CTAs
└── marketing-footer.tsx   # Footer: links, copyright
```

### Routing & Middleware

- Add `"/"` to Clerk's public route matcher in `middleware.ts`
- `(marketing)/page.tsx` is a server component: checks `auth()`, if authenticated → `redirect('/')` to dashboard (which lives at `(dashboard)/page.tsx`)
- Auth flow: visitor → `/` (landing) → "Registrate" → `/sign-up` → Clerk → redirect → auth detected → dashboard

### Components

**`marketing-header.tsx`** (client component):
- Sticky top bar, z-50
- Logo "Agentect" left, "Iniciar sesion" + "Empezar gratis" buttons right
- Responsive: hamburger menu on mobile
- Links to `/sign-in` and `/sign-up`

**`marketing-footer.tsx`** (server component):
- Basic footer with copyright "2026 Agentect"
- Placeholder for links (contact, terms)

**Landing sections:**
- Placeholder `<section>` elements with IDs for the design agent to implement
- Reuse existing design tokens (teal primary, Inter font, Shadcn button styles)

### What Does NOT Change

- Dashboard layout, sidebar, mobile-header — untouched
- Clerk auth flow — only public matcher updated
- Design tokens (colors, fonts) — reused as-is
- No API route changes
- No new dependencies

## Tech Stack

- Next.js App Router (server components + client where needed)
- Tailwind CSS 4 (existing tokens)
- Clerk `auth()` for server-side auth check
- Shadcn/ui Button for CTAs
