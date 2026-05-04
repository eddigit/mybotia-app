// Bloc 6A — connexion Postgres `mybotia_core` réservée aux routes admin.
// JAMAIS importée côté client. Les routes `/api/admin/*` qui consomment
// ce module sont déjà server-only via Next.js App Router.

import { Pool, type PoolClient } from "pg";

let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  _pool = new Pool({
    host: process.env.PG_HOST || "127.0.0.1",
    port: Number(process.env.PG_PORT || 5432),
    database: process.env.PG_DATABASE || "mybotia_core",
    user: process.env.PG_USER || "mybotia",
    password: process.env.PG_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  _pool.on("error", (err) => {
    console.error("[admin-db] pool error", err.message);
  });
  return _pool;
}

export async function adminQuery<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query(sql, params);
  return res.rows as T[];
}

// UB-9 — exécute fn() dans une transaction Postgres dédiée, avec rollback auto.
// À utiliser quand plusieurs queries doivent être atomiques (ex: vérifier + écrire).
export async function adminTx<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // rollback best-effort
    }
    throw e;
  } finally {
    client.release();
  }
}
