import crypto from "crypto";
import { query } from "../db/db";
import type {
    AuditStore,
    AuditEvent,
    AuditQueryFilter,
} from "../../types/audit";
import { RecordNotFound } from "../../types/errors";

export class PgAuditStore implements AuditStore {
    async logAuthEvent(event: any): Promise<void> {
        const id = crypto.randomUUID();
        await query(
            `INSERT INTO audit_events (id, kind, action, player_id, username, success, timestamp, meta)
       VALUES ($1, 'auth', $2, $3, $4, $5, $6, $7)`,
            [
                id,
                event.action ?? null,
                event.playerId ?? null,
                event.username ?? null,
                event.success ?? null,
                event.timestamp ?? Date.now(),
                event.meta ? JSON.stringify(event.meta) : null,
            ]
        );
    }

    async logGameplayEvent(event: any): Promise<void> {
        const id = crypto.randomUUID();
        await query(
            `INSERT INTO audit_events (id, kind, action, player_id, timestamp, meta)
       VALUES ($1, 'gameplay', $2, $3, $4, $5)`,
            [
                id,
                event.action ?? null,
                event.playerId ?? null,
                event.timestamp ?? Date.now(),
                event.meta ? JSON.stringify(event.meta) : null,
            ]
        );
    }

    async logSystemEvent(event: any): Promise<void> {
        const id = crypto.randomUUID();
        await query(
            `INSERT INTO audit_events (id, kind, action, timestamp, meta)
       VALUES ($1, 'system', $2, $3, $4)`,
            [
                id,
                event.action ?? null,
                event.timestamp ?? Date.now(),
                event.meta ? JSON.stringify(event.meta) : null,
            ]
        );
    }

    async queryAuditEvents(filter: AuditQueryFilter): Promise<AuditEvent[]> {
        const conditions: string[] = [];
        const params: any[] = [];
        let i = 1;

        if (filter.kind) {
            conditions.push(`kind = $${i++}`);
            params.push(filter.kind);
        }
        if (filter.playerId) {
            conditions.push(`player_id = $${i++}`);
            params.push(filter.playerId);
        }
        if (filter.username) {
            conditions.push(`username = $${i++}`);
            params.push(filter.username);
        }
        if (filter.action) {
            conditions.push(`action = $${i++}`);
            params.push(filter.action);
        }
        if (filter.since) {
            conditions.push(`timestamp >= $${i++}`);
            params.push(filter.since);
        }
        if (filter.until) {
            conditions.push(`timestamp <= $${i++}`);
            params.push(filter.until);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const limit = filter.limit ?? 100;

        const { rows } = await query(
            `SELECT id, kind, action, player_id AS "playerId", username, success, timestamp, meta
         FROM audit_events
         ${where}
         ORDER BY timestamp DESC
         LIMIT $${i}`,
            [...params, limit]
        );

        return rows.map((r: any) => ({
            id: r.id,
            kind: r.kind,
            action: r.action,
            playerId: r.playerId,
            username: r.username,
            success: r.success,
            timestamp: Number(r.timestamp),
            meta: r.meta,
        })) as AuditEvent[];
    }

    async purgeExpiredEvents(retentionDays: number): Promise<number> {
        const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        const { rowCount } = await query(
            `DELETE FROM audit_events WHERE timestamp < $1`,
            [cutoff]
        );
        return rowCount ?? 0;
    }

    async redactEventPayload(eventId: string, fields: string[]): Promise<void> {
        // Check exists
        const { rows } = await query(
            `SELECT meta FROM audit_events WHERE id = $1`,
            [eventId]
        );
        if (rows.length === 0)
            throw new RecordNotFound(`Audit event not found: ${eventId}`);

        const meta = rows[0].meta ?? {};
        for (const f of fields) {
            if (f in meta) meta[f] = "[REDACTED]";
        }

        await query(`UPDATE audit_events SET meta = $1 WHERE id = $2`, [
            JSON.stringify(meta),
            eventId,
        ]);
    }
}
