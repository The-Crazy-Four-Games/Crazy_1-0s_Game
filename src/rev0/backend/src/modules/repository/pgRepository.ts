import crypto from "crypto";
import { query } from "../db/db";
import type {
    Repository,
    Player,
    PlayerID,
    PlayerData,
    PlayerProfileData,
    CredentialData,
    CredentialRecord,
    MatchResult,
    MatchHistoryEntry,
    PlayerStats,
} from "../../types/repository";
import {
    RecordNotFound,
    UniqueConstraintViolation,
} from "../../types/errors";

export class PgRepository implements Repository {
    /* ───── Players ───── */

    async findPlayerByUsername(username: string): Promise<Player> {
        const { rows } = await query(
            `SELECT id, username, display_name AS "displayName", created_at AS "createdAt"
         FROM players WHERE username = $1`,
            [username]
        );
        if (rows.length === 0)
            throw new RecordNotFound(`Player not found for username: ${username}`);
        return this.toPlayer(rows[0]);
    }

    async findPlayerById(playerId: PlayerID): Promise<Player> {
        const { rows } = await query(
            `SELECT id, username, display_name AS "displayName", created_at AS "createdAt"
         FROM players WHERE id = $1`,
            [playerId]
        );
        if (rows.length === 0)
            throw new RecordNotFound(`Player not found for id: ${playerId}`);
        return this.toPlayer(rows[0]);
    }

    async createPlayer(data: PlayerData): Promise<Player> {
        const id = crypto.randomUUID();
        const now = Date.now();
        try {
            await query(
                `INSERT INTO players (id, username, display_name, created_at)
         VALUES ($1, $2, $3, $4)`,
                [id, data.username, data.displayName ?? null, now]
            );
        } catch (e: any) {
            // Postgres unique violation code = 23505
            if (e.code === "23505")
                throw new UniqueConstraintViolation(
                    `Username already exists: ${data.username}`
                );
            throw e;
        }
        return { id, username: data.username, displayName: data.displayName, createdAt: now };
    }

    async updatePlayerProfile(
        playerId: PlayerID,
        data: PlayerProfileData
    ): Promise<Player> {
        // ensure exists first
        await this.findPlayerById(playerId);

        if (data.displayName !== undefined) {
            await query(
                `UPDATE players SET display_name = $1 WHERE id = $2`,
                [data.displayName, playerId]
            );
        }
        return this.findPlayerById(playerId);
    }

    async deletePlayer(playerId: PlayerID): Promise<void> {
        await this.findPlayerById(playerId); // throws RecordNotFound if missing
        await query(`DELETE FROM players WHERE id = $1`, [playerId]);
    }

    /* ───── Credentials ───── */

    async storeCredential(playerId: PlayerID, cred: CredentialData): Promise<void> {
        await this.findPlayerById(playerId); // ensure player exists
        const now = Date.now();
        try {
            await query(
                `INSERT INTO credentials (username, password_hash, player_id, created_at)
         VALUES ($1, $2, $3, $4)`,
                [cred.username, cred.passwordHash, cred.playerId, now]
            );
        } catch (e: any) {
            if (e.code === "23505")
                throw new UniqueConstraintViolation(
                    `Credential already exists for username: ${cred.username}`
                );
            throw e;
        }
    }

    async getCredentialByUsername(username: string): Promise<CredentialRecord> {
        const { rows } = await query(
            `SELECT username, password_hash AS "passwordHash", player_id AS "playerId", created_at AS "createdAt"
         FROM credentials WHERE username = $1`,
            [username]
        );
        if (rows.length === 0)
            throw new RecordNotFound(`Credential not found for username: ${username}`);
        return rows[0] as CredentialRecord;
    }

    async changePassword(username: string, newPasswordHash: string): Promise<void> {
        const res = await query(
            `UPDATE credentials SET password_hash = $1 WHERE username = $2`,
            [newPasswordHash, username]
        );
        if ((res as any).rowCount === 0)
            throw new RecordNotFound(`Credential not found for username: ${username}`);
    }

    /* ───── Match Results ───── */

