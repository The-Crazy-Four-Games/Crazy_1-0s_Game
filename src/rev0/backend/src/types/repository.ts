export type PlayerID = string;

export type UserRole = "guest" | "user" | "admin";

export type Player = {
  id: PlayerID;
  username: string;      // for guest we can set something like "guest_<id>"
  displayName?: string;
  createdAt: number;
};

export type PlayerData = {
  username: string;
  displayName?: string;
};

export type PlayerProfileData = {
  displayName?: string;
};

export type CredentialData = {
  username: string;
  passwordHash: string;
  playerId: PlayerID;
};

export type CredentialRecord = CredentialData & {
  createdAt: number;
};

export type MatchResult = {
  id: string;
  playerId: PlayerID;
  opponentId?: PlayerID;
  outcome: "win" | "lose" | "draw";
  playerScore?: number;
  opponentScore?: number;
  baseId?: string;
  timestamp: number;
};

export type MatchHistoryEntry = MatchResult & {
  opponentNickname?: string;
};

export type PlayerStats = {
  playerId: PlayerID;
  wins: number;
  losses: number;
  draws: number;
  total: number;
};

export interface Repository {
  findPlayerByUsername(username: string): Promise<Player>;
  findPlayerById(playerId: PlayerID): Promise<Player>;
  createPlayer(data: PlayerData): Promise<Player>;
  updatePlayerProfile(playerId: PlayerID, data: PlayerProfileData): Promise<Player>;
  deletePlayer(playerId: PlayerID): Promise<void>;

  storeCredential(playerId: PlayerID, cred: CredentialData): Promise<void>;
  getCredentialByUsername(username: string): Promise<CredentialRecord>;
  changePassword(username: string, newPasswordHash: string): Promise<void>;

  saveMatchResult(result: MatchResult): Promise<void>;
  getMatchHistory(playerId: PlayerID, limit: number, offset: number): Promise<MatchHistoryEntry[]>;
  getPlayerStats(playerId: PlayerID): Promise<PlayerStats>;

  // Session tracking (for duplicate login prevention)
  setSessionIat(playerId: PlayerID, iat: number): Promise<void>;
  clearSessionIat(playerId: PlayerID): Promise<void>;
  getSessionIat(playerId: PlayerID): Promise<number | null>;

  // Admin
  searchPlayers(query: string): Promise<Player[]>;
  clearMatchHistory(playerId: PlayerID): Promise<void>;
}

