# Settings Restructure & Cost Centers — Design

**Goal:** Reestructurar `/settings` como hub con tabs horizontales hacia 3 sub-páginas (General, Usuarios, Centro de Costos), e implementar el CRUD de centros de costos con integración en comprobantes.

**Architecture:** Sub-rutas reales con layout compartido en Next.js App Router. Nueva tabla `cost_centers` a nivel organización, vinculada 1:1 con comprobantes (campo requerido).

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), shadcn/ui, SWR, Tailwind CSS 4.

---

## 1. Estructura de rutas y layout

**Rutas:**

```
/settings              → redirect a /settings/general
/settings/general      → OrgSettingsForm (existente)
/settings/users        → Tabla de usuarios (existente, extraer de settings/page.tsx)
/settings/cost-centers → CRUD centros de costos (nuevo)
```

**Layout compartido** (`/settings/layout.tsx`):

- Verifica permisos via `useCurrentUser()`
- Renderiza `PageHeader` con título "Ajustes"
- Tabs horizontales con `Link` a cada sub-ruta, tab activa resaltada según `pathname`
- Tabs visibles según rol:
  - **Admin**: General | Usuarios | Centro de Costos
  - **Supervisor**: General | Centro de Costos
  - **Architect**: General (solo lectura de datos de org)

---

## 2. Modelo de datos

**Nueva tabla `cost_centers`:**

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid PK | default gen_random_uuid() |
| `organization_id` | text FK | referencia a organizations |
| `name` | text NOT NULL | nombre del centro de costos |
| `description` | text NULL | descripción opcional |
| `color` | text NULL | mismo sistema de colores que projects (ProjectColor) |
| `is_active` | boolean | default true, para soft-delete |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

**Modificación a tabla `receipts`:**

| Campo nuevo | Tipo | Notas |
|-------------|------|-------|
| `cost_center_id` | uuid NULL FK | referencia a cost_centers, nullable para comprobantes legacy |

**Tipo compartido nuevo** en `packages/shared/src/types.ts`:

```typescript
export interface CostCenter {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: ProjectColor | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

Se reutiliza `ProjectColor` para los colores — mismo set de 8 colores, mismo `PROJECT_COLOR_HEX` para renderizar.

---

## 3. API endpoints

**Nuevo recurso `/api/cost-centers`:**

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| `GET` | `/api/cost-centers` | Todos | Lista centros de costos activos de la org |
| `POST` | `/api/cost-centers` | Admin/Supervisor | Crea un centro de costos |
| `PATCH` | `/api/cost-centers/[id]` | Admin/Supervisor | Edita nombre, descripción, color |
| `DELETE` | `/api/cost-centers/[id]` | Admin/Supervisor | Soft-delete (is_active = false) |

**Modificaciones a endpoints existentes:**

- `POST /api/receipts` — requiere `cost_center_id` en el body, valida que exista y sea activo
- `PATCH /api/receipts/[id]` — permite actualizar `cost_center_id`
- `GET /api/receipts` y `GET /api/receipts/[id]` — incluyen `cost_center` en el select (id, name, color)

El DELETE es soft-delete para no romper comprobantes que ya tengan ese centro asignado. El GET filtra solo `is_active = true`.

---

## 4. UI de Centro de Costos (`/settings/cost-centers`)

**Vista principal:**

- Botón "Nuevo centro de costos" arriba a la derecha (visible para admin/supervisor)
- Tabla con columnas: Color (dot), Nombre, Descripción, Acciones (editar/eliminar)
- Si no hay centros de costos: `EmptyState` con ícono y CTA para crear el primero
- Animaciones consistentes con el resto de la app (`animate-slide-up`)

**Crear/Editar:**

- Dialog modal (mismo patrón que `ProjectFormDialog`)
- Campos: nombre (required), descripción (textarea, optional), color picker (optional, mismo componente de 8 círculos que proyectos)
- Validación: nombre no vacío, máximo 100 chars

**Eliminar:**

- Dialog de confirmación (mismo patrón que el delete de receipts)
- Soft-delete: marca `is_active = false`
- Si el centro tiene comprobantes asignados, se elimina igual pero los comprobantes conservan la referencia

---

## 5. Integración con comprobantes

**En la review post-upload (`receipt-review.tsx`):**

- Nuevo `Select` de centro de costos debajo del select de proyecto — **obligatorio**
- No se puede confirmar el comprobante sin asignar un centro de costos
- Muestra dot de color al lado del nombre (mismo patrón que el select de proyecto)
- Los centros de costos se cargan con `useSWR` desde `/api/cost-centers`

**En el detalle del comprobante (`/receipts/[id]`):**

- Nueva card info mostrando el centro de costos asignado con su color dot
- Si el comprobante no tiene centro de costos (legacy), se muestra la card con un botón "Asignar centro de costos" que abre un select para elegirlo
- Admin/supervisor pueden editar el centro de costos asignado

**En la tabla de comprobantes (`/receipts`):**

- Nueva columna "Centro de Costos" con badge coloreado (mismo estilo que la columna Proyecto)
- Si no tiene, celda con guión

**Tipos actualizados:**

- `ReceiptWithDetails` y `ReceiptDetail` incluyen `cost_center: { id: string; name: string; color: ProjectColor | null } | null`
- `ConfirmReceiptInput` incluye `cost_center_id: string` (requerido)
