export type PlayerID = string;

export type UserRole = "guest" | "user";

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
  outcome: "win" | "lose" | "draw";
  timestamp: number;
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

  saveMatchResult(result: MatchResult): Promise<void>;
  getMatchHistory(playerId: PlayerID, limit: number, offset: number): Promise<MatchResult[]>;
  getPlayerStats(playerId: PlayerID): Promise<PlayerStats>;
}
