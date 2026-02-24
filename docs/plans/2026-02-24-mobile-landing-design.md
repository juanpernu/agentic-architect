# Mobile Landing Optimization — Design

**Goal:** Optimize the marketing landing page for mobile screens (< 640px) using Tailwind responsive utilities. No new components, no JS — purely CSS adjustments plus a conditional mobile card list for the Multi-obra table.

**Approach:** Tailwind responsive-first. Every change is a responsive class swap or a `hidden md:block` / `md:hidden` toggle.

---

## Changes by Section

### 1. Navbar
- Already visible on mobile after I4 fix
- No further changes needed

### 2. Hero
- Headline: `text-3xl sm:text-4xl` (was `text-4xl sm:text-5xl`)
- CTA buttons: `py-4 md:py-6` (reduce tap target height on mobile)
- Subtitle paragraph: `mb-8 sm:mb-10`

### 3. Comparison
- Section: `py-12 md:py-20` (was `py-20`)
- Cards: `p-5 md:p-8` (was `p-8`)
- Section heading `mb-10 md:mb-16` (was `mb-16`)

### 4. Features — AI Scan Card
- No changes needed (single column, works well)

### 5. Features — Bar Chart
- Bar width: `w-10 sm:w-16` (was `w-12 sm:w-16`)
- Chart container: `h-40 sm:h-56` (was `h-48 sm:h-56`)
- Section: `py-16 md:py-24` (was `py-24`)

### 6. Features — Multi-obra Table
- Desktop (>= md): keep existing `<Table>` with `hidden md:block`
- Mobile (< md): show stacked cards with `md:hidden`
  - Each card: project name (bold), status badge, progress bar with percentage
  - Uses existing project data array
  - Simple `space-y-3` layout

### 7. Pricing
- Section: `py-16 md:py-24` (was `py-24`)
- Heading margin: `mb-10 md:mb-16` (was `mb-16`)

### 8. CTA + Footer
- Section: `py-12 md:py-20` (was `py-20`)
- Button: `py-4 md:py-6` (was `py-6`)
- Heading: `text-2xl sm:text-3xl` (was `text-3xl`)
