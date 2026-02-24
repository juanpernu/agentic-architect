# Mobile Navigation Redesign — Design

**Date:** 2026-02-24
**Status:** Approved

## Goal

Replace the bottom tab navigation on mobile with a hamburger menu pattern: sticky top bar + slide-in sidebar using Shadcn Sheet.

## Current State

- Desktop: fixed sidebar on the left (`hidden md:flex md:w-64 md:fixed`)
- Mobile: bottom navigation with 5 tabs (`md:hidden fixed bottom-0`)
- Bottom nav only shows a subset of routes (missing /reports, /administration)

## Design

### Mobile Header (visible < md breakpoint)

Sticky top bar with three sections:
- **Left:** Hamburger button (opens sidebar Sheet)
- **Center:** Dynamic page title based on current route
- **Right:** Clerk `UserButton` (avatar)

### Sidebar Sheet (mobile)

- Shadcn `Sheet` component with `side="left"`
- Reuses the same `SidebarContent` as the desktop sidebar
- Shows ALL nav items (including admin/supervisor routes based on role)
- Auto-closes on navigation (link click)
- Dark overlay backdrop

### Component Changes

| Component | Action |
|-----------|--------|
| `components/sidebar.tsx` | Extract nav content into `SidebarContent` sub-component |
| `components/mobile-header.tsx` | **Create** — top bar with hamburger + title + avatar |
| `components/bottom-nav.tsx` | **Delete** |
| `app/(dashboard)/layout.tsx` | Replace `<BottomNav />` with `<MobileHeader />`, remove `pb-16` |
| `components/ui/sheet.tsx` | **Install** via `npx shadcn@latest add sheet` |

### What Does NOT Change

- Desktop sidebar (fixed left) — untouched
- Role-based nav filtering logic — reused as-is
- Page content and layouts — no changes
- Clerk auth integration — reused `UserButton`

## Approach

Use Shadcn Sheet (already consistent with the project's UI library) instead of native `<dialog>` or Headless UI, to avoid new dependencies and maintain design system consistency.

## Title Mapping

Dynamic title derived from the existing `navItems` array by matching `pathname` to `item.href`. Falls back to "Agentect" if no match.
