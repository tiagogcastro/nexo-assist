import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as appSchema from '@/db/schema/app';
import * as authSchema from '@/db/schema/auth';

const connection = postgres(process.env.DATABASE_URL ?? 'postgresql://localhost/nexo_assist', {
  max: 5,
  idle_timeout: 20,
});

export const db = drizzle(connection, { schema: { ...authSchema, ...appSchema } });
