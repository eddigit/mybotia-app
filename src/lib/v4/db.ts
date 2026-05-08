import { Pool } from "pg";

declare global {
  var __mybotia_v4_pg_pool__: Pool | undefined;
}

function makePool(): Pool {
  return new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5432,
    // V4 utilise une DB dédiée (mybotia_memory.chat.*) pour ne pas perturber
    // mybotia_core (auth, dashboard, CRM, etc.). Fallback PG_DATABASE si absent.
    database: process.env.PG_DATABASE_V4 || process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
  });
}

export const pool: Pool =
  global.__mybotia_v4_pg_pool__ ?? (global.__mybotia_v4_pg_pool__ = makePool());

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const res = await pool.query(text, params as never);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}
