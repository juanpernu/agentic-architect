# Agentect — Módulo de Administración
## Plan de Implementación: Ingresos y Egresos por Obra

> **Versión:** 1.1 · **Fecha:** Febrero 2026
> **Dirigido a:** Main Planner + Developer Junior por área
> **Resumen:** 5 fases · 16 tareas · 3 áreas (DB, Backend, Frontend)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar el módulo de Administración que permite llevar el flujo de caja real de cada obra —ingresos y egresos— y compararlo contra el presupuesto aprobado.

**Architecture:** 4 tablas nuevas (income_types, expense_types, incomes, expenses) con RLS. APIs REST siguiendo patrones existentes. UI con 3 páginas nuevas + tab financiero en proyectos + tab en settings.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Shadcn/ui · Supabase (PostgreSQL) · Clerk (auth) · SWR (data fetching) · Zod (validación) · Recharts (gráficos)

---

## 1. Contexto del Proyecto

Agentect es un SaaS para gestión de obras de construcción orientado a estudios de arquitectura argentinos. El sistema ya cuenta con gestión de proyectos, carga de comprobantes con AI, presupuestos, reportes y usuarios.

Este plan agrega el **módulo de Administración**, que permite llevar el flujo de caja real de cada obra —ingresos y egresos— y compararlo contra el presupuesto aprobado.

### Stack tecnológico relevante

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Shadcn/ui · Supabase (PostgreSQL) · Clerk (auth) · SWR (data fetching) · Zod (validación) · Recharts (gráficos)

### Convenciones de código

- Idioma de la UI: **español argentino con tuteo** (vos). Ej: "Registrá un egreso", "Seleccioná el proyecto".
- Idioma del código (variables, funciones, comentarios): **inglés siempre**.
- Commits con **Conventional Commits**: `feat: agregar api de egresos`, `fix: corregir validación de rubro`.
- Branches: `feature/nombre` → PR → merge a master.

### Roles y acceso al módulo

| Rol | Acceso |
|-----|--------|
| Admin | Acceso completo al módulo y a Settings/Administración |
| Supervisor | Puede cargar y editar ingresos/egresos. NO ve Settings/Administración |
| Architect | Sin acceso al módulo de administración (403) |
| Plan Free | Solo resumen básico con upgrade banner (igual que Reportes) |

---

## 2. Arquitectura del Módulo

### 2.1 Modelo de datos

Se crean 4 tablas nuevas en Supabase. Todas con RLS habilitado usando el patrón existente (`get_org_id()` y `get_user_role()`).

| Tabla | Columnas principales | Notas |
|-------|---------------------|-------|
| `income_types` | id, org_id, name, is_active | Tipos de ingreso por org. Seeds default: Anticipo, Cuota, Pago final, Otros. |
| `expense_types` | id, org_id, name, is_active | Tipos de egreso por org. El usuario los crea libremente. Sin seeds. |
| `incomes` | id, org_id, project_id, amount, date, income_type_id, description, created_by | FK a projects y income_types. created_by → users (Clerk user_id). |
| `expenses` | id, org_id, project_id, amount, date, expense_type_id, rubro_id (nullable), receipt_id (nullable), description, created_by | rubro_id y receipt_id son opcionales e independientes entre sí. |

### 2.2 Estructura de rutas

| Ruta | Descripción |
|------|-------------|
| `/administration` | Resumen: KPIs globales, balance por obra, timeline |
| `/administration/incomes` | Tabla de ingresos + formulario de carga |
| `/administration/expenses` | Tabla de egresos + formulario de carga |
| `/settings/administration` | CRUD de tipos de ingreso y egreso (solo admin) |
| `/api/incomes` | GET (lista) / POST (crear) |
| `/api/incomes/[id]` | GET / PATCH / DELETE |
| `/api/expenses` | GET (lista) / POST (crear) |
| `/api/expenses/[id]` | GET / PATCH / DELETE |
| `/api/income-types` | GET / POST |
| `/api/income-types/[id]` | PATCH / DELETE |
| `/api/expense-types` | GET / POST |
| `/api/expense-types/[id]` | PATCH / DELETE |
| `/api/administration/summary` | KPIs + balance por obra |
| `/api/administration/cashflow` | Datos para gráfico de flujo de caja |
| `/api/administration/vs-budget` | Comparación presupuesto vs real por rubro |

---

## 3. Fases de Implementación

| # | Fase | Qué se construye | Tareas |
|---|------|-----------------|--------|
| 1 | Base de Datos y Tipos | Migrations SQL de las 4 tablas + RLS + seeds + APIs de income-types y expense-types + tab en Settings | T-01, T-02, T-03 |
| 2 | Egresos | API completa de expenses + página de egresos con tabla, filtros y dialog de carga | T-04, T-05, T-06 |
| 3 | Ingresos | API completa de incomes + página de ingresos con tabla y dialog de carga | T-07, T-08 |
| 4 | Resumen y Comparación | APIs de agregación + página de resumen + gráficos + tab financiero en detalle de proyecto | T-09, T-10, T-11, T-12 |
| 5 | Polish y Seguridad | Plan guard, empty states, mobile, sidebar, permisos finales, tests manuales | T-13, T-14, T-15, T-16 |

> Las fases 1 a 3 se pueden desarrollar en paralelo (un developer de DB, uno de Backend, uno de Frontend) salvo las dependencias indicadas en cada tarea.

---

## 4. Tareas Detalladas

---

### FASE 1 — Base de Datos y Tipos

---

#### T-01 · Migrations SQL — Tablas y RLS
**Área:** Base de Datos · **Dificultad:** Media · **Fase:** 1 — Sin prerequisitos

**Descripción**
Crear las 4 tablas nuevas en Supabase con sus constraints, foreign keys, índices y políticas de Row Level Security (RLS). Seguir el mismo patrón que usan las tablas existentes del proyecto.

