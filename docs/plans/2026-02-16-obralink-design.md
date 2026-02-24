# Agentect — MVP Design Document

**Date:** 2026-02-16
**Author:** Juan + Claude (Brainstorming Session)
**Status:** Approved

---

## 1. Project Overview

### What
Agentect is a SaaS construction project management platform designed for architecture firms, construction companies, and real estate developers. It enables users to track multiple parallel construction projects ("obras") and manage all associated financial documentation.

### Why
Existing ERP tools (like Tango) are generic. Architecture and construction firms need a vertical solution where the **project (obra)** is the central entity, not the client or product. Every receipt, invoice, expense, and progress update revolves around a specific construction project.

### Target Users
- Architecture firms
- Construction companies
- Real estate developers

### Core Value Proposition
Take a photo of a receipt on-site → AI extracts the data → link it to a project → done. No manual data entry.

---

## 2. MVP Scope

### In Scope
- **Authentication**: Login/signup via Clerk with organization support
- **Role-based access**: Admin > Supervisor > Architect (simple hierarchy)
- **Projects CRUD**: Create, read, update, delete construction projects
- **Receipt upload + AI extraction**: Photo capture → Claude Vision extracts vendor, total, date, line items → user reviews and confirms → linked to project
- **Dashboard**: KPI cards, spend by project chart, monthly trend chart, recent receipts
- **Settings**: User management and role assignment (Admin only)

### Out of Scope (Future)
- Project progress tracking module
- Cost centers per project
- Budget management
- AI assistant for data queries (TBD)
- Notifications
- Export/reports
- Mobile native app (PWA possible later)

---

## 3. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js (App Router) + TypeScript | Mobile-first web app, SSR/SSG, API routes built-in |
| UI | Shadcn/ui + Tailwind CSS | Accessible, customizable, consistent design system |
| Charts | Recharts | Lightweight, responsive, React-native integration |
| Auth | Clerk | Organizations, roles, MFA, pre-built UI, mobile-friendly |
| Database | Supabase (PostgreSQL) | RLS for multi-tenancy, Storage for images, real-time capable |
| AI | Claude Vision (Anthropic API) | Flexible prompting, structured JSON output, iterative improvement |
| Deploy | Vercel | Native Next.js support, auto-scaling, edge functions |
| Monorepo | Turborepo | Parallel builds, shared packages, agent-friendly structure |

---

## 4. Monorepo Structure

```
agentect/
├── apps/
│   └── web/                    # Next.js App Router
│       ├── app/                # Pages, layouts, API routes
│       │   ├── (auth)/         # Login/signup (Clerk)
│       │   ├── (dashboard)/    # Protected routes
│       │   │   ├── page.tsx            # Dashboard home
│       │   │   ├── projects/           # Projects CRUD
│       │   │   ├── receipts/           # Receipts list + detail
│       │   │   ├── upload/             # Receipt upload flow
│       │   │   └── settings/           # User management
│       │   └── api/            # API routes
│       │       ├── projects/
│       │       ├── receipts/
│       │       ├── dashboard/
│       │       └── webhooks/   # Clerk webhooks
│       ├── components/         # Shared UI components
│       └── lib/                # App-specific utilities
├── packages/
│   ├── db/                     # Supabase schema, migrations, types
│   ├── ai/                     # AI extraction engine
│   └── shared/                 # Shared TypeScript types
├── turbo.json
├── package.json
└── .env.example
```

---

## 5. Data Model

### organizations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | string | |
| slug | string (unique) | |
| created_at | timestamp | |
| updated_at | timestamp | |

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| clerk_user_id | string (unique) | Synced from Clerk via webhook |
| organization_id | uuid (FK → organizations) | |
| role | enum: admin, supervisor, architect | |
| full_name | string | |
| email | string | |
| avatar_url | string (nullable) | |
| created_at | timestamp | |

### projects
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| organization_id | uuid (FK → organizations) | |
| name | string | User-defined, e.g., "Amenabar 3821" |
| address | string (nullable) | |
| status | enum: active, paused, completed | |
| architect_id | uuid (FK → users, nullable) | |
| created_at | timestamp | |
| updated_at | timestamp | |

### receipts
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| project_id | uuid (FK → projects) | Entire receipt linked to one project |
| uploaded_by | uuid (FK → users) | |
| vendor | string (nullable) | AI-extracted or manual |
| total_amount | decimal | |
| receipt_date | date | |
| image_url | string | Supabase Storage URL |
| ai_raw_response | jsonb | Full Claude Vision response for audit |
| ai_confidence | float | 0-1 confidence score |
| status | enum: pending, confirmed, rejected | |
| created_at | timestamp | |
| updated_at | timestamp | |

