import http from "node:http";
import { Server as IOServer } from "socket.io";

import { createApp } from "./app";

import { InMemoryRepository } from "./modules/repository/inMemoryRepository";
import { InMemoryAuditStore } from "./modules/audit/inMemoryAudit";
import { AuthService } from "./modules/auth/authService";
import { makeMatchmakingService } from "./modules/matchmaking/matchmakingService";
import { makeRealtimeGateway } from "./modules/realtimeGateway/realtimeGateway";

const repo = new InMemoryRepository();
const audit = new InMemoryAuditStore();

const jwtSecret = process.env.JWT_SECRET || "dev_secret_change_me";
const auth = new AuthService(repo, audit, {
  jwtSecret,
  tokenTtlSeconds: 60 * 60,
  bcryptRounds: 10,
});

const matchmaking = makeMatchmakingService({ audit });

// create and reuse a single gameSessions map
const gameSessions = new Map<string, any>();

// send deps to createApp
const app = createApp({ repo, audit, auth, matchmaking, gameSessions });

const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: "*" } });

// ws uses the same gameSession
makeRealtimeGateway({ io, auth, audit, gameSessions }).register();

const port = Number(process.env.PORT ?? 3001);
server.listen(port, () => console.log(`http://localhost:${port}`));
