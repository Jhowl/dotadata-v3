import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));

// Load order (later wins):
//   1. repo-root .env  (../../.env from backend/src/config/)
//   2. backend/.env    (loaded by `dotenv/config`-style default)
//   3. process.env (already set by the shell or docker compose)
dotenv.config({ path: path.resolve(here, "../../../.env") });
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  FRONTEND_ORIGIN: z.string().url(),
  AUTH_BASE_URL: z.string().url(),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  REDIS_URL: z.string().min(1).optional(),
  REDIS_KEY_PREFIX: z.string().default("dotadata:v1"),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  STEAM_API_KEY: z.string().min(1).optional(),

  N8N_CONTACT_WEBHOOK_URL: z.string().url().optional(),
  BLOG_ADMIN_TOKEN: z.string().min(1).optional(),
  COOKIE_DOMAIN: z.string().min(1).optional(),
});

// Treat empty strings as undefined so `.env.example`-style blank entries
// (KEY=) don't trip `.optional()` fields. Accept legacy NEXT_PUBLIC_-prefixed
// Supabase names so the same .env can power both /web (Next.js) and /web-v2.
const blankToUndef = (v: string | undefined) => (v === "" ? undefined : v);
const rawEnv: Record<string, string | undefined> = {};
for (const [k, v] of Object.entries(process.env)) rawEnv[k] = blankToUndef(v);

const normalized = {
  ...rawEnv,
  SUPABASE_URL: rawEnv.SUPABASE_URL ?? rawEnv.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY:
    rawEnv.SUPABASE_ANON_KEY ?? rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const parsed = schema.safeParse(normalized);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
