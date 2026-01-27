// backend/src/types/matchmakingTypes.ts

export type LobbyID = string;
export type GameID = string;
export type UserID = string;

export type Lobby = Readonly<{
  lobbyId: LobbyID;
  hostId: UserID;
  guestId?: UserID;
  createdAt: number;
  status: "OPEN" | "STARTED";
}>;