**Prerequisitos**
Ninguno. Esta es la primera tarea del módulo.

**Pasos detallados**

1. Abrí Supabase Dashboard → SQL Editor.
2. Creá el archivo `supabase/migrations/[timestamp]_administration_module.sql` (el timestamp es la fecha y hora actual, ej: `20260220120000`).
3. Escribí el SQL para `income_types` con columnas: `id` (uuid DEFAULT gen_random_uuid()), `org_id` (uuid NOT NULL), `name` (text NOT NULL), `is_active` (boolean DEFAULT true), `created_at` (timestamptz DEFAULT now()). FK: `org_id → organizations(id) ON DELETE CASCADE`.
4. Escribí el SQL para `expense_types` con las mismas columnas que `income_types`.
5. Escribí el SQL para `incomes` con columnas: `id` (uuid), `org_id` (uuid), `project_id` (uuid), `amount` (numeric(12,2) NOT NULL), `date` (date NOT NULL), `income_type_id` (uuid), `description` (text), `created_by` (uuid), `created_at`, `updated_at`. FKs: `org_id → organizations`, `project_id → projects`, `income_type_id → income_types`, `created_by → users`.
6. Escribí el SQL para `expenses` con las mismas columnas que `incomes` más: `expense_type_id` (uuid), `rubro_id` (uuid NULLABLE), `receipt_id` (uuid NULLABLE). FK opcional: `rubro_id → rubros`, `receipt_id → receipts`.
7. Habilitá RLS en las 4 tablas: `ALTER TABLE income_types ENABLE ROW LEVEL SECURITY;`
8. Creá policies usando el helper `get_org_id()`: SELECT para usuarios autenticados de la org, INSERT/UPDATE/DELETE solo para admin y supervisor.
9. Creá índices: `idx` en `org_id` de cada tabla, `idx` en `project_id` de `incomes` y `expenses`.
10. Ejecutá el migration en Supabase Dashboard y verificá que no haya errores.

**Archivos a crear / modificar**
- `supabase/migrations/[timestamp]_administration_module.sql`

**Criterios de aceptación**
- Las 4 tablas existen en Supabase sin errores de constraint.
- RLS habilitado: un usuario de otra org no puede ver los datos.
- Los índices aparecen en el panel de Supabase.
- Se puede insertar un registro de prueba en cada tabla desde el SQL Editor.

---

#### T-02 · Seeds y Tipos de Ingreso/Egreso — API Routes
**Área:** Backend · **Dificultad:** Fácil · **Fase:** 1 — Depende de T-01

**Descripción**
Crear los seeds de tipos de ingreso por defecto y las 4 API routes para gestionar income-types y expense-types. Seguir exactamente el patrón de rutas existente en el proyecto.

**Prerequisitos**
T-01 debe estar completa (tablas creadas).

**Pasos detallados**

1. Creá el archivo `apps/web/lib/schemas/administration.ts` con los schemas Zod: `incomeTypeCreateSchema { name: z.string().min(1).max(100) }`, `expenseTypeCreateSchema` (igual), y los schemas de update (igual al create).
2. Creá `apps/web/app/api/income-types/route.ts`. El GET usa `getAuthContext()` para obtener `orgId` y devuelve todos los `income_types` de la org donde `is_active = true`, ordenados por `name`. El POST valida con `validateBody(incomeTypeCreateSchema, req)` y crea el tipo.
3. Creá `apps/web/app/api/income-types/[id]/route.ts` con PATCH (actualiza `name` o `is_active`) y DELETE (soft-delete: `is_active = false`). Solo admin puede modificar.
4. Hacé lo mismo para `expense-types`: creá `route.ts` y `[id]/route.ts` con la misma lógica.
5. En el migration SQL de T-01 o en uno nuevo, agregá el INSERT de los tipos de ingreso por defecto: `Anticipo`, `Cuota`, `Pago final`, `Otros`. También agregá un trigger que inserte estos defaults cuando se crea una nueva organización.
6. Probá las rutas con curl o Postman: GET `/api/income-types`, POST con name, PATCH para cambiar nombre, DELETE.

**Archivos a crear / modificar**
- `apps/web/lib/schemas/administration.ts`
- `apps/web/app/api/income-types/route.ts`
- `apps/web/app/api/income-types/[id]/route.ts`
- `apps/web/app/api/expense-types/route.ts`
- `apps/web/app/api/expense-types/[id]/route.ts`
- `supabase/migrations/[timestamp]_administration_seeds.sql` (trigger + seeds)

**Criterios de aceptación**
- GET `/api/income-types` devuelve los 4 tipos default.
- POST crea un tipo nuevo con nombre.
- DELETE hace soft-delete (`is_active = false`, no aparece en el GET).
- Un architect recibe 403 al intentar crear o eliminar.

---

#### T-03 · Settings — Tab Administración (UI)
**Área:** Frontend · **Dificultad:** Fácil · **Fase:** 1 — Depende de T-02

**Descripción**
Agregar una nueva tab "Administración" en la página de Settings donde el admin puede gestionar los tipos de ingreso y egreso. Seguir el mismo patrón visual y de código que las tabs existentes (Bancos, Usuarios).

**Prerequisitos**
T-02 debe estar completa (API routes de tipos funcionando).

**Pasos detallados**

