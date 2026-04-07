/**
 * @file index.ts
 * @module backend
 * @author The Crazy 4 Team
 * @date 2026
 * @purpose Application entry point: wires together storage, authentication,
 *          matchmaking, real-time gateway, and HTTP server, then starts
 *          listening on the configured port.
 */
import http from "node:http";
import { Server as IOServer } from "socket.io";

import { createApp } from "./app";

import { InMemoryRepository } from "./modules/repository/inMemoryRepository";
import { PgRepository } from "./modules/repository/pgRepository";
import { InMemoryAuditStore } from "./modules/audit/inMemoryAudit";
import { PgAuditStore } from "./modules/audit/pgAuditStore";
import { AuthService } from "./modules/auth/authService";
import { makeMatchmakingService } from "./modules/matchmaking/matchmakingService";
import { makeRealtimeGateway } from "./modules/realtimeGateway/realtimeGateway";
import { initDb } from "./modules/db/initDb";

const useInMemory = process.env.USE_INMEMORY === "true";

async function main() {
  // Select the storage back-end based on the USE_INMEMORY environment flag
  let repo: InMemoryRepository | PgRepository;
  let audit: InMemoryAuditStore | PgAuditStore;

  if (useInMemory) {
    console.log("[startup] Using InMemory storage");
    repo = new InMemoryRepository();
    audit = new InMemoryAuditStore();
  } else {
    console.log("[startup] Using PostgreSQL storage");
    await initDb();
    repo = new PgRepository();
    audit = new PgAuditStore();
  }

  const jwtSecret = process.env.JWT_SECRET || "dev_secret_change_me";
  const auth = new AuthService(repo, audit, {
    jwtSecret,
    tokenTtlSeconds: 60 * 60,
    bcryptRounds: 10,
  });

  const matchmaking = makeMatchmakingService({ audit });

  // Shared in-memory map that keeps all active game sessions alive for the server's lifetime
  const gameSessions = new Map<string, any>();

  // HTTP + WS server
  const app = createApp({ repo, audit, auth, matchmaking, gameSessions });
  const server = http.createServer(app);
  const io = new IOServer(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,   // 60s — wait longer for pong before disconnecting
    pingInterval: 30000,  // 30s — heartbeat interval
  });

  // Register the WS gateway and make it accessible to the REST API for admin force-logout operations
  const gateway = makeRealtimeGateway({ io, auth, audit, gameSessions, repo });
  gateway.register();

  // Expose the gateway on the Express app instance so admin routes can call forceDisconnectUser
  (app as any)._gateway = gateway;

  const port = Number(process.env.PORT ?? 3001);
  server.listen(port, () => console.log(`http://localhost:${port}`));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
