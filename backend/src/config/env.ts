import "dotenv/config";
import { z } from "zod";

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

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