1. Abrí `apps/web/app/(dashboard)/settings/layout.tsx` y agregá el tab "Administración" con path `/settings/administration`. Aplicá el mismo role gate que "Billing" (solo admin visible).
2. Creá la carpeta `apps/web/app/(dashboard)/settings/administration/` y dentro `page.tsx`.
3. En la page, usá dos `Card`: una para "Tipos de Ingreso" y otra para "Tipos de Egreso".
4. En cada Card, mostrá la lista de tipos activos con SWR (`useSWR('/api/income-types', fetcher)`). Cada item tiene nombre, un botón de editar (lápiz) y un botón de eliminar (trash) con `AlertDialog` de confirmación.
5. Agregá un botón "Agregar tipo" que abre un `Dialog` con un `Input` para el nombre y un `Button` de guardar. Al guardar, hace POST a `/api/income-types` y luego `mutate()` para refrescar la lista.
6. Al hacer clic en editar, el nombre se convierte en un `Input` inline editable. Al confirmar, hace PATCH.
7. Usá el componente `EmptyState` existente cuando no haya tipos.
8. Para tipos de ingreso: mostrá un badge indicando cuáles son los 4 defaults (no se pueden eliminar, solo desactivar).

**Archivos a crear / modificar**
- `apps/web/app/(dashboard)/settings/layout.tsx` (modificar)
- `apps/web/app/(dashboard)/settings/administration/page.tsx`

**Criterios de aceptación**
- El tab "Administración" aparece en Settings solo para admin.
- Se pueden agregar, editar y eliminar tipos de egreso.
- Los 4 tipos de ingreso default no se pueden eliminar.
- Los cambios se reflejan inmediatamente sin recargar la página.

---

### FASE 2 — Egresos

---

#### T-04 · Schemas Zod y Tipos TypeScript para Administración
**Área:** Backend · **Dificultad:** Fácil · **Fase:** 2 — Depende de T-01

**Descripción**
Agregar los tipos TypeScript compartidos y los schemas de validación para ingresos y egresos. Los tipos van al paquete `@architech/shared` y los schemas a `apps/web/lib/schemas/`.

**Prerequisitos**
T-01 debe estar completa.

**Pasos detallados**

1. Abrí `packages/shared/src/types.ts` y agregá las interfaces: `Income { id, orgId, projectId, amount, date, incomeTypeId, description, createdBy, createdAt, updatedAt }`, `IncomeType { id, orgId, name, isActive }`, `Expense` (igual que Income más `expenseTypeId`, `rubroId?: string`, `receiptId?: string`), `ExpenseType` (igual que IncomeType).
2. En `apps/web/lib/schemas/administration.ts` (ya creado en T-02), agregá `expenseCreateSchema` con: `projectId` (z.string().uuid()), `amount` (z.number().positive()), `date` (z.string()), `expenseTypeId` (z.string().uuid()), `rubroId` (z.string().uuid().optional()), `receiptId` (z.string().uuid().optional()), `description` (z.string().optional()). Y `incomeCreateSchema` similar pero sin `rubroId` y `receiptId`.
3. Agregá también `expenseUpdateSchema` e `incomeUpdateSchema` con todos los campos opcionales (usando `.partial()`).
4. Ejecutá `npm run build` en la raíz para verificar que los tipos compilan sin errores.

**Archivos a crear / modificar**
- `packages/shared/src/types.ts` (modificar)
- `apps/web/lib/schemas/administration.ts` (completar)

**Criterios de aceptación**
- `npm run build` completa sin errores de TypeScript.
- Los tipos `Income`, `Expense`, `IncomeType`, `ExpenseType` están disponibles desde `@architech/shared`.
- Los schemas Zod validan correctamente.

---

#### T-05 · API Routes — Egresos
**Área:** Backend · **Dificultad:** Alta · **Fase:** 2 — Depende de T-04

**Descripción**
Crear las rutas de API para egresos. Esta es la ruta más compleja del módulo porque el egreso puede tener hasta 3 relaciones opcionales (tipo, rubro, comprobante) y requiere validaciones cruzadas.

**Prerequisitos**
T-04 debe estar completa (schemas y tipos definidos).

**Pasos detallados**

1. Creá `apps/web/app/api/expenses/route.ts`. El GET recibe query params opcionales: `projectId`, `expenseTypeId`, `rubroId`, `dateFrom`, `dateTo`. Hace un SELECT a la tabla `expenses` con JOIN a `expense_types` (nombre del tipo), `projects` (nombre de la obra) y `rubros` (nombre del rubro). Ordená por `date DESC`. Solo devuelve registros de la org del usuario.
2. El POST valida con `validateBody(expenseCreateSchema, req)`. Antes de insertar, verificá que el `projectId` pertenezca a la org. Si `rubroId` está presente, verificá que el rubro pertenezca al proyecto. Si `receiptId` está presente, verificá que el receipt pertenezca al proyecto. Si alguna verificación falla, retorná 400 con mensaje claro.
3. Creá `apps/web/app/api/expenses/[id]/route.ts` con GET (detalle con joins), PATCH (actualizar campos, mismas validaciones que el POST) y DELETE (hard delete). Solo admin y supervisor pueden modificar.
4. En el GET de detalle, si hay `receiptId`, incluí los datos del receipt (`vendor`, `total`, `image_url` signed) para mostrar en la UI.
5. Agregá el role check al inicio de cada handler: si `ctx.role === 'architect'`, retorná `forbidden()`.

**Archivos a crear / modificar**
- `apps/web/app/api/expenses/route.ts`
- `apps/web/app/api/expenses/[id]/route.ts`

**Criterios de aceptación**
- GET `/api/expenses?projectId=xxx` devuelve solo los egresos del proyecto.
- POST crea un egreso sin rubro (solo tipo), POST con `rubroId` y `receiptId` también funciona.
- POST con `rubroId` de otro proyecto retorna 400.
- DELETE elimina el egreso correctamente.
- Architect recibe 403 en POST/PATCH/DELETE.

---

#### T-06 · Página de Egresos — UI
**Área:** Frontend · **Dificultad:** Alta · **Fase:** 2 — Depende de T-05

