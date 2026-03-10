import crypto from "crypto";
import type {
  Repository,
  Player,
  PlayerID,
  PlayerData,
  PlayerProfileData,
  CredentialData,
  CredentialRecord,
  MatchResult,
  PlayerStats,
} from "../../types/repository";
import {
  RecordNotFound,
  UniqueConstraintViolation,
} from "../../types/errors";

export class InMemoryRepository implements Repository {
  private playersById = new Map<PlayerID, Player>();
  private playerIdByUsername = new Map<string, PlayerID>();

  private credentialsByUsername = new Map<string, CredentialRecord>();

  private matchResultsByPlayerId = new Map<PlayerID, MatchResult[]>();

  async findPlayerByUsername(username: string): Promise<Player> {
    const id = this.playerIdByUsername.get(username);
    if (!id) throw new RecordNotFound(`Player not found for username: ${username}`);
    return this.findPlayerById(id);
  }

  async findPlayerById(playerId: PlayerID): Promise<Player> {
    const p = this.playersById.get(playerId);
    if (!p) throw new RecordNotFound(`Player not found for id: ${playerId}`);
    return p;
  }

  async createPlayer(data: PlayerData): Promise<Player> {
    const { username, displayName } = data;
    if (this.playerIdByUsername.has(username)) {
      throw new UniqueConstraintViolation(`Username already exists: ${username}`);
    }

    const id = crypto.randomUUID();
    const player: Player = {
      id,
      username,
      displayName,
      createdAt: Date.now(),
    };

    this.playersById.set(id, player);
    this.playerIdByUsername.set(username, id);
    return player;
  }
  private gameStatesById = new Map<string, unknown>();

  saveGameState(gameId: string, state: unknown) {
    this.gameStatesById.set(gameId, state);
  }

  getGameState(gameId: string) {
    return this.gameStatesById.get(gameId);
  }

  async updatePlayerProfile(playerId: PlayerID, data: PlayerProfileData): Promise<Player> {
    const p = await this.findPlayerById(playerId);
    const updated: Player = { ...p, ...data };
    this.playersById.set(playerId, updated);
    return updated;
  }

  async deletePlayer(playerId: PlayerID): Promise<void> {
    const p = await this.findPlayerById(playerId);
    this.playersById.delete(playerId);
    this.playerIdByUsername.delete(p.username);
    // also delete matches (optional)
    this.matchResultsByPlayerId.delete(playerId);
  }

  async storeCredential(playerId: PlayerID, cred: CredentialData): Promise<void> {
    // ensure player exists
    await this.findPlayerById(playerId);

    const existing = this.credentialsByUsername.get(cred.username);
    if (existing) throw new UniqueConstraintViolation(`Credential already exists for username: ${cred.username}`);

    const record: CredentialRecord = {
      ...cred,
      createdAt: Date.now(),
    };
    this.credentialsByUsername.set(cred.username, record);
  }

  async getCredentialByUsername(username: string): Promise<CredentialRecord> {
    const rec = this.credentialsByUsername.get(username);
    if (!rec) throw new RecordNotFound(`Credential not found for username: ${username}`);
    return rec;
  }

  async saveMatchResult(result: MatchResult): Promise<void> {
    const list = this.matchResultsByPlayerId.get(result.playerId) ?? [];
    list.push(result);
    this.matchResultsByPlayerId.set(result.playerId, list);
  }

  async getMatchHistory(playerId: PlayerID, limit: number, offset: number): Promise<MatchResult[]> {
    const list = this.matchResultsByPlayerId.get(playerId) ?? [];
    return list.slice(offset, offset + limit);
  }

  async getPlayerStats(playerId: PlayerID): Promise<PlayerStats> {
    const list = this.matchResultsByPlayerId.get(playerId) ?? [];
    const stats: PlayerStats = {
      playerId,
      wins: 0,
      losses: 0,
      draws: 0,
      total: list.length,
    };
    for (const r of list) {
      if (r.outcome === "win") stats.wins++;
      else if (r.outcome === "lose") stats.losses++;
      else stats.draws++;
    }
    return stats;
  }
}
