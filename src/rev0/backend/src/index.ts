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
  // Choose repository & audit store
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

  // create and reuse a single gameSessions map
  const gameSessions = new Map<string, any>();

  // HTTP + WS server
  const app = createApp({ repo, audit, auth, matchmaking, gameSessions });
  const server = http.createServer(app);
  const io = new IOServer(server, { cors: { origin: "*" } });

  // WS gateway (uses gameSessions, tracks users for force-logout)
  const gateway = makeRealtimeGateway({ io, auth, audit, gameSessions, repo });
  gateway.register();

  // Inject gateway into app for admin force-logout
  (app as any)._gateway = gateway;

  const port = Number(process.env.PORT ?? 3001);
  server.listen(port, () => console.log(`http://localhost:${port}`));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
