# Budget Import from Excel — Design

> Fecha: 2026-02-26
> Estado: Aprobado

---

## Contexto

Los arquitectos ya tienen presupuestos armados en Excel. Hoy, para usar Agentect tienen que recrearlos manualmente en el editor. Esta feature permite subir un Excel y que un agente AI interprete la estructura, creando el presupuesto automáticamente en el formato de la app.

## Principios

- **No cambiar la estructura existente** de BudgetSnapshot. El agente interpreta el Excel y lo adapta al formato de la app, no al revés.
- **Nunca inventar datos.** Si un valor no es visible o interpretable, va como 0. El usuario completa manualmente.
- **Reutilizar patrones existentes:** misma SDK de Anthropic, misma validación Zod, misma estructura de API routes.

---

## Flujo general

```
Usuario sube .xlsx/.xls
       ↓
POST /api/budgets/[id]/import (multipart form: file)
       ↓
Backend parsea Excel → texto tabular (SheetJS)
       ↓
Texto tabular → Claude con BUDGET_IMPORT_PROMPT
       ↓
Claude responde JSON: { sections, confidence, warnings }
       ↓
Backend valida, crea rubros en DB, arma BudgetSnapshot
       ↓
Persiste snapshot en el budget (draft)
       ↓
Frontend redirige al editor / revalida SWR
       ↓
Usuario ve el presupuesto importado, edita lo que necesite
```

El budget ya tiene que existir (creado previamente). La importación solo lo "llena" con datos.

---

## API endpoint

### `POST /api/budgets/[id]/import`

**Auth:** admin o supervisor (mismo gate que editar budget)

**Input:** multipart form con campo `file` (max 5MB, `.xlsx` o `.xls`)

**Validaciones previas:**
- Budget existe y pertenece a la org
- Budget está en status `draft`
- Budget tiene snapshot vacío o nulo (`sections.length === 0`)

**Proceso:**
1. Parsear Excel con SheetJS → extraer texto tabular de todas las hojas
2. Enviar texto a Claude con `BUDGET_IMPORT_PROMPT`
3. Parsear respuesta JSON
4. Por cada sección interpretada: crear rubro en DB para obtener `rubro_id`
5. Armar `BudgetSnapshot` con los `rubro_id` reales
6. Validar con `budgetSnapshotSchema`
7. Guardar snapshot en el budget

**Response (200):**
```json
{
  "snapshot": { "sections": [...] },
  "confidence": 0.85,
  "warnings": ["No se pudo interpretar la hoja 'Notas'"]
}
```

**Errores:**
- 400: archivo inválido, formato no soportado, Excel vacío, excede 5MB
- 409: budget no está en draft o ya tiene datos
- 422: Claude no pudo interpretar la estructura (confidence < 0.3) o retornó JSON inválido

---

## Parseo del Excel

**Librería:** `xlsx` (SheetJS community edition) — se instala en `packages/ai`.

**Lógica:**
1. `xlsx.read(buffer, { type: 'buffer' })` para leer el archivo
2. Iterar hojas del workbook
3. Convertir cada hoja a texto tabular con `xlsx.utils.sheet_to_csv(sheet)`
4. Concatenar hojas con separador: `--- Hoja: "nombre" ---`
5. Limitar texto total a ~50.000 caracteres
6. Descartar hojas vacías

**Ejemplo de output:**
```
--- Hoja: "Presupuesto" ---
,A,B,C,D,E
1,PRESUPUESTO CASA MARTINEZ,,,,
2,,,,,
3,1. ALBAÑILERÍA,,,,
4,1.1,Excavación y nivelación,gl,1,$450.000
5,1.2,Mampostería de ladrillos,m2,120,$890.000
6,,Subtotal Albañilería,,,$1.340.000
7,,,,,
8,2. ELECTRICIDAD,,,,
9,2.1,Instalación eléctrica completa,gl,1,$650.000
```

---

## Prompt de interpretación (BUDGET_IMPORT_PROMPT)

**Archivo:** `packages/ai/src/budget-prompt.ts`

**Estructura del prompt:**

1. **Rol:** Asistente que interpreta presupuestos de construcción argentinos desde planillas Excel.

2. **Input:** Contenido textual de un Excel. Puede tener cualquier formato.

3. **Objetivo:** Extraer rubros y tareas en formato JSON.

4. **Reglas críticas:**
   - Identificar RUBROS: secciones principales (ej: "1. Albañilería", "Estructura"). Son categorías de alto nivel.
   - Identificar TAREAS (items): líneas dentro de cada rubro con descripción, unidad, cantidad, costo y subtotal.
   - Si hay subtotales a nivel de rubro, extraerlos como `section_subtotal` y `section_cost`.
   - Si no se puede identificar un campo (ej: no hay unidad), usar defaults: `unit: "gl"`, `quantity: 1`.
   - **NUNCA inventar datos.** Si un valor no está visible, dejarlo en 0.
   - Si no se puede distinguir "costo" de "subtotal", poner 0 en ambos.
   - Si hay hojas que no son presupuesto (notas, condiciones), ignorarlas y reportar en `warnings`.

5. **Output format:**
```json
{
  "sections": [
    {
      "rubro_name": "Albañilería",
      "is_additional": false,
      "section_subtotal": 1340000,
      "section_cost": null,
      "items": [
        {
          "description": "Excavación y nivelación",
          "unit": "gl",
          "quantity": 1,
          "cost": 0,
          "subtotal": 450000
        }
      ]
    }
  ],
  "confidence": 0.85,
  "warnings": ["No se interpretó la hoja 'Condiciones generales'"]
}
```

