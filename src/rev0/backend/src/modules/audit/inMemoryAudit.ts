import crypto from "crypto";
import type { AuditStore, AuditEvent, AuditQueryFilter } from "../../types/audit";
import { RecordNotFound } from "../../types/errors";

export class InMemoryAuditStore implements AuditStore {
  private events: AuditEvent[] = [];

  async logAuthEvent(event: any): Promise<void> {
    this.events.push({ id: crypto.randomUUID(), kind: "auth", ...event });
  }

  async logGameplayEvent(event: any): Promise<void> {
    this.events.push({ id: crypto.randomUUID(), kind: "gameplay", ...event });
  }

  async logSystemEvent(event: any): Promise<void> {
    this.events.push({ id: crypto.randomUUID(), kind: "system", ...event });
  }

  async queryAuditEvents(filter: AuditQueryFilter): Promise<AuditEvent[]> {
    const {
      kind,
      playerId,
      username,
      action,
      since,
      until,
      limit = 100,
    } = filter;

    let out = this.events;

    if (kind) out = out.filter(e => e.kind === kind);
    if (playerId) out = out.filter(e => (e as any).playerId === playerId);
    if (username) out = out.filter(e => (e as any).username === username);
    if (action) out = out.filter(e => (e as any).action === action);
    if (since) out = out.filter(e => e.timestamp >= since);
    if (until) out = out.filter(e => e.timestamp <= until);

    // newest first
    out = [...out].sort((a, b) => b.timestamp - a.timestamp);

    return out.slice(0, limit);
  }

  async purgeExpiredEvents(retentionDays: number): Promise<number> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const before = this.events.length;
    this.events = this.events.filter(e => e.timestamp >= cutoff);
    return before - this.events.length;
  }

  async redactEventPayload(eventId: string, fields: string[]): Promise<void> {
    const idx = this.events.findIndex(e => e.id === eventId);
    if (idx === -1) throw new RecordNotFound(`Audit event not found: ${eventId}`);

    const e: any = this.events[idx];
    if (!e.meta) e.meta = {};
    for (const f of fields) {
      if (f in e.meta) e.meta[f] = "[REDACTED]";
    }
    this.events[idx] = e;
  }
}
