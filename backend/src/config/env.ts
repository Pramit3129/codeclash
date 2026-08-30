import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  // Comma separated list of allowed CORS origins. Defaults to FRONTEND_URL.
  CORS_ORIGINS: z.string().optional(),

  // ----- Auth / tokens -----
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  JWT_ISSUER: z.string().default("codeclash"),
  JWT_AUDIENCE: z.string().default("codeclash-client"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().positive().default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // 32-byte key, hex (64 chars) or base64. Used to encrypt provider tokens.
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),

  // Refresh-token cookie.
  COOKIE_NAME: z.string().default("cc_rt"),
  COOKIE_DOMAIN: z.string().optional(),

  // ----- Google OAuth -----
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_REDIRECT_URI: z.string().url("GOOGLE_REDIRECT_URI must be a valid URL"),

  // ----- GitHub OAuth -----
  GITHUB_CLIENT_ID: z.string().min(1, "GITHUB_CLIENT_ID is required"),
  GITHUB_CLIENT_SECRET: z.string().min(1, "GITHUB_CLIENT_SECRET is required"),
  GITHUB_REDIRECT_URI: z.string().url("GITHUB_REDIRECT_URI must be a valid URL"),
  GITHUB_SCOPES: z.string().default("read:user user:email repo"),

  WS_PORT: z.coerce.number().int().positive().default(8000),
  CLIENT_ORIGIN: z.string().url("CLIENT_ORIGIN must be a valid URL"),

});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(_env.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const env = _env.data;

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
