-- phase: expand
CREATE TABLE IF NOT EXISTS directory_people (
  subject_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  website TEXT,
  visible BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS directory_people_visible_name ON directory_people (lower(display_name)) WHERE visible;
