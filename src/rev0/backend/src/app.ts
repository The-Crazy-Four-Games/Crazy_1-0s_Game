/**
 * @file app.ts
 * @module backend/app
 * @author The Crazy 4 Team
 * @date 2026
 * @purpose Creates and configures the Express application, attaches CORS,
 *          JSON parsing, JWT-based authentication middleware, and the
 *          versioned REST API router.
 */
import express from "express";
import cors from "cors";
import type { Request, Response, NextFunction } from "express";
import { makeV1Router } from "./api/v1";

export function createApp(deps: {
  auth: any;
  repo: any;
  audit: any;
  matchmaking: any;
  gameSessions: Map<string, any>;
}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Extract Bearer token from Authorization header and attach the decoded userId to every request
  app.use((req: Request & any, _res: Response, next: NextFunction) => {
    const h = req.headers["authorization"];
    if (typeof h === "string") {
      const m = h.match(/^Bearer\s+(.+)$/i);
      if (m) {
        try {
          const claims = deps.auth.verifyToken(m[1]);
          req.userId = claims.userId;
        } catch {}
      }
    }
    next();
  });

  app.use("/api/v1", makeV1Router(deps));
  return app;
}
