import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    `postgresql://${process.env.PGUSER ?? "postgres"}:${process.env.PGPASSWORD ?? "postgres"}@${process.env.PGHOST ?? "localhost"}:${process.env.PGPORT ?? "5432"}/${process.env.PGDATABASE ?? "crazy_tens"}`,
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

/** Convenience wrapper that pulls a client from the pool. */
export function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export { pool };
