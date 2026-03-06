-- Crazy Tens – PostgreSQL schema
-- Idempotent: safe to run on every startup

CREATE TABLE IF NOT EXISTS players (
  id            UUID PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  created_at    BIGINT NOT NULL,
  session_iat   BIGINT          -- tracks active login session (token issued-at)
);

-- For existing databases: add column if missing
ALTER TABLE players ADD COLUMN IF NOT EXISTS session_iat BIGINT;

CREATE TABLE IF NOT EXISTS credentials (
  username      TEXT PRIMARY KEY REFERENCES players(username) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_results (
  id              UUID PRIMARY KEY,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  opponent_id     UUID REFERENCES players(id) ON DELETE SET NULL,
  outcome         TEXT NOT NULL CHECK (outcome IN ('win', 'lose', 'draw')),
  player_score    INT,
  opponent_score  INT,
  base_id         TEXT,
  timestamp       BIGINT NOT NULL
);

-- For existing databases: add columns if missing
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS opponent_id UUID REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS player_score INT;
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS opponent_score INT;
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS base_id TEXT;

CREATE TABLE IF NOT EXISTS audit_events (
  id          UUID PRIMARY KEY,
  kind        TEXT NOT NULL,
  action      TEXT,
  player_id   TEXT,
  username    TEXT,
  success     BOOLEAN,
  timestamp   BIGINT NOT NULL,
  meta        JSONB
);

CREATE TABLE IF NOT EXISTS game_states (
  game_id     TEXT PRIMARY KEY,
  state       JSONB NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_match_results_player ON match_results(player_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_kind    ON audit_events(kind);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts      ON audit_events(timestamp);