### receipt_items
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| receipt_id | uuid (FK → receipts) | |
| description | string | |
| quantity | decimal | |
| unit_price | decimal | |
| subtotal | decimal | Auto-calculated |
| created_at | timestamp | |

### Enums
```
role: 'admin' | 'supervisor' | 'architect'
project_status: 'active' | 'paused' | 'completed'
receipt_status: 'pending' | 'confirmed' | 'rejected'
```

### Row Level Security (RLS)
- All tables filtered by `organization_id` via Clerk JWT
- Admin: full access within organization
- Supervisor: read all assigned projects, CRUD own projects, upload receipts
- Architect: read/upload only on assigned projects

---

## 6. Role Permissions Matrix

| Action | Admin | Supervisor | Architect |
|--------|-------|------------|-----------|
| Create project | ✅ | ✅ | ❌ |
| View all projects | ✅ | ✅ (assigned) | ❌ |
| View own projects | ✅ | ✅ | ✅ |
| Edit project | ✅ | ✅ (own) | ❌ |
| Delete project | ✅ | ❌ | ❌ |
| Upload receipt | ✅ | ✅ | ✅ |
| View all receipts | ✅ | ✅ (own projects) | ❌ |
| View own receipts | ✅ | ✅ | ✅ |
| Manage users | ✅ | ❌ | ❌ |

---

## 7. Screen Flow

```
Login (Clerk) → Dashboard (Home)
                    │
        ┌───────────┼───────────┐
        │           │           │
   Projects    Receipts    Settings
   List        List (All)  & Users
        │           │
   Project     Receipt
   Detail      Detail
   (+ CRUD)
        │
   Upload Receipt → AI Review & Confirm
```

### Screens

1. **Login** — Clerk hosted UI, zero custom code
2. **Dashboard** — KPI cards (active projects, monthly spend, weekly receipts, pending review), spend by project bar chart, monthly trend line chart, recent receipts list
3. **Projects List** — Cards with name, status badge, architect, total spend. Search + filter. [+ New] button for Admin/Supervisor
4. **Create/Edit Project** — Form: name (required), address (optional), architect (dropdown), status
5. **Project Detail** — Header with info, receipts linked to project, total spend, [Upload Receipt] button, [Edit] and [Delete] actions (role-dependent)
6. **Upload Receipt** — Camera capture (mobile) or file picker (desktop), full-screen camera on mobile
7. **AI Review & Confirm** — Inline tap-to-edit pattern. Photo preview (expandable), extracted fields (vendor, date, total), line items (expandable per item to edit), project selector (pre-selected if coming from project detail), confidence indicator, [Discard] / [Confirm] buttons
8. **Receipts List (Global)** — All receipts, filterable by project, date, vendor
9. **Receipt Detail** — Full view: photo, extracted data, project, uploader, timestamp
10. **Settings** — Admin only: team members, role assignment

### AI Review UX — Inline Tap-to-Edit
- Fields displayed as readable text (not form inputs)
- Tap a field → inline edit mode with [Cancel] / [Done]
- Items expandable: tap row → expand to edit description, qty, unit_price
- Total auto-recalculates from items (user can override)
- Confidence-based visual indicators:
  - `> 85%`: Green badge, all fields pre-filled
  - `60-85%`: Yellow badge, low-confidence fields highlighted
  - `< 60%`: Red badge, "Please review all fields" message

### Navigation
- Mobile: Bottom nav bar (Home, Projects, Upload, Settings)
- Desktop: Sidebar navigation
- Global FAB on mobile for quick receipt upload

---

## 8. API Routes

### Projects
```
GET    /api/projects          → List (filtered by role/org)
POST   /api/projects          → Create (admin, supervisor)
GET    /api/projects/:id      → Detail
PATCH  /api/projects/:id      → Update (admin, supervisor own)
DELETE /api/projects/:id      → Delete (admin only, validated)
```

### Receipts
```
POST   /api/receipts/upload   → Upload image to Supabase Storage
POST   /api/receipts/extract  → Send to Claude Vision, return JSON
POST   /api/receipts          → Save confirmed receipt + items
GET    /api/receipts          → List (filterable by project, date, vendor)
GET    /api/receipts/:id      → Detail
DELETE /api/receipts/:id      → Delete (admin only)
```

### Dashboard
```
GET    /api/dashboard/stats             → KPI numbers with period comparison
GET    /api/dashboard/spend-by-project  → Aggregated spend per project
GET    /api/dashboard/spend-trend       → Monthly aggregation (last 6 months)
```

