# Mobile Landing Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize the marketing landing page for mobile screens (< 640px) with Tailwind responsive utilities and a mobile card list for the Multi-obra table.

**Architecture:** Pure CSS approach. Every change is a Tailwind responsive class swap on existing elements. The only markup change is a conditional mobile/desktop block for the Multi-obra section (cards on mobile, table on desktop). No new components, no JS.

**Tech Stack:** Tailwind CSS responsive utilities, Next.js App Router

---

### Task 1: Hero section — reduce sizing for mobile

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx:50-76`

**Step 1: Apply responsive changes**

Line 50 — headline font size:
```
BEFORE: className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight"
AFTER:  className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight"
```

Line 58 — subtitle margin:
```
BEFORE: className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
AFTER:  className="text-lg sm:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed"
```

Line 66 — primary CTA button padding:
```
BEFORE: className="w-full sm:w-auto text-lg px-8 py-6 rounded-xl shadow-lg shadow-primary/25"
AFTER:  className="w-full sm:w-auto text-lg px-8 py-4 md:py-6 rounded-xl shadow-lg shadow-primary/25"
```

Line 71 — outline CTA button padding:
```
BEFORE: className="w-full sm:w-auto text-lg px-8 py-6 rounded-xl"
AFTER:  className="w-full sm:w-auto text-lg px-8 py-4 md:py-6 rounded-xl"
```

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "fix: reduce hero sizing for mobile"
```

---

### Task 2: Comparison section — reduce padding for mobile

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx:93-166`

**Step 1: Apply responsive changes**

Line 93 — section padding:
```
BEFORE: className="py-20 bg-slate-50 border-y"
AFTER:  className="py-12 md:py-20 bg-slate-50 border-y"
```

Line 95 — heading margin:
```
BEFORE: className="text-center mb-16"
AFTER:  className="text-center mb-10 md:mb-16"
```

Line 106 — "old way" card padding:
```
BEFORE: className="p-8 relative overflow-hidden"
AFTER:  className="p-5 md:p-8 relative overflow-hidden"
```

Line 136 — "new way" card padding:
```
BEFORE: className="p-8 rounded-[14px] h-full relative overflow-hidden border-0"
AFTER:  className="p-5 md:p-8 rounded-[14px] h-full relative overflow-hidden border-0"
```

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "fix: reduce comparison section padding for mobile"
```

---

### Task 3: Features section — reduce padding and chart sizing

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx:172-258`

**Step 1: Apply responsive changes**

Line 172 — section padding:
```
BEFORE: className="py-24"
AFTER:  className="py-16 md:py-24"
```

Line 233 — chart container height:
```
BEFORE: className="h-48 sm:h-56 w-full relative"
AFTER:  className="h-40 sm:h-56 w-full relative"
```

Line 248 — bar width:
```
BEFORE: className="w-12 sm:w-16 flex flex-col items-center"
AFTER:  className="w-10 sm:w-16 flex flex-col items-center"
```

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "fix: reduce features section padding and chart sizing for mobile"
```

---

