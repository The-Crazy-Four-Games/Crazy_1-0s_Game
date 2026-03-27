// backend/src/modules/matchmaking/matchmakingService.ts
import { randomUUID } from "node:crypto";
import type { Lobby, LobbyID, UserID, GameID } from "../../types/matchmakingTypes";
import { createGame, getPublicState } from "@rev0/shared";

export type AuditStore = {
  logSystemEvent: (event: { type: string; at: number; data?: unknown }) => void;
};

export type MatchmakingService = {
  createLobby(hostId: UserID, hostUsername: string, baseId: "dec" | "doz"): Lobby;
  joinLobby(lobbyId: LobbyID, userId: UserID): Lobby;
  startMatch(
    lobbyId: LobbyID,
    hostId: UserID
  ): { gameId: GameID; lobby: Lobby; publicState: unknown; game: unknown };
  getLobby(lobbyId: LobbyID): Lobby | undefined;
  listOpenRooms(): Lobby[];
  leaveLobby(lobbyId: LobbyID, userId: UserID): void;
  deleteLobby(lobbyId: LobbyID): void;
};

export class LobbyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LobbyError";
  }
}
export class LobbyNotFound extends LobbyError {
  constructor() {
    super("LobbyNotFound");
    this.name = "LobbyNotFound";
  }
}
export class LobbyFull extends LobbyError {
  constructor() {
    super("LobbyFull");
    this.name = "LobbyFull";
  }
}
export class NotLobbyHost extends LobbyError {
  constructor() {
    super("NotLobbyHost");
    this.name = "NotLobbyHost";
  }
}
export class LobbyAlreadyStarted extends LobbyError {
  constructor() {
    super("LobbyAlreadyStarted");
    this.name = "LobbyAlreadyStarted";
  }
}

export function makeMatchmakingService(deps: { audit: AuditStore }): MatchmakingService {
  const lobbies = new Map<LobbyID, Lobby>();

  function getLobbyOrThrow(lobbyId: LobbyID): Lobby {
    const l = lobbies.get(lobbyId);
    if (!l) throw new LobbyNotFound();
    return l;
  }

  return {
    createLobby(hostId, hostUsername, baseId) {
      const lobbyId = `l_${randomUUID().slice(0, 8)}`;
      const lobby: Lobby = {
        lobbyId,
        hostId,
        hostUsername,
        guestId: undefined,
        baseId,
        createdAt: Date.now(),
        status: "OPEN",
      };
      lobbies.set(lobbyId, lobby);
      deps.audit.logSystemEvent({ type: "LOBBY_CREATED", at: Date.now(), data: lobby });
      return lobby;
    },

    joinLobby(lobbyId, userId) {
      const l = getLobbyOrThrow(lobbyId);
      if (l.status !== "OPEN") throw new LobbyAlreadyStarted();
      if (l.guestId && l.guestId !== userId) throw new LobbyFull();
      if (l.hostId === userId) return l;

      const updated: Lobby = { ...l, guestId: userId };
      lobbies.set(lobbyId, updated);
      deps.audit.logSystemEvent({ type: "LOBBY_JOINED", at: Date.now(), data: { lobbyId, userId } });
      return updated;
    },

    startMatch(lobbyId, hostId) {
      const l = getLobbyOrThrow(lobbyId);
      if (l.status !== "OPEN") throw new LobbyAlreadyStarted();
      if (l.hostId !== hostId) throw new NotLobbyHost();
      if (!l.guestId) throw new LobbyError("NeedGuestToStart");

      const players = [l.hostId, l.guestId] as [string, string];

      const game = createGame({
        baseId: l.baseId,
        players,
        initialHandSize: 7,
      });

      const gameId = game.gameId;

      const updated: Lobby = { ...l, status: "STARTED" };
      lobbies.set(lobbyId, updated);

      deps.audit.logSystemEvent({ type: "MATCH_STARTED", at: Date.now(), data: { lobbyId, gameId, baseId: l.baseId } });


      return {
        gameId,
        lobby: updated,
        publicState: getPublicState(game),
        game,
      };
    },

    getLobby(lobbyId) {
      return lobbies.get(lobbyId);
    },

    listOpenRooms() {
      return Array.from(lobbies.values()).filter(l => l.status === "OPEN");
    },

    leaveLobby(lobbyId, userId) {
      const l = lobbies.get(lobbyId);
      if (!l) return;
      if (l.hostId === userId) {
        // Host leaves: always delete the room
        lobbies.delete(lobbyId);
        deps.audit.logSystemEvent({ type: "LOBBY_HOST_LEFT_DELETED", at: Date.now(), data: { lobbyId, userId } });
      } else if (l.guestId === userId) {
        const updated: Lobby = { ...l, guestId: undefined };
        lobbies.set(lobbyId, updated);
        deps.audit.logSystemEvent({ type: "LOBBY_GUEST_LEFT", at: Date.now(), data: { lobbyId, userId } });
      }
    },

    deleteLobby(lobbyId) {
      lobbies.delete(lobbyId);
      deps.audit.logSystemEvent({ type: "LOBBY_FORCE_DELETED", at: Date.now(), data: { lobbyId } });
    },
  };
}

