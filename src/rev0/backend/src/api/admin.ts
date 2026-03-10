// backend/src/api/admin.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import type { AuthService } from "../modules/auth/authService";
import type { Repository } from "../types/repository";
import type { MatchmakingService } from "../modules/matchmaking/matchmakingService";
import { requireAdmin } from "../modules/auth/authMiddleware";

export function makeAdminRouter(auth: AuthService, repo: Repository, matchmaking: MatchmakingService) {
    const router = Router();

    // POST /admin/login — admin login
    router.post("/login", async (req, res) => {
        try {
            const { username, password } = req.body ?? {};
            if (!username || !password) {
                return res.status(400).json({ error: "Username and password required" });
            }
            const result = await auth.loginAsAdmin(username, password);
            res.json(result);
        } catch (e: any) {
            return res.status(401).json({ error: e.name, message: e.message });
        }
    });

    // GET /admin/players?q=<search> — search players
    router.get("/players", requireAdmin(auth), async (req, res) => {
        try {
            const q = String(req.query.q ?? "");
            if (!q) return res.json({ players: [] });
            const players = await repo.searchPlayers(q);
            // Enrich with stats
            const results = await Promise.all(
                players.map(async (p) => {
                    const stats = await repo.getPlayerStats(p.id);
                    return { ...p, stats };
                })
            );
            res.json({ players: results });
        } catch (e: any) {
            return res.status(500).json({ error: "Search failed", message: e.message });
        }
    });

    // POST /admin/reset-password { playerId, newPassword }
    router.post("/reset-password", requireAdmin(auth), async (req, res) => {
        try {
            const { playerId, newPassword } = req.body ?? {};
            if (!playerId || !newPassword) {
                return res.status(400).json({ error: "playerId and newPassword required" });
            }
            const player = await repo.findPlayerById(playerId);
            const hash = await bcrypt.hash(newPassword, 10);
            await repo.changePassword(player.username, hash);
            // Force logout by clearing session
            await repo.clearSessionIat(playerId);
            res.json({ message: "Password reset successfully" });
        } catch (e: any) {
            return res.status(400).json({ error: e.name, message: e.message });
        }
    });

    // POST /admin/clear-history { playerId }
    router.post("/clear-history", requireAdmin(auth), async (req, res) => {
        try {
            const { playerId } = req.body ?? {};
            if (!playerId) {
                return res.status(400).json({ error: "playerId required" });
            }
            await repo.clearMatchHistory(playerId);
            res.json({ message: "Match history cleared" });
        } catch (e: any) {
            return res.status(400).json({ error: e.name, message: e.message });
        }
    });

    // POST /admin/force-logout { playerId }
    router.post("/force-logout", requireAdmin(auth), async (req, res) => {
        try {
            const { playerId } = req.body ?? {};
            if (!playerId) {
                return res.status(400).json({ error: "playerId required" });
            }
            await repo.clearSessionIat(playerId);
            // Actually kick the user via WS
            const gateway = (req.app as any)._gateway;
            if (gateway?.forceDisconnectUser) {
                await gateway.forceDisconnectUser(playerId);
            }
            res.json({ message: "Session invalidated and user disconnected" });
        } catch (e: any) {
            return res.status(400).json({ error: e.name, message: e.message });
        }
    });

    // GET /admin/rooms — list all open game rooms
    router.get("/rooms", requireAdmin(auth), (_req, res) => {
        try {
            const rooms = matchmaking.listOpenRooms();
            res.json({ rooms });
        } catch (e: any) {
            return res.status(500).json({ error: e.name, message: e.message });
        }
    });

    // POST /admin/delete-room { lobbyId }
    router.post("/delete-room", requireAdmin(auth), async (req, res) => {
        try {
            const { lobbyId } = req.body ?? {};
            if (!lobbyId) {
                return res.status(400).json({ error: "lobbyId required" });
            }
            // Get lobby info before deleting (to find players)
            const lobby = matchmaking.getLobby(lobbyId);
            const playerIds: string[] = [];
            if (lobby) {
                if (lobby.hostId) playerIds.push(lobby.hostId);
                if (lobby.guestId) playerIds.push(lobby.guestId);
            }
            matchmaking.deleteLobby(lobbyId);

            // Kick players from any in-progress game (without logging them out)
            const gateway = (req.app as any)._gateway;
            if (gateway?.kickUserFromRoom) {
                for (const pid of playerIds) {
                    await gateway.kickUserFromRoom(pid);
                }
            }

            res.json({ message: "Room deleted" });
        } catch (e: any) {
            return res.status(400).json({ error: e.name, message: e.message });
        }
    });

    return router;
}