### Task 4: Multi-obra table — mobile card list

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx:260-312`

This is the only markup change. Extract the project data to a const, then render the table in a `hidden md:block` wrapper and a mobile card list in a `md:hidden` wrapper.

**Step 1: Refactor table to support mobile cards**

Replace the entire Multi-obra card content (lines 260-312) with:

```tsx
{/* Feature 3: Control Multi-obra (full width) */}
<Card className="lg:col-span-3 p-5 md:p-8 shadow-lg hover:shadow-xl transition-shadow">
  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
    <div>
      <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
        <Building2 className="h-5 w-5 md:h-6 md:w-6 text-primary" />
        Control Multi-obra
      </CardTitle>
      <CardDescription className="mt-2">
        Todo tu estudio en una sola pantalla. Accedé al estado de cada proyecto.
      </CardDescription>
    </div>
  </div>

  {/* Desktop table */}
  <div className="hidden md:block">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Proyecto</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Avance Financiero</TableHead>
          <TableHead className="text-right">Última Actividad</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[
          { name: 'Casa Martínez', status: 'En Curso', statusColor: 'bg-green-100 text-green-800', progress: 65, barColor: 'bg-primary', time: 'Hace 2h' },
          { name: 'Edificio Alvear', status: 'Revisión', statusColor: 'bg-yellow-100 text-yellow-800', progress: 22, barColor: 'bg-yellow-500', time: 'Ayer' },
          { name: 'Remodelación Oficinas', status: 'Planificación', statusColor: 'bg-blue-100 text-blue-800', progress: 5, barColor: 'bg-blue-500', time: 'Hace 3 días' },
        ].map((project) => (
          <TableRow key={project.name}>
            <TableCell className="font-medium">{project.name}</TableCell>
            <TableCell>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.statusColor}`}>
                {project.status}
              </span>
            </TableCell>
            <TableCell className="w-1/3">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-8">{project.progress}%</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${project.barColor} rounded-full`} style={{ width: `${project.progress}%` }} />
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right text-muted-foreground">{project.time}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>

  {/* Mobile cards */}
  <div className="md:hidden space-y-3">
    {[
      { name: 'Casa Martínez', status: 'En Curso', statusColor: 'bg-green-100 text-green-800', progress: 65, barColor: 'bg-primary', time: 'Hace 2h' },
      { name: 'Edificio Alvear', status: 'Revisión', statusColor: 'bg-yellow-100 text-yellow-800', progress: 22, barColor: 'bg-yellow-500', time: 'Ayer' },
      { name: 'Remodelación Oficinas', status: 'Planificación', statusColor: 'bg-blue-100 text-blue-800', progress: 5, barColor: 'bg-blue-500', time: 'Hace 3 días' },
    ].map((project) => (
      <div key={project.name} className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{project.name}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${project.statusColor}`}>
            {project.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${project.barColor} rounded-full`} style={{ width: `${project.progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground w-8">{project.progress}%</span>
        </div>
      </div>
    ))}
  </div>
</Card>
```

Also remove the now-unused "Ver reporte completo" span (was flagged in code review as a non-actionable fake link).

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "fix: replace multi-obra table with card list on mobile"
```

---

### Task 5: Pricing + CTA — reduce section padding for mobile

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx` (pricing and CTA sections)

**Step 1: Apply responsive changes**

Pricing section padding:
```
BEFORE: className="py-24 bg-slate-50 border-y"
AFTER:  className="py-16 md:py-24 bg-slate-50 border-y"
```

Pricing heading margin:
```
BEFORE: className="text-center max-w-3xl mx-auto mb-16"
AFTER:  className="text-center max-w-3xl mx-auto mb-10 md:mb-16"
```

CTA section padding:
```
BEFORE: className="py-20 border-t"
AFTER:  className="py-12 md:py-20 border-t"
```

CTA heading size:
```
BEFORE: className="text-3xl font-bold tracking-tight mb-6"
AFTER:  className="text-2xl sm:text-3xl font-bold tracking-tight mb-6"
```

CTA button padding:
```
BEFORE: className="px-8 py-6 rounded-xl text-lg shadow-lg shadow-primary/20"
AFTER:  className="px-8 py-4 md:py-6 rounded-xl text-lg shadow-lg shadow-primary/20"
```

**Step 2: Verify build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx
git commit -m "fix: reduce pricing and CTA section padding for mobile"
```

---

### Task 6: Final verification

**Step 1: Full build**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 2: Review all responsive changes**

Run: `git diff master --stat`
Expected: Only `apps/web/app/(marketing)/page.tsx` and `docs/plans/` files modified

**Step 3: Verify no stale references or broken markup**

Grep for any duplicate `className` attributes (caught issue in previous PR):
Run: `grep -n 'className.*className' apps/web/app/\(marketing\)/page.tsx`
Expected: No matches