**Descripción**
Construir la página `/administration/expenses` con la tabla de egresos, filtros y el dialog para registrar un nuevo egreso. Esta es la UI más compleja del módulo porque el formulario tiene **campos dependientes**: al seleccionar proyecto se cargan los rubros y los comprobantes de ese proyecto.

**Prerequisitos**
T-05 debe estar completa (API de egresos funcionando).

**Pasos detallados**

1. Creá la estructura de carpetas: `apps/web/app/(dashboard)/administration/layout.tsx` (con sidebar nav igual al de settings) y `apps/web/app/(dashboard)/administration/expenses/page.tsx`.
2. En la página, usá SWR para cargar los egresos: `useSWR('/api/expenses', fetcher)`. Mostrá una tabla con columnas: Obra, Tipo, Rubro, Monto, Fecha, Comprobante (ícono de clip si tiene), Descripción, Acciones (editar/eliminar).
3. Agregá una barra de filtros con `Select` para: Proyecto (carga `/api/projects`), Tipo de egreso (carga `/api/expense-types`), Rubro (se activa solo cuando hay un proyecto seleccionado). Los filtros modifican los query params de la URL y el SWR usa esos params.
4. Creá el componente `ExpenseFormDialog` en `apps/web/components/expense-form-dialog.tsx`. El dialog tiene los campos: Proyecto (Select obligatorio), Tipo de egreso (Select obligatorio), Rubro (Select opcional, se carga dinámicamente con `useSWR('/api/rubros?budgetId=...', fetcher, { enabled: !!projectId })`), Monto (`CurrencyInput`), Fecha (Input type date), Comprobante (Select opcional, carga receipts del proyecto), Descripción (Textarea opcional).
5. La lógica de campos dependientes: cuando el usuario cambia de proyecto, resetear el valor de rubro y comprobante, y recargar ambas listas.
6. Al guardar, hace POST a `/api/expenses`, cierra el dialog, muestra toast de éxito con Sileo y hace `mutate()` en el SWR de la tabla.
7. Agregá opción de editar (abre el mismo dialog pre-populado) y eliminar con `AlertDialog` de confirmación.
8. Mostrá el monto con `formatCurrency()` (es-AR, ARS).
9. Implementá el role gate: si el usuario es architect, redirigir o mostrar mensaje de acceso denegado.

**Archivos a crear / modificar**
- `apps/web/app/(dashboard)/administration/layout.tsx`
- `apps/web/app/(dashboard)/administration/expenses/page.tsx`
- `apps/web/components/expense-form-dialog.tsx`

**Criterios de aceptación**
- La tabla muestra egresos con todos los campos correctamente.
- El filtro por proyecto recarga la tabla.
- Al seleccionar proyecto en el formulario, el select de rubro se popula con los rubros de ese presupuesto.
- Se puede crear un egreso sin rubro y sin comprobante.
- Se puede crear un egreso con rubro Y comprobante vinculado.
- Los montos se muestran en formato ARS.
- Architect no puede acceder a la página.

---

### FASE 3 — Ingresos

---

#### T-07 · API Routes — Ingresos
**Área:** Backend · **Dificultad:** Media · **Fase:** 3 — Depende de T-04

**Descripción**
Crear las rutas de API para ingresos. Es similar a la API de egresos pero más simple porque los ingresos no tienen rubro ni comprobante asociado.

**Pasos detallados**

1. Creá `apps/web/app/api/incomes/route.ts`. El GET acepta query params opcionales: `projectId`, `incomeTypeId`, `dateFrom`, `dateTo`. Hace SELECT con JOIN a `income_types` y `projects`. Ordená por `date DESC`.
2. El POST valida con `validateBody(incomeCreateSchema, req)`. Verificá que el `projectId` pertenezca a la org antes de insertar.
3. Creá `apps/web/app/api/incomes/[id]/route.ts` con GET, PATCH y DELETE. Mismo patrón que expenses pero más simple.
4. Agregá role check: architect recibe 403 en POST/PATCH/DELETE.

**Archivos a crear / modificar**
- `apps/web/app/api/incomes/route.ts`
- `apps/web/app/api/incomes/[id]/route.ts`

**Criterios de aceptación**
- GET devuelve ingresos filtrados por proyecto.
- POST crea un ingreso correctamente.
- PATCH actualiza monto y tipo.
- Architect recibe 403 en operaciones de escritura.

---

#### T-08 · Página de Ingresos — UI
**Área:** Frontend · **Dificultad:** Media · **Fase:** 3 — Depende de T-07

**Descripción**
Construir la página `/administration/incomes`. Es más simple que la de egresos porque el formulario no tiene campos dependientes complejos.

**Pasos detallados**

1. Creá `apps/web/app/(dashboard)/administration/incomes/page.tsx`.
2. Tabla con columnas: Obra, Tipo, Monto, Fecha, Descripción, Acciones.
3. Filtros: Proyecto, Tipo de ingreso.
4. Creá `apps/web/components/income-form-dialog.tsx` con campos: Proyecto (Select), Tipo de ingreso (Select de `/api/income-types`), Monto (`CurrencyInput`), Fecha, Descripción (opcional).
5. Al guardar, POST a `/api/incomes`, toast de éxito, `mutate()`.
6. Editar y eliminar igual que en egresos.

**Archivos a crear / modificar**
- `apps/web/app/(dashboard)/administration/incomes/page.tsx`
- `apps/web/components/income-form-dialog.tsx`

**Criterios de aceptación**
- Se puede registrar un ingreso y aparece en la tabla.
- Los filtros funcionan.
- El dialog de edición pre-popula los campos.
- Los montos en formato ARS.

---

### FASE 4 — Resumen y Comparación

---

#### T-09 · APIs de Agregación
**Área:** Backend · **Dificultad:** Alta · **Fase:** 4 — Depende de T-05 y T-07