    async saveMatchResult(result: MatchResult): Promise<void> {
        await query(
            `INSERT INTO match_results (id, player_id, opponent_id, outcome, player_score, opponent_score, base_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [result.id, result.playerId, result.opponentId ?? null, result.outcome,
            result.playerScore ?? null, result.opponentScore ?? null, result.baseId ?? null,
            result.timestamp]
        );
    }

    async getMatchHistory(
        playerId: PlayerID,
        limit: number,
        offset: number
    ): Promise<MatchHistoryEntry[]> {
        const { rows } = await query(
            `SELECT m.id, m.player_id AS "playerId", m.opponent_id AS "opponentId",
                    m.outcome, m.player_score AS "playerScore",
                    m.opponent_score AS "opponentScore", m.base_id AS "baseId",
                    m.timestamp,
                    COALESCE(p.display_name, p.username) AS "opponentNickname"
             FROM match_results m
             LEFT JOIN players p ON p.id = m.opponent_id
             WHERE m.player_id = $1
             ORDER BY m.timestamp DESC
             LIMIT $2 OFFSET $3`,
            [playerId, limit, offset]
        );
        return rows as MatchHistoryEntry[];
    }

    async getPlayerStats(playerId: PlayerID): Promise<PlayerStats> {
        const { rows } = await query(
            `SELECT
         COUNT(*)::int                                    AS total,
         COUNT(*) FILTER (WHERE outcome = 'win')::int     AS wins,
         COUNT(*) FILTER (WHERE outcome = 'lose')::int    AS losses,
         COUNT(*) FILTER (WHERE outcome = 'draw')::int    AS draws
       FROM match_results
       WHERE player_id = $1`,
            [playerId]
        );
        const r = rows[0] ?? { total: 0, wins: 0, losses: 0, draws: 0 };
        return { playerId, wins: r.wins, losses: r.losses, draws: r.draws, total: r.total };
    }

    /* ───── Game State (optional persistence) ───── */

    async saveGameState(gameId: string, state: unknown): Promise<void> {
        await query(
            `INSERT INTO game_states (game_id, state)
       VALUES ($1, $2)
       ON CONFLICT (game_id) DO UPDATE SET state = EXCLUDED.state`,
            [gameId, JSON.stringify(state)]
        );
    }

    async getGameState(gameId: string): Promise<unknown | undefined> {
        const { rows } = await query(
            `SELECT state FROM game_states WHERE game_id = $1`,
            [gameId]
        );
        return rows.length > 0 ? rows[0].state : undefined;
    }

    /* ───── Session Tracking ───── */

    async setSessionIat(playerId: PlayerID, iat: number): Promise<void> {
        await query(
            `UPDATE players SET session_iat = $1 WHERE id = $2`,
            [iat, playerId]
        );
    }

    async clearSessionIat(playerId: PlayerID): Promise<void> {
        await query(
            `UPDATE players SET session_iat = NULL WHERE id = $1`,
            [playerId]
        );
    }

    async getSessionIat(playerId: PlayerID): Promise<number | null> {
        const { rows } = await query(
            `SELECT session_iat AS "sessionIat" FROM players WHERE id = $1`,
            [playerId]
        );
        if (rows.length === 0) return null;
        return rows[0].sessionIat ? Number(rows[0].sessionIat) : null;
    }

    /* ───── Admin ───── */

    async searchPlayers(q: string): Promise<Player[]> {
        const pattern = `%${q}%`;
        const { rows } = await query(
            `SELECT id, username, display_name AS "displayName", created_at AS "createdAt"
             FROM players
             WHERE username ILIKE $1 OR display_name ILIKE $1
             ORDER BY username
             LIMIT 20`,
            [pattern]
        );
        return rows.map((r: any) => this.toPlayer(r));
    }

    async clearMatchHistory(playerId: PlayerID): Promise<void> {
        await query(`DELETE FROM match_results WHERE player_id = $1`, [playerId]);
    }

    /* ───── helpers ───── */

    private toPlayer(row: any): Player {
        return {
            id: row.id,
            username: row.username,
            displayName: row.displayName ?? undefined,
            createdAt: Number(row.createdAt),
        };
    }
}
