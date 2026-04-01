import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  REPOSITORY_MODE: z.enum(["memory", "prisma"]).default("prisma"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SERVICE_API_KEYS_JSON: z.string().default("{}"),
  JWT_ISSUER: z.string().default("fraudsense"),
  JWT_AUDIENCE: z.string().default("fraudsense-api"),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(604800),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_PRIVATE_KEY: z.string().min(1),
  GITHUB_FEEDBACK_TOKEN: z.string().default(""),
  GITHUB_FEEDBACK_REPO_OWNER: z.string().default(""),
  GITHUB_FEEDBACK_REPO_NAME: z.string().default(""),
  GITHUB_FEEDBACK_LABELS: z.string().default("feedback,triage")
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates runtime environment variables before service bootstrap.
 * Throws when mandatory variables are missing to fail fast.
 */
export function loadEnv(input: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(input);
}
