import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  META_APP_SECRET: z.string().min(1),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  ENCRYPTION_KEY: z.string().length(32),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
