import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  AI_SERVER_URL: z.string().url().default("http://localhost:8000"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("86400s"),
  FRONTEND_ORIGIN: z.string().optional(),
  RABBITMQ_URL: z.string().optional(),
  LOG_QUEUE: z.string().default("fakeradar.logs"),
  REANALYZE_COOLDOWN_HOURS: z.coerce.number().default(24),
  DELETE_WINDOW_MINUTES: z.coerce.number().default(30),
  PORTAL_PAGE_SIZE: z.coerce.number().default(20),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
