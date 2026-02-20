# Bilog OpenAPI Gateway — Design Document

> Commercial RESTful API layer over Bilog API Core for dental clinic management.

## Context

Bilog API Core is an RPC-style .NET 9 API where all operations go through POST endpoints with an `opcion` parameter (`/auagenda`, `/aupaciente`, `/autablas`). The goal is to expose a commercial, OpenAPI 3.1-compliant REST API with API key authentication and tiered pricing.

### MVP Scope

Only two Bilog endpoints are exposed in the MVP:
- `/auagenda` → Appointment management
- `/aupaciente` → Patient management

---

## Architecture

### Approach: Module within Bilog

The gateway lives as a new area/module inside the existing Bilog .NET 9 project, deployed on the same Windows Server (IIS). This avoids HTTP proxy latency and allows direct access to Bilog's internal services.

```
Bilog API Core (.NET 9, IIS)
├── Controllers/              ← existing RPC endpoints (/au*)
├── Services/                 ← existing business logic
├── OpenApi/                  ← NEW module
│   ├── Controllers/
│   │   ├── AuthController.cs
│   │   ├── AppointmentsController.cs
│   │   └── PatientsController.cs
│   ├── Middleware/
│   │   ├── ApiKeyAuthMiddleware.cs
│   │   ├── RateLimitMiddleware.cs
│   │   └── UsageMeteringMiddleware.cs
│   ├── Services/
│   │   └── JwtTokenManager.cs
│   └── Models/               ← REST DTOs
```

### Request Flow

```
Client  →  GET /api/v1/appointments?date=&professionalId=
        →  [ApiKeyAuthMiddleware]
        │    ├─ Validates API key (SHA-256 hash lookup)
        │    ├─ Resolves: tenant, tier, bilog credentials
        │    └─ Injects context into HttpContext.Items
        │
        →  [JwtTokenManager]
        │    ├─ Checks cached JWT for this tenant
        │    ├─ If expired → calls _authService.LoginAsync() directly (no HTTP)
        │    ├─ Caches new JWT in-memory (ConcurrentDictionary, TTL = expiry - 5min)
        │    └─ Injects valid JWT into context
        │
        →  [RateLimitMiddleware]      checks per-minute rate limit by tier
        →  [UsageMeteringMiddleware]  logs call for billing
        →  [AppointmentsController]   REST logic, calls Bilog internal services
        →  Response (clean JSON, no BOutput wrapper)
```

### Key Decision: JWT Management

The existing `/aulogin` endpoint uses JWT for all `/au*` operations. The gateway reuses the **internal auth service directly** (not via HTTP call to `/aulogin`) to obtain and cache JWT tokens per tenant. This eliminates the HTTP hop and BOutput parsing overhead.

---

## Authentication

### Dual-layer Auth

1. **API key** → authenticates external client against our gateway
2. **JWT Bilog** → gateway obtains internally via auth service using stored credentials

### API Key Format

- Production: `bl_live_` + 32 bytes random (base62)
- Sandbox: `bl_test_` + 32 bytes random (base62)
- Only the **SHA-256 hash** is stored in the database
- A `key_prefix` (first 8 chars) is stored for identification
- The plaintext key is shown once at creation time

---

## Pricing Tiers

| | Free | Pro | Enterprise |
|---|---|---|---|
| Price | $0 | $X/month | Custom |
| Calls/month | 100 | 5,000 | Unlimited |
| Rate limit | 10 req/min | 60 req/min | 200 req/min |
| Appointments | Read only | Full CRUD | Full CRUD |
| Patients | No access | Full CRUD | Full CRUD |
| Support | Docs | Email | Dedicated |

---

## Database

SQL Server tables in the existing Bilog database. Schema naming follows legacy conventions (Spanish, snake_case, abbreviations, `IDENTITY`, `DATETIME`, `VARCHAR`). Exact column types and naming to be adapted to match the existing database style once reviewed.

### Conceptual Tables

| Table | Purpose |
|---|---|
| `api_planes` | Tier definitions (name, monthly quota, rate limit, price) |
| `api_keys` | Issued API keys (hash, prefix, plan, status, client name/email) |
| `api_keys_credenciales` | Encrypted Bilog credentials per API key (AES-256 at app layer) |
| `api_uso` | Usage log (key, endpoint, method, status code, duration, timestamp) |
| `api_planes_permisos` | Endpoint permissions per tier (endpoint + method whitelist) |

---

## Endpoints MVP

### Appointments (agenda)

| Method | Path | Bilog opcion | Min Tier |
|---|---|---|---|
| `GET` | `/api/v1/appointments?date=&professionalId=` | `buscar` | Free |
| `GET` | `/api/v1/appointments?weekOf=&professionalId=` | `buscarsemana` | Free |
| `POST` | `/api/v1/appointments` | `agregarturnopacexist` / `agregarturnopac1vez` | Pro |
| `DELETE` | `/api/v1/appointments/{id}` | `anularturno` | Pro |
| `PATCH` | `/api/v1/appointments/{id}/notes` | `modificarobs` | Pro |
| `PATCH` | `/api/v1/appointments/{id}/attendance` | `modificarasistencia` | Pro |

