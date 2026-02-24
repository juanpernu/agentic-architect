import { z } from 'zod';

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Clerk
  CLERK_WEBHOOK_SECRET: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_ADVANCE_MONTHLY_BASE_PRICE_ID: z.string().min(1),
  STRIPE_ADVANCE_YEARLY_BASE_PRICE_ID: z.string().min(1),
  STRIPE_ADVANCE_MONTHLY_SEAT_PRICE_ID: z.string().min(1),
  STRIPE_ADVANCE_YEARLY_SEAT_PRICE_ID: z.string().min(1),

  // Anthropic (read by SDK automatically)
  ANTHROPIC_API_KEY: z.string().min(1),

  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

function getEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `\n❌ Invalid environment variables:\n${formatted}\n`
    );
  }

  _env = result.data;
  return _env;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
