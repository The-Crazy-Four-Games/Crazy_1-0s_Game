// backend/src/api/profile.ts
import { Router } from "express";
import type { AuthService } from "../modules/auth/authService";
import type { Repository } from "../types/repository";
import { requireAuth } from "../modules/auth/authMiddleware";
import { RecordNotFound } from "../types/errors";

export function makeProfileRouter(auth: AuthService, repo: Repository) {
  const router = Router();

  // GET /profile — player info, stats, last 5 matches
  router.get("/", requireAuth(auth), async (req, res) => {
    try {
      const userId = req.user!.userId;
      const [player, stats, history] = await Promise.all([
        repo.findPlayerById(userId),
        repo.getPlayerStats(userId),
        repo.getMatchHistory(userId, 5, 0),
      ]);
      const winRate = stats.total > 0 ? (stats.wins / stats.total * 100).toFixed(1) : "0.0";
      res.json({ player, stats, winRate, history });
    } catch (e: any) {
      if (e instanceof RecordNotFound) return res.status(404).json({ error: "Profile not found" });
      return res.status(500).json({ error: "getProfile failed", message: e.message });
    }
  });

  // PUT /profile/nickname { nickname }
  router.put("/nickname", requireAuth(auth), async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { nickname } = req.body ?? {};
      if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0) {
        return res.status(400).json({ error: "Nickname is required" });
      }
      const player = await repo.updatePlayerProfile(userId, { displayName: nickname.trim() });
      res.json({ player });
    } catch (e: any) {
      if (e instanceof RecordNotFound) return res.status(404).json({ error: "Profile not found" });
      return res.status(500).json({ error: "updateNickname failed", message: e.message });
    }
  });

  // PUT /profile/password { oldPassword, newPassword }
  router.put("/password", requireAuth(auth), async (req, res) => {
    try {
      const userId = req.user!.userId;
      const username = req.user!.username ?? "";
      const { oldPassword, newPassword } = req.body ?? {};
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: "Both old and new password are required" });
      }
      await auth.changePassword(userId, username, oldPassword, newPassword);
      res.json({ message: "Password changed successfully" });
    } catch (e: any) {
      return res.status(400).json({ error: e.name, message: e.message });
    }
  });

  // DELETE /profile — delete account
  router.delete("/", requireAuth(auth), async (req, res) => {
    try {
      const userId = req.user!.userId;
      await repo.clearSessionIat(userId);
      await repo.deletePlayer(userId);
      res.json({ message: "Account deleted" });
    } catch (e: any) {
      return res.status(400).json({ error: e.name, message: e.message });
    }
  });

  return router;
}
