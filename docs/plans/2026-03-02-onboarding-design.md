# User Onboarding Flow — Design Document

> Fecha: 2026-03-02
> Estado: Aprobado

---

## 1. Objetivo

Implementar un flujo de onboarding para todos los usuarios nuevos de Agentect que:

- Explique la propuesta de valor del producto
- Guíe al usuario a crear su primer proyecto y presupuesto (admin/supervisor) o a conocer la plataforma (architect)
- Sea resumible si el usuario hace drop-off
- Se integre nativamente con el stack existente (Shadcn/ui, Next.js 16, Supabase)

---

## 2. Stack Técnico

### Decisión: Custom puro con Shadcn/ui

**Descartados:**
- **React Joyride** — Roto con React 19 (usa `unmountComponentAtNode`, API removida)
- **Onborda** — Dependencia frágil de framer-motion viejo
- **driver.js** — Funcional pero renderiza fuera del React tree, no puede usar componentes Shadcn

**Elegido:** Implementación custom usando:
- `Dialog` de Shadcn/ui para modales (welcome + summary)
- `Popover` de Shadcn/ui + overlay custom para tooltips con highlight
- `@floating-ui/react` para posicionamiento dinámico (ya es transitive dep de Radix)
- State machine en React Context
- Persistencia en Supabase (columna en `users`)

**Ventajas:** Cero dependencias nuevas, look 100% nativo, multi-page trivial via `router.push()`, control total sobre el flujo.

---

## 3. Flujos por Rol

Dos variantes basadas en permisos de creación existentes (`isAdminOrSupervisor` gate):

| Variante | Roles | Flujo |
|---|---|---|
| **Creador** | admin, supervisor | Welcome → Crear proyecto → Crear presupuesto → Summary |
| **Viewer** | architect | Welcome → Tour visual (proyectos + comprobantes) → Summary |

### 3.1 State Machine — Variante Creador (admin + supervisor)

```
STEP welcome         → Full-screen welcome (3 slides)
STEP tour-1          → Tooltip en sidebar "Proyectos" → navegar a /projects
STEP tour-2          → Highlight en CreateProjectCard → crear proyecto
STEP tour-3          → Navegación a /projects/[id] + tooltips explicativos (stats, comprobantes, presupuesto)
STEP tour-4          → Abrir CreateBudgetDialog (proyecto pre-seleccionado) → crear presupuesto
STEP tour-5          → En /budgets/[id], tooltip explicando el editor
STEP tour-6          → Volver a /projects/[id], mostrar presupuesto impactado
STEP summary         → Modal final con overview de features restantes
STEP completed       → Onboarding terminado
```

### 3.2 State Machine — Variante Viewer (architect)

```
STEP welcome         → Full-screen welcome (3 slides, CTA adaptado)
STEP tour-1          → Tooltip en sidebar "Proyectos" → navegar a /projects
STEP tour-2          → Tooltip explicando "Mis proyectos" (solo los asignados)
STEP tour-3          → Tooltip sobre comprobantes/upload → explicar carga con IA
STEP summary         → Modal final con features de architect
STEP completed       → Onboarding terminado
```

---

## 4. Diseño de cada Etapa

### 4.1 Etapa 1 — Welcome (Full-screen, todos los roles)

Dialog fullscreen sin close button. 3 slides con dots de progreso:

**Slide 1 — Propuesta de valor:**
- Logo de Agentect
- "Sabé exactamente cuánto ganás en cada obra"
- Subtítulo: presupuestos integrados, seguimiento por rubro, control en tiempo real

**Slide 2 — Las 3 funciones core:**
- [TableProperties] Presupuestos — editor con rubros, items, versionado
- [Camera] Comprobantes con IA — foto → extracción automática
- [BarChart3] Reportes — rentabilidad por rubro en tiempo real

**Slide 3 — CTA:**
- Creador: "Empecemos creando tu primer proyecto" / Viewer: "Vamos a conocer la plataforma"
- "En 5 minutos vas a tener todo listo"
- Botón "Empezar →"
- Link sutil "Omitir onboarding" → marca completado

