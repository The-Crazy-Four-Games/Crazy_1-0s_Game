// backend/src/api/v1.ts
import { Router } from "express";
import type { AuthService } from "../modules/auth/authService";
import type { Repository } from "../types/repository";
import type { AuditStore } from "../types/audit";
import type { MatchmakingService } from "../modules/matchmaking/matchmakingService";

import { makeAuthRouter } from "./auth";
import { makeHealthRouter } from "./health";
import { makeProfileRouter } from "./profile";
import { makeLobbyRouter } from "./lobby";

export function makeV1Router(deps: {
  auth: AuthService;
  repo: Repository;
  audit: AuditStore;
  matchmaking: MatchmakingService;
  gameSessions: Map<string, any>; 
}) {
  const router = Router();

  router.use("/health", makeHealthRouter());
  router.use("/auth", makeAuthRouter(deps.auth));
  router.use("/profile", makeProfileRouter(deps.auth, deps.repo));

  // send gameSessions to lobby router
  router.use("/lobby", makeLobbyRouter(deps.matchmaking, deps.gameSessions));

  return router;
}