**Descripción**
Crear las 3 APIs que alimentan los dashboards y comparaciones. Estas rutas hacen queries SQL con agregaciones y son las más complejas de la fase.

**Pasos detallados**

1. Creá `apps/web/app/api/administration/summary/route.ts`. Hace dos queries en paralelo (`Promise.all`): total de ingresos por org (con filtro opcional de `projectId` y fechas), total de egresos por org. Calcula `balance = total_ingresos - total_egresos`. También devuelve un array con el balance por proyecto: `[{ projectId, projectName, totalIncome, totalExpense, balance }]`.
2. Creá `apps/web/app/api/administration/cashflow/route.ts`. Recibe query params: `projectId` (opcional), `year` (default: año actual). Devuelve array de 12 meses con: `[{ month: 1, monthName: 'Ene', totalIncome, totalExpense, balance }]`. Usá `DATE_TRUNC('month', date)` en SQL.
3. Creá `apps/web/app/api/administration/vs-budget/route.ts`. Recibe `projectId` (obligatorio). Busca el budget publicado del proyecto (`status = 'published'`). Por cada rubro en el presupuesto, calcula la suma de egresos reales que tienen ese `rubro_id`. Devuelve: `[{ rubroId, rubroName, budgeted: number, actual: number, difference: number, percentage: number }]`. Si un rubro no tiene egresos, `actual = 0`.
4. Todos estos endpoints deben validar que el `projectId` (si se pasa) pertenezca a la org del usuario.

**Archivos a crear / modificar**
- `apps/web/app/api/administration/summary/route.ts`
- `apps/web/app/api/administration/cashflow/route.ts`
- `apps/web/app/api/administration/vs-budget/route.ts`

**Criterios de aceptación**
- Summary devuelve balance correcto con al menos un ingreso y un egreso cargados.
- Cashflow devuelve 12 meses aunque algunos tengan 0.
- vs-budget devuelve todos los rubros del presupuesto, con `actual=0` en los que no tienen egresos.
- Un `projectId` de otra org devuelve 403.

---

#### T-10 · Página de Resumen — UI
**Área:** Frontend · **Dificultad:** Alta · **Fase:** 4 — Depende de T-09

**Descripción**
Construir la página principal `/administration` con los KPIs, el gráfico de flujo de caja y la tabla de balance por obra.

**Pasos detallados**

1. Creá `apps/web/app/(dashboard)/administration/page.tsx`.
2. Arriba: un Select de Proyecto con opción "Todos los proyectos". Cambia un estado `projectId` que se pasa a todos los componentes de la página.
3. KPI Cards (igual que `dashboard-kpis.tsx`): Total Ingresado, Total Egresado, Balance (verde si positivo, rojo si negativo), % Ejecutado del presupuesto (solo si hay proyecto seleccionado).
4. Gráfico de flujo de caja: usá Recharts `LineChart` con dos líneas (Ingresos en azul, Egresos en naranja) y 12 puntos (meses del año). Carga de `/api/administration/cashflow`.
5. Tabla de balance por obra: columnas Proyecto, Ingresos, Egresos, Balance. El balance colorea verde/rojo. Carga de `/api/administration/summary`.
6. Mostrá `LoadingSkeleton` mientras cargan los datos.

**Archivos a crear / modificar**
- `apps/web/app/(dashboard)/administration/page.tsx`
- `apps/web/components/administration/cashflow-chart.tsx`
- `apps/web/components/administration/balance-by-project-table.tsx`

**Criterios de aceptación**
- Los KPIs muestran los totales correctos.
- El gráfico de líneas muestra ingresos vs egresos por mes.
- Al filtrar por proyecto, todos los datos se actualizan.
- La tabla de balance muestra el color correcto según positivo/negativo.

---

#### T-11 · Tab Financiero en Detalle de Proyecto
**Área:** Frontend · **Dificultad:** Media · **Fase:** 4 — Depende de T-09

**Descripción**
Agregar una nueva tab "Financiero" en la página de detalle de proyecto (`/projects/[id]`) que muestra la comparación presupuesto vs real por rubro.

**Pasos detallados**

1. Abrí `apps/web/app/(dashboard)/projects/[id]/page.tsx`. Agregá una tab "Financiero" al `TabList` existente (o creá Tabs si no existen).
2. El contenido de la tab carga `/api/administration/vs-budget?projectId=[id]` con SWR.
3. Mostrá una tabla con columnas: Rubro, Presupuestado, Ejecutado, Diferencia, % Avance. La columna de diferencia va en verde si sobra presupuesto, rojo si se excedió.
4. Debajo de cada fila de rubro, agregá una barra de progreso que muestra visualmente el % ejecutado. Si supera el 100%, la barra va en rojo.
5. Arriba de la tabla, mostrá 3 KPI cards: Total Presupuestado, Total Ejecutado, Diferencia global.
6. Si el proyecto no tiene presupuesto publicado, mostrá un `EmptyState` con mensaje: "Este proyecto no tiene un presupuesto publicado. Publicá un presupuesto para ver la comparación financiera."

**Archivos a crear / modificar**
- `apps/web/app/(dashboard)/projects/[id]/page.tsx` (modificar)
- `apps/web/components/administration/vs-budget-table.tsx`

**Criterios de aceptación**
- La tab "Financiero" aparece en el detalle de proyecto.
- La tabla muestra todos los rubros del presupuesto.
- Las barras de progreso reflejan el % ejecutado.
- Rubros con ejecución > 100% se marcan en rojo.
- Sin presupuesto publicado, aparece el EmptyState.

---

#### T-12 · Resumen — Sección vs Presupuesto
**Área:** Frontend · **Dificultad:** Media · **Fase:** 4 — Depende de T-10 y T-11

