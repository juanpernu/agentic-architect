# Plan Gate Paywall — Design Doc

> Fecha: 2026-03-02

## Objetivo

Mostrar un modal de upgrade sobre un preview borroso cuando usuarios del plan free navegan a vistas restringidas (Administración y Reportes). Incluir entry point a suscripción.

## Decisiones

- **Estilo**: Dialog overlay sobre placeholder estático con blur
- **Enfoque**: Componente reutilizable `PlanGatePage`
- **Sidebar**: Mostrar ambas entradas para free con ícono de candado
- **Contenido modal**: Feature list + botón CTA a `/settings/billing`
- **Dialog**: No se puede cerrar (sin X, sin Escape, sin click fuera)

## Componente `PlanGatePage`

**Ubicación:** `apps/web/components/plan-gate-page.tsx`

### Props

```typescript
interface PlanGatePageProps {
  title: string
  description: string
  features: string[]
  children: ReactNode   // Skeleton placeholder de fondo
}
```

> **Nota:** El prop `feature` del diseño original fue omitido intencionalmente. El componente es puramente presentacional — los callers manejan la lógica de gate con `canViewAdministration` / `canViewReports` de `usePlan()`. Si se necesita analytics de conversión en el futuro, se puede agregar como query param al link de billing.

### Comportamiento

- Usa `usePlan()` para detectar `isFreePlan`
- Si NO es free → renderiza `children` (pass-through)
- Si ES free → renderiza:
  - `children` de fondo con `blur-sm opacity-50 pointer-events-none`
  - Shadcn `Dialog` con `open={true}`, sin botón de cierre
  - No cierra con Escape ni click fuera (`onOpenChange` ignorado)

### Contenido del Dialog

- Ícono: `Sparkles` (Lucide)
- Título: "Desbloqueá {title}"
- Descripción: 1 línea contextual
- Feature list: 3-4 items con `Check` icons
- Botón primario: "Ver planes" → `/settings/billing`
- Link secundario: "Volver al panel" → `/`

### Loading state

- Mientras `usePlan()` carga → renderiza `children` (skeletons) sin blur ni dialog
- Evita flash de paywall si el usuario es paid

## Skeletons de fondo

### Administración

- 3 KPI cards skeleton (rectángulos con rounded + shimmer)
- Área de chart (rectángulo 300px height)
- Tabla skeleton (6 filas)

### Reportes

- 3 KPI cards skeleton
- Filtros skeleton (2 selects + 2 date pickers en fila)
- Lista de 5 progress bars skeleton

Se implementan como componentes estáticos dentro de cada página, pasados como `children`.

## Cambios en Sidebar

En `sidebar.tsx`:

1. Dejar de ocultar Reportes para free plan (eliminar filtro `isFreePlan` en Reports)
2. Agregar ícono `Lock` (Lucide, 14px, muted color) al lado del label para items que requieren plan upgrade
3. Condición: mostrar lock si `isFreePlan` y el item es `/reports` o `/administration`

## Integración en páginas

### `/administration/page.tsx`

```tsx
export default function AdministrationPage() {
  return (
    <PlanGatePage
      feature="administration"
      title="Administración"
      description="Controlá el flujo financiero de todos tus proyectos."
      features={[
        'Flujo de caja mensual (ingresos vs egresos)',
        'Balance por proyecto',
        'Presupuestado vs ejecutado por rubro',
        'Gestión de ingresos y egresos',
      ]}
    >
      {/* isFreePlan ? skeleton : contenido real */}
    </PlanGatePage>
  )
}
```

### `/reports/page.tsx`

```tsx
<PlanGatePage
  feature="reports"
  title="Reportes"
  description="Analizá tus gastos con reportes detallados."
  features={[
    'Análisis de gastos por rubro',
    'Filtros por fecha y proyecto',
    'Desglose detallado por comprobante',
  ]}
>
  {/* isFreePlan ? skeleton : contenido real */}
</PlanGatePage>
```

## Feature Lists (copy final)

**Administración:**
- Flujo de caja mensual (ingresos vs egresos)
- Balance por proyecto
- Presupuestado vs ejecutado por rubro
- Gestión de ingresos y egresos

**Reportes:**
- Análisis de gastos por rubro
- Filtros por fecha y proyecto
- Desglose detallado por comprobante