6. **Confidence:** 0-1 basado en cuánta estructura pudo interpretar. Sin rubros claros → confidence < 0.5.

**Nota:** El JSON no incluye `rubro_id` — lo asigna el backend al crear rubros en DB. `is_additional` es `false` por default, el usuario lo cambia en el editor.

---

## Función de extracción

**Archivo:** `packages/ai/src/budget-extract.ts`

```typescript
extractBudgetData(fileBuffer: Buffer, fileName: string)
  → Promise<BudgetImportResult>
```

**Flujo interno:**
1. Parsear Excel con SheetJS → texto tabular
2. Llamar a Claude (`claude-sonnet-4-5-20250929`, texto, sin vision)
3. Parsear respuesta JSON (strip markdown + JSON.parse)
4. Validar estructura básica
5. Retornar resultado tipado

**Diferencias vs `extractReceiptData()`:**
- No usa vision (texto, no imagen)
- Input: `Buffer` + `fileName` en vez de `base64` + `mimeType`
- Prompt: `BUDGET_IMPORT_PROMPT`
- Response: `BudgetImportResult`

---

## UI — Puntos de entrada

### Entrada 1: Dialog de crear presupuesto (`create-budget-dialog.tsx`)

- Botón/zona de upload: "Importar desde Excel" con ícono `Upload`
- Al seleccionar archivo: crea budget vacío (POST /api/budgets) + dispara import (POST /api/budgets/[id]/import)
- Loading: "Interpretando presupuesto..." con spinner
- Success: redirige a `/budgets/[id]`
- Error: toast con error, budget queda creado pero vacío

### Entrada 2: Budget editor vacío (`budget-table.tsx`)

- Cuando `sections.length === 0`: botón "Importar desde Excel" en el empty state
- Al seleccionar archivo: POST /api/budgets/[id]/import directamente
- Loading: reemplaza empty state con spinner
- Success: revalida SWR (mutate), editor se llena con datos
- Error: toast, vuelve a empty state

**Upload:** `<input type="file" accept=".xlsx,.xls">` — sin drag-and-drop (YAGNI).

**Feedback post-import:**
- Toast éxito: "Presupuesto importado — revisá los datos"
- Si confidence < 0.6: toast warning: "Algunos datos no pudieron interpretarse con certeza. Revisá los valores."
- Si hay warnings: se muestran en el toast

---

## Manejo de errores y edge cases

**Errores del archivo:**
- Corrupto o no es Excel → 400: "El archivo no es un Excel válido"
- Vacío → 400: "El Excel no contiene datos"
- Excede 5MB → 400: "El archivo supera el tamaño máximo (5MB)"

**Errores de interpretación:**
- Confidence < 0.3 → 422: "No se pudo interpretar la estructura del presupuesto"
- JSON inválido → 422: "Error al interpretar el presupuesto. Intentá de nuevo."

**Errores de estado:**
- Budget ya tiene datos → 409: "El presupuesto ya tiene datos. Creá uno nuevo para importar."
- No está en draft → 409: "Solo se puede importar en un presupuesto en borrador."

**Campos no interpretados:**
- Valores que no se pueden leer → van como 0
- El usuario los ve como $0 en el editor y los completa manualmente
- No hay sistema de marcadores visual en esta versión — los $0 son señal suficiente

**Subtotales inconsistentes:**
- Si la suma de items no coincide con el subtotal que Claude reportó para la sección, se usa el subtotal de Claude como override (`subtotal` opcional de BudgetSection) y se dejan los items tal cual

---

## Dependencias y código

### Nueva dependencia
- `xlsx` (SheetJS community edition) → `packages/ai`

### Archivos nuevos
| Archivo | Ubicación | Responsabilidad |
|---------|-----------|-----------------|
| `budget-prompt.ts` | `packages/ai/src/` | BUDGET_IMPORT_PROMPT |
| `budget-extract.ts` | `packages/ai/src/` | `extractBudgetData()` + parseo Excel |
| `route.ts` | `apps/web/app/api/budgets/[id]/import/` | POST endpoint |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `packages/ai/src/index.ts` | Re-exportar `extractBudgetData` |
| `apps/web/components/create-budget-dialog.tsx` | Opción de importar Excel |
| `apps/web/components/budget-table.tsx` | Botón importar en empty state |

### Sin cambios
- `packages/shared/src/types.ts` — BudgetSnapshot no cambia
- `apps/web/lib/schemas/budget.ts` — se reutilizan
- API de rubros — se invoca internamente
- Autosave — funciona igual

---

## Formatos soportados

- `.xlsx` (Excel 2007+)
- `.xls` (Excel 97-2003)

---

## Resumen

| Aspecto | Decisión |
|---------|----------|
| Parseo | SheetJS en backend, texto tabular |
| Interpretación | Claude Sonnet 4.5 (texto, no vision) |
| Valores no interpretables | 0 (nunca inventar) |
| Paso de revisión | No — directo al editor como draft |
| Puntos de entrada UI | Dialog crear + editor vacío |
| Estructura budget | Sin cambios — se adapta el Excel al formato existente |
| Confianza mínima | 0.3 para aceptar importación |
