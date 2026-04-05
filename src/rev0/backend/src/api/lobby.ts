// backend/src/api/lobby.ts
import { Router } from "express";
import type { MatchmakingService } from "../modules/matchmaking/matchmakingService";
import type { Repository } from "../types/repository";

function requireUserId(req: any): string {
    const id = req.userId ?? req.headers["x-user-id"];
    if (!id || typeof id !== "string") throw new Error("MissingUserId");
    return id;
}


export function makeLobbyRouter(mm: MatchmakingService, gameSessions?: Map<string, any>, repo?: Repository) {
    const r = Router();

    // easy cache to track which gameId belongs to which lobby
    const lobbyGameId = new Map<string, string>();

    // GET /lobby/list — return all open rooms
    r.get("/list", (_req, res) => {
        try {
            const rooms = mm.listOpenRooms();
            res.json({ rooms });
        } catch (e: any) {
            res.status(400).json({ error: e.name, message: e.message });
        }
    });

    // POST /lobby/create { baseId }
    r.post("/create", async (req, res) => {
        try {
            const hostId = requireUserId(req);
            const { baseId = "doz", username = "Unknown" } = req.body ?? {};
            // Resolve display name (nickname) for display in room list
            let displayName = username;
            if (repo) {
                try {
                    const player = await repo.findPlayerById(hostId);
                    displayName = player.displayName || player.username;
                } catch { /* use username fallback */ }
            }
            const lobby = mm.createLobby(hostId, displayName, baseId);
            res.json({ lobby, gameId: lobbyGameId.get(lobby.lobbyId) ?? null });
        } catch (e: any) {
            res.status(400).json({ error: e.name, message: e.message });
        }
    });

    // POST /lobby/join { lobbyId }
    r.post("/join", (req, res) => {
        try {
            const userId = requireUserId(req);
            const { lobbyId } = req.body ?? {};
            const lobby = mm.joinLobby(lobbyId, userId);
            res.json({ lobby, gameId: lobbyGameId.get(lobbyId) ?? null });
        } catch (e: any) {
            res.status(400).json({ error: e.name, message: e.message });
        }
    });

    // POST /lobby/start { lobbyId }
    r.post("/start", (req, res) => {
        try {
            const hostId = requireUserId(req);
            const { lobbyId } = req.body ?? {};
            const out = mm.startMatch(lobbyId, hostId);
            if (gameSessions) {
                gameSessions.set(out.gameId, out.game);
            }
            // record gameId for this lobby
            lobbyGameId.set(lobbyId, out.gameId);

            res.json({
                gameId: out.gameId,
                lobby: out.lobby,
                publicState: out.publicState,
            });
        } catch (e: any) {
            res.status(400).json({ error: e.name, message: e.message });
        }
    });

    r.get("/status", (req, res) => {
        try {
            const lobbyId = String((req.query as any)?.lobbyId ?? "");
            if (!lobbyId) throw new Error("NeedLobbyId");

            const lobby = mm.getLobby(lobbyId);
            if (!lobby) throw new Error("LobbyNotFound");

            res.json({ lobby, gameId: lobbyGameId.get(lobbyId) ?? null });
        } catch (e: any) {
            res.status(400).json({ error: e.name, message: e.message });
        }
    });

    // POST /lobby/leave { lobbyId }
    r.post("/leave", (req, res) => {
        try {
            const userId = requireUserId(req);
            const { lobbyId } = req.body ?? {};
            if (!lobbyId) throw new Error("NeedLobbyId");
            mm.leaveLobby(lobbyId, userId);
            res.json({ message: "Left room" });
        } catch (e: any) {
            res.status(400).json({ error: e.name, message: e.message });
        }
    });

    return r;
}

