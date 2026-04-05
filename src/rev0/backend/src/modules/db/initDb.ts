import fs from "node:fs";
import path from "node:path";
import { pool } from "./db";

/**
 * Run the init.sql schema file against the database.
 * Safe to call on every startup (all statements are IF NOT EXISTS).
 */
export async function initDb(): Promise<void> {
    const sqlPath = path.join(__dirname, "init.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    await pool.query(sql);

    // Clear all active sessions on startup — server restart invalidates
    // in-memory state (gameSessions, WS connections), so old sessions are stale
    await pool.query(`UPDATE players SET session_iat = NULL WHERE session_iat IS NOT NULL`);

    console.log("[initDb] Schema initialised ✓");
}
