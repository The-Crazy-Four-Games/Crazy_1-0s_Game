import { Router } from "express";
import type { AuthService } from "../modules/auth/authService";
import type { Repository } from "../types/repository";
import { requireAuth } from "../modules/auth/authMiddleware";
import { RecordNotFound } from "../types/errors";

export function makeProfileRouter(auth: AuthService, repo: Repository) {
  const router = Router();

  // getProfile
  router.get("/", requireAuth(auth), async (req, res) => {
    try {
      const player = await repo.findPlayerById(req.user!.userId);
      res.json({ player });
    } catch (e: any) {
      if (e instanceof RecordNotFound) return res.status(404).json({ error: "Profile not found" });
      return res.status(500).json({ error: "getProfile failed" });
    }
  });

  // putProfile (only updates displayName in our minimal model)
  router.put("/", requireAuth(auth), async (req, res) => {
    const { displayName } = req.body ?? {};
    try {
      const player = await repo.updatePlayerProfile(req.user!.userId, {
        displayName: displayName ? String(displayName) : undefined,
      });
      res.json({ player });
    } catch (e: any) {
      if (e instanceof RecordNotFound) return res.status(404).json({ error: "Profile not found" });
      return res.status(500).json({ error: "putProfile failed" });
    }
  });

  return router;
}