**Descripción**
Agregar en la página de resumen `/administration` la vista de comparación por rubro cuando se selecciona un proyecto específico.

**Pasos detallados**

1. En la página `/administration`, cuando el usuario selecciona un proyecto específico (no "Todos"), mostrar debajo de los KPIs la tabla vs-budget del componente creado en T-11 (reutilizarlo).
2. Agregá un "Porcentaje de avance global" como una `Progress` bar prominente arriba de la tabla.
3. Cuando se selecciona "Todos los proyectos", ocultar esta sección y mostrar solo el gráfico de cashflow y la tabla de balance por obra.

**Archivos a crear / modificar**
- `apps/web/app/(dashboard)/administration/page.tsx` (modificar)

**Criterios de aceptación**
- Seleccionando un proyecto aparece la sección de comparación.
- Seleccionando "Todos" desaparece la sección.
- La barra de avance global es visible y precisa.

---

### FASE 5 — Polish y Seguridad

---

#### T-13 · Sidebar — Entrada "Administración"
**Área:** Frontend · **Dificultad:** Fácil · **Fase:** 5 — Depende de T-06 y T-08

**Descripción**
Agregar la entrada "Administración" en el sidebar y en el bottom navigation mobile. Solo visible para admin y supervisor.

**Pasos detallados**

1. Abrí `apps/web/components/sidebar.tsx`. Importá el ícono adecuado de Lucide (sugerencia: `Landmark` o `Wallet`). Agregá el item con path `/administration` y label "Administración".
2. Aplicá el mismo role gate que Reportes: `{ isAdminOrSupervisor && <NavItem .../> }`.
3. Repetí el mismo cambio en `apps/web/components/bottom-nav.tsx` para mobile.
4. El sub-menú dentro de `/administration` (Resumen, Ingresos, Egresos) se implementa como tabs horizontales dentro del layout (patrón de Settings).

**Archivos a crear / modificar**
- `apps/web/components/sidebar.tsx` (modificar)
- `apps/web/components/bottom-nav.tsx` (modificar)

**Criterios de aceptación**
- "Administración" aparece en el sidebar para admin y supervisor.
- Architect NO ve la entrada.
- En mobile, el bottom nav también tiene la entrada.
- La ruta activa se resalta correctamente.

---

#### T-14 · Plan Guard — Límite por Plan
**Área:** Backend + Frontend · **Dificultad:** Media · **Fase:** 5 — Depende de T-13

**Descripción**
Bloquear el acceso completo al módulo de administración en el plan Free. Mostrar el upgrade banner cuando el usuario intenta acceder.

**Pasos detallados**

1. Abrí `apps/web/lib/plan-guard.ts`. Agregá la verificación `'administration'`: false para plan free, true para advance y enterprise. Seguí el patrón de `'reports'`.
2. En `apps/web/app/(dashboard)/administration/layout.tsx`, agregá la verificación del plan: `const { canViewAdministration } = usePlan()`. Si es false, mostrá el componente `UpgradeBanner` con mensaje: "El módulo de Administración está disponible en los planes Advance y Enterprise."
3. En las API routes `summary`, `cashflow` y `vs-budget`, agregá `checkPlanLimit(ctx.orgId, 'administration')` y retorná 403 si no tiene acceso.

**Archivos a crear / modificar**
- `apps/web/lib/plan-guard.ts` (modificar)
- `apps/web/lib/use-plan.ts` (modificar — agregar `canViewAdministration`)
- `apps/web/app/(dashboard)/administration/layout.tsx` (modificar)
- `apps/web/app/api/administration/summary/route.ts` (modificar)
- `apps/web/app/api/administration/cashflow/route.ts` (modificar)
- `apps/web/app/api/administration/vs-budget/route.ts` (modificar)

**Criterios de aceptación**
- Con plan Free, `/administration` muestra el `UpgradeBanner`.
- Con plan Free, las APIs de agregación devuelven 403.
- Con plan Advance, el módulo funciona completo.

---

#### T-15 · Empty States y Loading States
**Área:** Frontend · **Dificultad:** Fácil · **Fase:** 5

**Descripción**
Asegurarse de que todas las páginas del módulo tienen estados de carga y estados vacíos correctos.

**Pasos detallados**

1. En cada tabla (incomes, expenses, summary), mientras `isLoading` de SWR sea true, mostrá `LoadingSkeleton` con el número de filas apropiado.
2. Cuando no hay datos (array vacío), mostrá `EmptyState` con un ícono relevante (`Wallet` para ingresos, `Receipt` para egresos) y un mensaje descriptivo con call-to-action.
3. En el gráfico de cashflow, si todos los valores son 0, mostrá un estado vacío en lugar del gráfico.
4. Verificá que los errores de fetch se muestran con el componente `RouteError` existente.

**Criterios de aceptación**
- Cada tabla muestra skeletons mientras carga.
- Tablas vacías muestran `EmptyState` con call to action.
- Errors muestran `RouteError`.
- Gráfico vacío no muestra una línea en cero.

---

#### T-16 · Testing Manual y QA
**Área:** Backend + Frontend · **Dificultad:** Media · **Fase:** 5 — Todas las tareas anteriores completas

**Descripción**
Recorrer todos los flujos del módulo de forma sistemática con distintos roles y planes para verificar que todo funciona correctamente antes de hacer merge a master.

**Pasos detallados**