Copy reutilizado de la landing page. Iconos de Lucide (ya en el proyecto).

### 4.2 Etapa 2 — Guided Tour (varía por rol)

#### Creador (admin + supervisor): Crear proyecto

**Step tour-1**: Tooltip sobre item "Proyectos" del sidebar
- Overlay oscuro cubriendo todo excepto el item
- "Empezá acá. Creá tu primer proyecto."
- CTA: "Ir a Proyectos →" → navega a `/projects`

**Step tour-2**: En `/projects`, highlight sobre `CreateProjectCard`
- Overlay oscuro, solo la card resaltada
- "Hacé click acá para crear tu primer proyecto"
- Click en la card → abre `ProjectFormDialog` normalmente
- Detección de creación: escuchar SWR mutate de `/api/projects`

**Step tour-3**: Post-creación → navegar a `/projects/[newProjectId]`
- Tooltip de felicitación: "¡Proyecto creado!"
- En la page del proyecto, 2-3 tooltips secuenciales:
  - Stats cards: "Acá vas a ver el resumen financiero: presupuestado, gasto real y disponible."
  - Comprobantes: "Cuando cargues comprobantes, van a aparecer acá asociados a este proyecto."
  - Botón presupuesto: "Ahora creemos un presupuesto." → CTA "Crear presupuesto →"

#### Viewer (architect): Tour visual

**Step tour-1**: Tooltip sobre item "Proyectos" del sidebar
- "Acá vas a ver los proyectos que te asignaron."
- CTA: "Ver Proyectos →"

**Step tour-2**: En `/projects`
- Si hay proyectos: "Solo vas a ver los proyectos donde estés asignado como arquitecto."
- Si no hay: "Cuando te asignen a un proyecto, va a aparecer acá."

**Step tour-3**: Tooltip sobre comprobantes/upload
- "Podés cargar comprobantes sacándole una foto. La IA extrae proveedor, monto y CUIT automáticamente."
- CTA: "Siguiente →" → avanza a summary

### 4.3 Etapa 3 — Crear Presupuesto (solo creador)

**Step tour-4**: Se abre `CreateBudgetDialog` con proyecto pre-seleccionado
- Tooltip informativo: "Podés empezar de cero o importar un presupuesto existente en Excel. ¡Agentect lo interpreta con IA!"
- Dialog funciona normalmente (crear vacío o importar)
- Detección: navegación a `/budgets/[id]`

**Step tour-5**: En `/budgets/[id]`, tooltip sobre el editor
- "Este es tu editor de presupuesto. Podés agregar rubros, items, y Agentect guarda automáticamente cada cambio."
- CTA: "Entendido, volver al proyecto"

**Step tour-6**: En `/projects/[id]`, tooltip sobre stats actualizadas
- "¡Listo! Ya podés ver tu presupuesto impactado. A medida que cargues comprobantes, vas a ver el gasto real vs. presupuestado."
- CTA: "Siguiente →"

### 4.4 Etapa Final — Summary (todos los roles)

Modal Dialog con overview de features no cubiertas en el tour:

**Para creador (admin/supervisor):**
- [Camera] Comprobantes — subí fotos de facturas y tiques, la IA extrae los datos
- [ArrowUpDown] Administración — registrá ingresos y egresos, controlá el cashflow
- [BarChart3] Reportes — visualizá gastos por rubro, detectá desvíos a tiempo

**Para viewer (architect):**
- [Camera] Comprobantes — subí fotos de facturas y tiques
- [FolderOpen] Presupuestos — consultá presupuestos de tus proyectos (lectura)
- [Settings] Configuración — personalizá tu perfil

CTA: "Empezar a usar Agentect" → marca completado, redirige a `/`

---

## 5. Persistencia y Resumibilidad

### Modelo de datos

