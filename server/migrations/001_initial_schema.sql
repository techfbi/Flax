-- Run this file against your Neon database to create the initial schema.
-- Command: psql $DATABASE_URL -f migrations/001_initial_schema.sql
-- Or use your Neon dashboard SQL editor to run it manually.

-- gen_random_uuid() is built into PostgreSQL 13+.
-- Neon runs PostgreSQL 16 so no extension is needed.

-- Temporary storage for unverified registrations.
-- Data moves to the users table only after OTP verification.
-- Rows older than 3 days are cleaned up automatically by the server.
CREATE TABLE IF NOT EXISTS pending_registrations (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  otp_hash      TEXT NOT NULL,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,   -- failed OTP attempts counter
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                        -- NULL for OAuth users
  provider      TEXT NOT NULL DEFAULT 'local',
  provider_id   TEXT,                        -- NULL for local users
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  avatar_url    TEXT,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ                  -- NULL means active, timestamp means soft-deleted
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  family_id  TEXT NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  region            TEXT,
  dietary_style     TEXT,
  health_goal       TEXT,
  allergies         JSONB NOT NULL DEFAULT '[]',
  health_conditions JSONB NOT NULL DEFAULT '[]',
  calorie_target    INTEGER,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_ref       TEXT,                       -- MongoDB ObjectId as string
  custom_name    TEXT,                       -- NULL if meal came from the food catalogue
  quantity_grams INTEGER NOT NULL DEFAULT 100,
  meal_type      TEXT NOT NULL,              -- breakfast | lunch | dinner | snack
  food_name      TEXT,              -- denormalised for display without MongoDB lookup
  logged_date    DATE NOT NULL,
  calories       NUMERIC(8,2),
  protein_g      NUMERIC(8,2),
  carbs_g        NUMERIC(8,2),
  fat_g          NUMERIC(8,2),
  source         TEXT NOT NULL DEFAULT 'manual', -- spin | manual | chat
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spin_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_ref         TEXT,
  result_name      TEXT NOT NULL,
  filters_applied  JSONB NOT NULL DEFAULT '[]',
  was_accepted     BOOLEAN NOT NULL DEFAULT TRUE,
  rejection_reason TEXT,                     -- NULL if the user accepted the spin result
  spun_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,           -- NULL means unused. timestamp means already used.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stores meals a user has permanently flagged as "do not show anymore".
-- food_ref is the MongoDB ObjectId of the food item as a string.
CREATE TABLE IF NOT EXISTS flagged_meals (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_ref   TEXT NOT NULL,
  food_name  TEXT NOT NULL,  -- denormalised for display without MongoDB lookup
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, food_ref)  -- one flag per meal per user
);

-- Stores foodstuff ingredients a user has at home.
-- Used to filter spin suggestions to meals the user can actually make.
-- Maximum 20 items per user enforced at application layer.
CREATE TABLE IF NOT EXISTS pantry_items (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)  -- one entry per ingredient per user. case handled in app
);


-- Covers quick lookup of all pantry items for a user when generating spin results
CREATE INDEX IF NOT EXISTS idx_pantry_items_user
  ON pantry_items(user_id); 

-- Covers quick lookup of all flagged meals for a user when generating spin results
CREATE INDEX IF NOT EXISTS idx_flagged_meals_user
  ON flagged_meals(user_id); 

-- Composite index covers the dashboard query: all logs for a user ordered by date
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date
  ON meal_logs(user_id, logged_date DESC);

-- Covers spin history queries ordered by most recent
CREATE INDEX IF NOT EXISTS idx_spin_history_user
  ON spin_history(user_id, spun_at DESC);

-- Covers the token hash lookup on every authenticated request
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
  ON refresh_tokens(token_hash);

-- Covers login lookup by email
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

-- Covers password reset token lookup by hash during password reset flow
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash
  ON password_reset_tokens(token_hash);

-- Covers pending registration lookup by email during OTP verification
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email
  ON pending_registrations(email);