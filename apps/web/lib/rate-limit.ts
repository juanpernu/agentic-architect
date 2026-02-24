import { NextResponse } from 'next/server';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const TIERS: Record<string, RateLimitConfig> = {
  extract: { maxRequests: 10, windowMs: 60_000 },
  upload: { maxRequests: 20, windowMs: 60_000 },
  billing: { maxRequests: 5, windowMs: 60_000 },
};

const MAX_ENTRIES = 10_000;

// Persist across HMR in dev
const globalForRL = globalThis as unknown as {
  __obralink_rateLimitStore?: Map<string, number[]>;
};
if (!globalForRL.__obralink_rateLimitStore) {
  globalForRL.__obralink_rateLimitStore = new Map();
}
const store = globalForRL.__obralink_rateLimitStore;

function cleanup() {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, timestamps] of store) {
    const recent = timestamps.filter((t) => now - t < 120_000);
    if (recent.length === 0) {
      store.delete(key);
    } else {
      store.set(key, recent);
    }
  }
}

function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const timestamps = store.get(key) ?? [];
  const recent = timestamps.filter((t) => t > windowStart);

  if (recent.length >= config.maxRequests) {
    const oldest = recent[0];
    const retryAfterMs = oldest + config.windowMs - now;
    return { allowed: false, retryAfterMs };
  }

  recent.push(now);
  store.set(key, recent);
  cleanup();

  return { allowed: true, retryAfterMs: 0 };
}

export function rateLimit(tier: string, identifier: string): NextResponse | null {
  const config = TIERS[tier];
  if (!config) return null;

  const key = `${tier}:${identifier}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    const retryAfter = Math.ceil(result.retryAfterMs / 1000);
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intentá de nuevo en unos segundos.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  return null;
}
