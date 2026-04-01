CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_partman;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_partman extension is not available, continuing without automatic partition manager';
  END;
END;
$$;

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  risk_score INT NOT NULL,
  decision TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  idempotency_hash TEXT NOT NULL,
  device_fingerprint TEXT NULL,
  metadata JSONB NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created
  ON transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_created_brin
  ON transactions USING BRIN (created_at);

CREATE TABLE IF NOT EXISTS fraud_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weight INT NOT NULL,
  conditions JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_rules_enabled ON fraud_rules (enabled);
CREATE INDEX IF NOT EXISTS idx_fraud_rules_conditions_gin ON fraud_rules USING GIN (conditions);

CREATE TABLE IF NOT EXISTS risk_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_threshold INT NOT NULL,
  block_threshold INT NOT NULL,
  early_exit_score INT NOT NULL,
  multi_trigger_boost NUMERIC(5,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  replaced_by_token_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);

CREATE TABLE IF NOT EXISTS service_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id TEXT NOT NULL,
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_api_keys_key_enabled ON service_api_keys (key_id, enabled);
CREATE INDEX IF NOT EXISTS idx_service_api_keys_key_version ON service_api_keys (key_id, version DESC);

INSERT INTO risk_thresholds (review_threshold, block_threshold, early_exit_score, multi_trigger_boost)
SELECT 40, 75, 95, 0.2000
WHERE NOT EXISTS (SELECT 1 FROM risk_thresholds);

-- NOTE: Local bootstrap uses a non-partitioned table for Prisma compatibility.
-- In production, convert this table to RANGE partitions managed by pg_partman.