1. Creá un checklist en Notion/Jira o en un comentario del PR con los casos de prueba de cada sección.
2. Probá el flujo completo con usuario **Admin plan Advance**: crear tipos de egreso, registrar egresos con y sin rubro y comprobante, registrar ingresos, ver el resumen, ver el vs-budget.
3. Probá con usuario **Supervisor**: verificar que puede cargar ingresos/egresos pero NO ve la tab de Settings/Administración.
4. Probá con usuario **Architect**: verificar que NO puede acceder a `/administration` (debe recibir 403 o redirección).
5. Probá con usuario **Admin plan Free**: verificar que ve el `UpgradeBanner`.
6. Verificá los filtros: filtrar por proyecto, por tipo, por fecha. Los resultados deben ser coherentes.
7. Verificá la comparación vs presupuesto: publicá un presupuesto, cargá egresos vinculados a sus rubros, verificar que los porcentajes son correctos.
8. Verificá el cashflow: cargá ingresos y egresos en distintos meses, verificar que el gráfico los muestra en el mes correcto.
9. Reportá cualquier bug encontrado con un issue en el repositorio antes de aprobar el PR.

**Criterios de aceptación**
- Todos los flujos del checklist pasan sin errores.
- Los 3 roles se comportan correctamente.
- Los datos del resumen son matemáticamente correctos.
- No hay errores en la consola del browser ni en los logs de Vercel.

---

## 5. Referencia Rápida

### Archivos y patrones clave del proyecto

| Necesidad | Archivo de referencia |
|-----------|----------------------|
| Patrón de API route (auth + role check) | `apps/web/app/api/bank-accounts/route.ts` |
| Patrón de plan guard en API | `apps/web/app/api/reports/by-rubro/route.ts` |
| Patrón de SWR en componente | `apps/web/components/dashboard/recent-receipts.tsx` |
| Patrón de dialog con formulario | `apps/web/components/bank-account-form-dialog.tsx` |
| Patrón de tabla con filtros | `apps/web/app/(dashboard)/receipts/page.tsx` |
| Patrón de tab en Settings | `apps/web/app/(dashboard)/settings/banks/page.tsx` |
| Patrón de chart con Recharts | `apps/web/components/dashboard/spend-trend-chart.tsx` |
| Tipos compartidos | `packages/shared/src/types.ts` |
| Enum de roles | `packages/shared/src/enums.ts` |
| Auth server-side | `apps/web/lib/auth.ts` |
| Validación en API (validateBody) | `apps/web/lib/validate.ts` |
| Formatear moneda ARS | `apps/web/lib/format.ts` → `formatCurrency()` |
| EmptyState, LoadingSkeleton | `apps/web/components/ui/` |

### Reglas de desarrollo

- Idioma de la UI: español argentino con tuteo. Ej: "Registrá un egreso", "Seleccioná el proyecto".
- Idioma del código (variables, funciones, comentarios): inglés siempre.
- Commits con Conventional Commits: `feat: agregar api de egresos`, `fix: corregir validación de rubro`.
- Toda nueva feature en feature branch, nunca commitear directo a master.
- Los montos siempre en `numeric(12,2)` en la DB y formateados con `formatCurrency()` en la UI.
- Todas las queries a la DB deben estar scoped por `orgId`. Nunca consultar sin filtro de org.
- Los componentes de dialog, tabla y form deben seguir los patrones de los existentes en `/components`.
- No crear componentes de UI desde cero si ya existe uno en `/components/ui` que sirva.

---

## 6. Diseño de Pantallas y Componentes Reutilizables

**Principio de diseño:** El módulo sigue el mismo design system que el resto de Agentect (Shadcn/ui new-york, Tailwind CSS 4, variables CSS del proyecto). No se crean componentes de UI nuevos salvo los específicos del módulo.

### 6.1 Pantallas del Módulo

#### Pantalla 1 — Resumen · `/administration`

Vista principal con KPIs de balance global, gráfico de flujo de caja mensual (ingresos vs egresos) y tabla de balance por obra. Tiene un filtro global por proyecto y año en el topbar.

**Componentes reutilizados:**
- `KpiCard` — copiar patrón exacto de `dashboard-kpis.tsx`
- `LineChart` de Recharts — copiar configuración de `spend-trend-chart.tsx`, agregar segunda línea
- `Table` + `TableHead` + `TableBody` + `TableRow` + `TableCell` (Shadcn)
- `Select` (Shadcn) — filtros de proyecto y año
- `Badge` (Shadcn) — color de balance positivo/negativo
- `LoadingSkeleton` — mientras cargan los datos
- `formatCurrency()` de `lib/format.ts` — todos los montos
- `useSWR()` con `fetcher` de `lib/fetcher.ts`

#### Pantalla 2 — Egresos · `/administration/expenses`

Tabla completa de egresos con filtros por proyecto, tipo, rubro y rango de fechas. Cada fila muestra el ícono de comprobante si tiene uno vinculado.

**Componentes reutilizados:**
- `Table` + familia (Shadcn) — mismo patrón que `/receipts`
- `Badge` (Shadcn) — tipo de egreso y rubro
- `Select` (Shadcn) — 4 filtros en la barra
- `DropdownMenu` (Shadcn) — botón de acciones `···` con Editar / Eliminar
- `AlertDialog` (Shadcn) — confirmación de eliminación
- `Button` (Shadcn) — "Registrar egreso" primario
- `EmptyState` (custom existente) — cuando no hay egresos
- `LoadingSkeleton` — mientras carga la tabla
- `formatCurrency()` — montos en ARS

#### Pantalla 3 — Dialog: Registrar / Editar Egreso · `ExpenseFormDialog.tsx`

Formulario modal para crear o editar un egreso. El campo "Rubro" y "Comprobante" son dinámicos: se cargan solo cuando el usuario elige un proyecto. Al cambiar de proyecto, se resetean automáticamente.