```sql
ALTER TABLE users ADD COLUMN onboarding_step text NOT NULL DEFAULT 'welcome';
ALTER TABLE users ADD COLUMN onboarding_completed_at timestamptz;
```

Valores de `onboarding_step`: `'welcome'` | `'tour-1'` | `'tour-2'` | `'tour-3'` | `'tour-4'` | `'tour-5'` | `'tour-6'` | `'summary'` | `'completed'`

### API

```
GET  /api/onboarding          → { step, completedAt }
PATCH /api/onboarding         → { step } → actualiza onboarding_step
POST /api/onboarding/complete → marca completed + onboarding_completed_at
POST /api/onboarding/skip     → marca completed (omitido)
```

### Lógica de resume

- Al cargar el dashboard layout, `OnboardingProvider` lee `onboarding_step` del usuario actual (vía SWR a `/api/onboarding`)
- Si `step !== 'completed'`, activa el flujo desde ese step
- Si el usuario está en una ruta diferente a la esperada por el step actual, muestra un botón "Continuar onboarding" tipo snackbar para retomar
- Cada transición de step hace `PATCH /api/onboarding`

---

## 6. Arquitectura de Componentes

### Nuevos componentes

| Componente | Tipo | Ubicación |
|---|---|---|
| `OnboardingProvider` | Context + Client Component | `components/onboarding/provider.tsx` |
| `OnboardingOverlay` | Spotlight + backdrop oscuro | `components/onboarding/overlay.tsx` |
| `OnboardingTooltip` | Popover posicionado con @floating-ui | `components/onboarding/tooltip.tsx` |
| `OnboardingWelcome` | Full-screen Dialog con slides | `components/onboarding/welcome.tsx` |
| `OnboardingSummary` | Modal Dialog final | `components/onboarding/summary.tsx` |
| `OnboardingSnackbar` | Botón "Continuar onboarding" | `components/onboarding/snackbar.tsx` |
| `useOnboarding` | Hook consumidor del context | `lib/use-onboarding.ts` |

### Integración en layout

```tsx
// apps/web/app/(dashboard)/layout.tsx
<div className="min-h-screen">
  <Sidebar />
  <MobileHeader />
  <OnboardingProvider>
    <main>{children}</main>
  </OnboardingProvider>
  <FloatingActionButton />
  <Toaster />
</div>
```

### Context shape

```typescript
interface OnboardingContext {
  step: OnboardingStep;
  isActive: boolean;
  variant: 'creator' | 'viewer';  // Determinado por rol (admin/supervisor vs architect)
  projectId: string | null;       // ID del proyecto creado durante onboarding (solo creator)
  nextStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
}
```

---

## 7. Edge Cases

| Escenario | Comportamiento |
|---|---|
| Drop-off en welcome | Próximo login → welcome se muestra de nuevo |
| Drop-off post-crear proyecto | Resume desde tour-3 (explica vista del proyecto) |
| Drop-off post-crear presupuesto | Resume desde tour-6 (volver al proyecto) |
| "Omitir onboarding" | Step → completed, no se muestra más |
| Navegación manual fuera del flujo | Tooltips se ocultan. Snackbar "Continuar onboarding" visible |
| Mobile | Mismo flujo. Tooltip de sidebar apunta al mobile header. Popovers posicionados abajo |
| Resize / scroll | @floating-ui/react reposiciona tooltips dinámicamente |
| Usuario ya tiene proyectos (invitado a org existente) | Tour usa proyectos existentes como ejemplo en vez de empty states |
| Proyecto creado durante onboarding es eliminado después | No afecta — el onboarding ya completó. Los tooltips no dependen de datos post-completion |

---

## 8. Scope Explícito — Qué NO incluye

- Onboarding para features específicos (ej: primer upload de comprobante) — eso es feature discovery, no onboarding
- Emails de bienvenida o drip campaigns
- Analytics de funnel de onboarding (se puede agregar después)
- Personalización del contenido basada en industria/tamaño de estudio
- A/B testing de variantes de onboarding
