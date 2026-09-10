CREATE TABLE IF NOT EXISTS reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT        NOT NULL CHECK (char_length(message) >= 1 AND char_length(message) <= 1000),
  is_edited   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UNIQUE on review_id enforces one admin reply per review
CREATE TABLE IF NOT EXISTS review_replies (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    UUID        NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  message      TEXT        NOT NULL CHECK (char_length(message) >= 1 AND char_length(message) <= 1000),
  is_edited    BOOLEAN     NOT NULL DEFAULT FALSE,
  seen_by_user BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id     ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at  ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reply_review_id     ON review_replies(review_id);
CREATE INDEX IF NOT EXISTS idx_reply_unseen        ON review_replies(seen_by_user) WHERE seen_by_user = FALSE;