export type AuditEventID = string;

export type AuthAuditEvent = {
  kind: "auth";
  action: "register" | "login" | "guest" | "logout" | "verify_fail";
  username?: string;
  playerId?: string;
  success: boolean;
  timestamp: number;
  meta?: Record<string, unknown>;
};

export type GameplayAuditEvent = {
  kind: "gameplay";
  action: string; // e.g. "play_card"
  playerId?: string;
  timestamp: number;
  meta?: Record<string, unknown>;
};

export type SystemAuditEvent = {
  kind: "system";
  action: string; // e.g. "startup"
  timestamp: number;
  meta?: Record<string, unknown>;
};

export type AuditEvent = (AuthAuditEvent | GameplayAuditEvent | SystemAuditEvent) & {
  id: AuditEventID;
};

export type AuditQueryFilter = Partial<{
  kind: AuditEvent["kind"];
  playerId: string;
  username: string;
  action: string;
  since: number;
  until: number;
  limit: number;
}>;

export interface AuditStore {
  logAuthEvent(event: Omit<AuthAuditEvent, "kind">): Promise<void>;
  logGameplayEvent(event: Omit<GameplayAuditEvent, "kind">): Promise<void>;
  logSystemEvent(event: Omit<SystemAuditEvent, "kind">): Promise<void>;

  queryAuditEvents(filter: AuditQueryFilter): Promise<AuditEvent[]>;
  purgeExpiredEvents(retentionDays: number): Promise<number>;
  redactEventPayload(eventId: string, fields: string[]): Promise<void>;
}
