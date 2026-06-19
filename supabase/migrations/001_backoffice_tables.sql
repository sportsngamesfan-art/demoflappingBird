-- Backoffice core tables: analytics, audit logs, admin roles, game assets, game configs
-- Applied to project xwhhwwdtjzzqfgaoyogj

CREATE TABLE IF NOT EXISTS analytics_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name   TEXT NOT NULL,
  game_name    TEXT,
  session_id   TEXT NOT NULL,
  player_name  TEXT,
  duration_ms  INTEGER,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS analytics_events_event_created ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_game_created  ON analytics_events (game_name, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID REFERENCES auth.users(id),
  admin_email  TEXT NOT NULL,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT,
  old_value    JSONB,
  new_value    JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_admin   ON audit_logs (admin_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_roles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('superadmin', 'editor')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_name   TEXT NOT NULL,
  asset_type  TEXT NOT NULL,
  asset_key   TEXT,
  url         TEXT NOT NULL,
  prompt      TEXT,
  is_active   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS game_assets_lookup ON game_assets (game_name, asset_type, asset_key);

CREATE TABLE IF NOT EXISTS game_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_name    TEXT NOT NULL,
  config_key   TEXT NOT NULL,
  config_value JSONB NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_by   UUID REFERENCES auth.users(id),
  UNIQUE(game_name, config_key)
);
