// backend/src/types/matchmakingTypes.ts

export type LobbyID = string;
export type GameID = string;
export type UserID = string;

export type Lobby = Readonly<{
  lobbyId: LobbyID;
  hostId: UserID;
  hostUsername: string;
  guestId?: UserID;
  baseId: "dec" | "doz";
  createdAt: number;
  status: "OPEN" | "STARTED";
}>;