**POST logic:** The controller determines which Bilog `opcion` to use based on the presence of `patientId` in the request body:
- `patientId` present → `agregarturnopacexist`
- `patientId` absent + `patientName` present → `agregarturnopac1vez`

### Patients (pacientes)

| Method | Path | Bilog opcion | Min Tier |
|---|---|---|---|
| `POST` | `/api/v1/patients/search` | `buscar` / `buscarcontenido` | Pro |
| `GET` | `/api/v1/patients/{id}` | `buscar` (by id) | Pro |
| `GET` | `/api/v1/patients/{id}?include=appointments` | `buscar` + `quedatobuscar` | Pro |
| `POST` | `/api/v1/patients` | `agregar` | Pro |
| `PATCH` | `/api/v1/patients/{id}` | `modificar` | Pro |

**Patient search kept as POST** to avoid PII (names, documents) in query strings/server logs.

### Auth (utility)

| Method | Path | Description | Tier |
|---|---|---|---|
| `POST` | `/api/v1/auth/validate` | Validates API key + Bilog credentials work | All |

---

## Error Handling

All errors use **RFC 7807 Problem Details** format (`Content-Type: application/problem+json`).

### Bilog Error Code Mapping

| Bilog Code | HTTP Status | Error Type |
|---|---|---|
| `00011` / `00099` | `403` | `/errors/insufficient-permissions` |
| `00021` | `404` | `/errors/patient-not-found` |
| `00032-00034` | `422` | `/errors/invalid-time` |
| `00035` | `409` | `/errors/slot-conflict` |
| `40000` | `402` | `/errors/plan-restriction` |
| `99998` | `409` | `/errors/concurrency-conflict` |
| `99999` | `502` | `/errors/upstream-error` |

### Gateway-own Errors

| Case | HTTP Status | Error Type |
|---|---|---|
| Invalid/revoked API key | `401` | `/errors/invalid-api-key` |
| Monthly quota exceeded | `429` | `/errors/quota-exceeded` |
| Per-minute rate limit | `429` | `/errors/rate-limited` |
| Endpoint not allowed in tier | `403` | `/errors/tier-restricted` |
| Bilog credentials invalid | `401` | `/errors/bilog-auth-failed` |
| Missing If-Match header | `428` | `/errors/precondition-required` |

429 responses include `Retry-After` and `X-RateLimit-Remaining` headers.

### Example Error Response

```json
{
  "type": "https://api.bilog.com.ar/errors/slot-conflict",
  "title": "El turno ya está ocupado",
  "status": 409,
  "detail": "El horario 10:00 del profesional 11 ya tiene un turno asignado",
  "bilogCode": "00035"
}
```

---

## Concurrency Control (ETag / rowversion)

Bilog's agenda table uses SQL Server `rowversion` (8-byte auto-incrementing value) for optimistic concurrency. The rowversion **changes on every UPDATE**, which is what makes it useful for detecting concurrent modifications.

### Mapping

```
rowversion (binary 8 bytes) → base64url encode → ETag header value
```

### Rules

- **GET responses** always include `ETag` header (and `etag` field in each appointment)
- **PATCH and DELETE** require `If-Match` header with the ETag value
  - Missing `If-Match` → `428 Precondition Required`
  - ETag mismatch (someone else modified the record) → `412 Precondition Failed`
- **POST** (create) does not require ETag (new resource)

### Flow

```
1. GET /api/v1/appointments?date=...
   → Response header:  ETag: "AAAAAAK3MQ=="
   → Body appointments include:  "etag": "AAAAAAK3MQ=="

2. PATCH /api/v1/appointments/12345/notes
   → Request header:  If-Match: "AAAAAAK3MQ=="
   → Gateway decodes base64 → rowversion bytes
   → Passes rowversion to Bilog internal service

3a. No concurrent modification → 200 OK + new ETag
3b. Concurrent modification detected → Bilog returns error 99998
    → Gateway translates to 412 Precondition Failed
```

---

## Summary

| Aspect | Decision |
|---|---|
| Architecture | Module within Bilog (.NET 9, IIS) |
| Auth | API key (gateway) + JWT Bilog (internal service, no HTTP) |
| Pricing | 3 tiers: Free (read agenda) / Pro (full CRUD) / Enterprise |
| Database | SQL Server, existing DB, legacy naming conventions |
| MVP Endpoints | 6 appointments + 5 patients + 1 auth/validate |
| Errors | RFC 7807 Problem Details, Bilog codes → HTTP status |
| Concurrency | rowversion → ETag/If-Match, changes on every update |
| Rate limiting | Per-minute (middleware) + monthly quota (metering) |