### Webhooks
```
POST   /api/webhooks/clerk    → Handle user.created, user.updated, org events
```

---

## 9. AI Extraction Engine

### Location
`packages/ai/`

### Prompt Strategy
```typescript
const EXTRACTION_PROMPT = `
You are a receipt/invoice data extractor for construction
and architecture projects in Argentina.

Analyze this image and extract:
- vendor: string (business name)
- date: string (YYYY-MM-DD)
- total: number (total amount in ARS)
- items: array of { description, quantity, unit_price, subtotal }
- confidence: number (0-1, your confidence in the extraction)

Return ONLY valid JSON. If a field is unreadable,
set it to null and lower confidence accordingly.
`
```

### Edge Cases
- Blurry/unreadable photo: confidence < 0.5, show empty form with manual entry message
- No itemized lines: empty items array, user adds manually or keeps total only
- Multi-page receipt: MVP = 1 photo per receipt, iterate later

---

## 10. Agent Architecture

### Agents
| Agent | Domain | Owns |
|-------|--------|------|
| Main Planner | Coordination, interfaces, shared types | turbo.json, packages/shared, env config |
| Frontend | UI, pages, components, client-side logic | apps/web/ (excluding api/) |
| Backend/DB | Schema, migrations, API routes, RLS | packages/db/, apps/web/api/ |
| AI Agent | Extraction engine, prompts, parsers | packages/ai/ |

### Execution Phases

#### Phase 0: Bootstrap (Main Planner) — Sequential
- Init Turborepo monorepo
- Configure apps/web, packages/db, packages/ai, packages/shared
- Install shared dependencies
- Define shared TypeScript interfaces
- Setup Clerk + Supabase projects, env vars

#### Phase 1: Foundation (Frontend + Backend/DB + AI) — Full Parallel
- **Backend/DB**: Supabase schema, RLS policies, Clerk webhook handler, base API middleware
- **Frontend**: App layout shell, bottom nav, Clerk integration, base UI components (PageHeader, DataTable, EmptyState, LoadingSkeleton, KPICard)
- **AI Agent**: Claude Vision integration, extraction prompt v1, JSON parser, confidence scoring, unit tests

#### Phase 2: Core Features (Frontend + Backend/DB + AI) — Full Parallel
- **Backend/DB**: Projects API (full CRUD), Receipts API (upload, extract, CRUD), Dashboard API (stats, spend-by-project, spend-trend)
- **Frontend**: Projects CRUD pages, Upload Receipt flow (camera + file), AI Review screen (inline tap-to-edit), Receipt list + detail
- **AI Agent**: Prompt refinement for Argentine formats, multi-format support, improved error handling

#### Phase 3: Integration (Main Planner + Frontend + Backend/DB) — Semi-Parallel
- **Frontend**: Dashboard page with real data (Recharts), Settings page, wire all pages to real APIs
- **Backend/DB**: Performance optimization, DB indexes, caching, integration fixes
- **Main Planner**: End-to-end flow testing, coordination

#### Phase 4: Polish + QA (Main Planner + Frontend) — Sequential
- Mobile responsiveness audit
- Loading/error/empty states
- Toast notifications
- Role-based navigation visibility
- Accessibility basics
- README + env.example

### Dependency Graph
```
Phase 0 (Main Planner sequential)
    │
    ├──────────┬──────────┐
    ▼          ▼          ▼
Phase 1:FE  Phase 1:BE  Phase 1:AI  (parallel)
    │          │          │
    ▼          ▼          ▼
Phase 2:FE  Phase 2:BE  Phase 2:AI  (parallel)
    │          │
    ▼          ▼
Phase 3:FE  Phase 3:BE              (semi-parallel)
    │          │
    └────┬─────┘
         ▼
Phase 4: Polish                      (sequential)
```

---

## 11. Clerk + Supabase Integration Pattern

### Flow
1. User signs up/in via Clerk
2. Clerk webhook fires → `POST /api/webhooks/clerk`
3. Webhook handler creates/updates record in `users` table in Supabase
4. Clerk JWT includes `org_id` and `user_id`
5. Supabase RLS policies use `clerk_user_id` from JWT to filter all queries
6. Frontend uses Clerk's `useAuth()` for auth state, passes token to Supabase client

### Why This Works
- Clerk handles all auth complexity (MFA, social login, org management)
- Supabase handles all data with native PostgreSQL security (RLS)
- Single source of truth: Clerk for identity, Supabase for application data
- Webhook sync keeps both in sync without client-side complexity