**Componentes reutilizados:**
- `Dialog` + `DialogHeader` + `DialogContent` + `DialogFooter` (Shadcn)
- `Select` (Shadcn) — proyecto, tipo de egreso, rubro (dinámico), comprobante (dinámico)
- `CurrencyInput` (custom ya en `/components/ui/`) — para el monto
- `Input type='date'` (Shadcn) — para la fecha
- `Textarea` (Shadcn) — descripción opcional
- `Button` (Shadcn) — Cancelar y Registrar
- `useState()` de React — para el estado del formulario y campos dependientes
- `useSWR()` con `enabled: !!projectId` — para cargar rubros y receipts según proyecto
- Sileo toast — notificación de éxito al guardar

#### Pantalla 4 — Tab Financiero en Proyecto · `/projects/[id]`

Nueva tab que muestra 3 KPIs de presupuesto vs real, barra de avance global, y tabla por rubro con barras de progreso. El rubro que supera el 100% se marca en rojo.

**Componentes reutilizados:**
- `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` (Shadcn) — agregar tab al componente existente
- `KpiCard` (`dashboard-kpis.tsx`) — 3 cards: Presupuestado / Ejecutado / Disponible
- `Table` + familia (Shadcn) — tabla de rubros
- `Progress` (Shadcn) o div con width CSS — barra de avance por rubro
- `Badge` (Shadcn) — indicar rubros excedidos
- `EmptyState` — cuando no hay presupuesto publicado
- `formatCurrency()` — todos los montos

---

### 6.2 Inventario Completo de Componentes Reutilizables

#### Componentes de UI — Shadcn/ui (ya en `/components/ui/`)

| Componente | Archivo | Cómo se reutiliza |
|------------|---------|------------------|
| `Button` | `components/ui/button.tsx` | Todos los CTAs: "Registrar egreso", "Registrar ingreso", "Cancelar", "Guardar" |
| `Table` | `components/ui/table.tsx` | Tablas de egresos, ingresos y balance por obra |
| `Dialog` | `components/ui/dialog.tsx` | `ExpenseFormDialog` e `IncomeFormDialog` |
| `Select` | `components/ui/select.tsx` | Filtros y selección en formularios |
| `Badge` | `components/ui/badge.tsx` | Tipo de egreso, rubro, estado positivo/negativo |
| `AlertDialog` | `components/ui/alert-dialog.tsx` | Confirmación de eliminación |
| `DropdownMenu` | `components/ui/dropdown-menu.tsx` | Menú de acciones (Editar / Eliminar) en cada fila |
| `Tabs` | `components/ui/tabs.tsx` | Tab "Financiero" en página de proyecto |
| `Textarea` | `components/ui/textarea.tsx` | Campo descripción en ambos formularios |
| `CurrencyInput` | `components/ui/currency-input.tsx` | Campo monto en ambos formularios |
| `Separator` | `components/ui/separator.tsx` | Divisores visuales |
| `Card` | `components/ui/card.tsx` | KPI cards en la página de resumen |
| `Skeleton` | `components/ui/skeleton.tsx` | Loading states en todas las tablas |
| `EmptyState` | `components/ui/empty-state.tsx` | Sin datos y sin presupuesto publicado |

#### Componentes de Feature (ya en `/components/`)

| Componente | Archivo | Cómo se reutiliza |
|------------|---------|------------------|
| `KpiCard` | `components/dashboard/dashboard-kpis.tsx` | 4 KPIs en resumen, 3 KPIs en tab financiero |
| `SpendTrendChart` | `components/dashboard/spend-trend-chart.tsx` | Base del cashflow chart — agregar segunda línea |
| `PageHeader` | `components/ui/page-header.tsx` | Header de las páginas del módulo |
| `StatusBadge` | `components/ui/status-badge.tsx` | Indicar si balance es positivo, negativo o neutro |
| `UpgradeBanner` | `components/upgrade-banner.tsx` | Bloquear módulo en plan Free |

#### Hooks y Utilidades (ya en `/lib/`)

| Hook / Util | Archivo | Cómo se reutiliza |
|-------------|---------|------------------|
| `useCurrentUser()` | `lib/use-current-user.ts` | Role gate: ocultar botones de acción para architect |
| `usePlan()` | `lib/use-plan.ts` | Agregar `canViewAdministration` para plan guard |
| `fetcher` | `lib/fetcher.ts` | SWR fetcher para todas las queries del módulo |
| `formatCurrency()` | `lib/format.ts` | Todos los montos en ARS |
| `getAuthContext()` | `lib/auth.ts` | Autenticación en todas las API routes nuevas |
| `validateBody()` | `lib/validate.ts` | Validación de request body en POST/PATCH |
| `checkPlanLimit()` | `lib/plan-guard.ts` | Agregar chequeo `'administration'` en APIs de agregación |
| `getDb()` | `lib/supabase.ts` | Acceso a Supabase en todas las API routes |

---

### 6.3 Componentes Nuevos a Crear

Solo **5 componentes** realmente nuevos. El resto es composición de lo existente.

| Componente | Archivo nuevo | Descripción |
|------------|--------------|-------------|
| `ExpenseFormDialog` | `components/expense-form-dialog.tsx` | Dialog de crear/editar egreso. Campos dependientes: rubro y comprobante se cargan según el proyecto seleccionado. |
| `IncomeFormDialog` | `components/income-form-dialog.tsx` | Dialog de crear/editar ingreso. Más simple: sin campos dependientes. |
| `CashflowChart` | `components/administration/cashflow-chart.tsx` | `LineChart` de Recharts con 2 líneas (ingresos/egresos). Basado en `spend-trend-chart.tsx`. |
| `VsBudgetTable` | `components/administration/vs-budget-table.tsx` | Tabla rubro / presupuestado / ejecutado / diferencia / barra de progreso. Reutilizada en `/administration` y en `/projects/[id]`. |
| `BalanceByProjectTable` | `components/administration/balance-by-project-table.tsx` | Tabla simple de obra / ingresos / egresos / balance con color positivo/negativo. |

---

*Agentect — Plan de Implementación v1.1 — Febrero 2026*
