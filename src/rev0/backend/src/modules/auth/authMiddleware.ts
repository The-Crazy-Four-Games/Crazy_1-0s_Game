import type { Request, Response, NextFunction } from "express";
import type { AuthService } from "./authService";
import { InvalidToken, ExpiredToken } from "../../types/errors";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username?: string;
        role: "guest" | "user";
      };
    }
  }
}

function getBearerToken(req: Request): string | null {
  const h = req.header("authorization");
  if (!h) return null;
  const [type, token] = h.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function requireAuth(auth: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing token" });

    try {
      const claims = auth.verifyToken(token);
      req.user = { userId: claims.userId, username: claims.username, role: claims.role };
      next();
    } catch (e: any) {
      if (e instanceof ExpiredToken) return res.status(401).json({ error: "Token expired" });
      if (e instanceof InvalidToken) return res.status(401).json({ error: "Invalid token" });
      return res.status(500).json({ error: "Auth error" });
    }
  };
}

export function requireUser(auth: AuthService) {
  const mw = requireAuth(auth);
  return (req: Request, res: Response, next: NextFunction) => {
    mw(req, res, () => {
      if (req.user?.role !== "user") return res.status(403).json({ error: "User role required" });
      next();
    });
  };
}
