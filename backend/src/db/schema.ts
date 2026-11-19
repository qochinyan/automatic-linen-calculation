export const SCHEMA_SQL = `
CREATE TABLE listings (
  listing_id      TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  linen_attribute TEXT NOT NULL,
  beds            INTEGER NOT NULL CHECK (beds >= 0),
  bed_spots       INTEGER NOT NULL CHECK (bed_spots >= 0),
  sofa_beds       INTEGER NOT NULL CHECK (sofa_beds >= 0),
  sofa_spots      INTEGER NOT NULL CHECK (sofa_spots >= 0)
);

CREATE TABLE reservations (
  reservation_id            TEXT PRIMARY KEY,
  listing_id                TEXT NOT NULL REFERENCES listings(listing_id),
  status                    TEXT NOT NULL CHECK (status IN ('Confirmed', 'InHouse', 'CheckedOut', 'Canceled', 'NoShow')),
  planned_arrival_time      TEXT NOT NULL,
  planned_departure_time    TEXT NOT NULL,
  guests_count              INTEGER NOT NULL CHECK (guests_count >= 0),
  infants                   INTEGER NOT NULL CHECK (infants >= 0),
  number_of_guests_override INTEGER CHECK (number_of_guests_override IS NULL OR number_of_guests_override >= 0),
  requested_sofabed         INTEGER NOT NULL CHECK (requested_sofabed IN (0, 1))
);

CREATE INDEX idx_reservations_listing_arrival ON reservations (listing_id, planned_arrival_time);

CREATE TABLE tasks (
  task_id        TEXT PRIMARY KEY,
  task_type      TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Paused', 'Completed', 'Cancelled')),
  listing_id     TEXT REFERENCES listings(listing_id),
  reservation_id TEXT,
  planned_start  TEXT NOT NULL
);

CREATE INDEX idx_tasks_reservation ON tasks (reservation_id);

CREATE TABLE linen_records (
  task_id                 TEXT PRIMARY KEY REFERENCES tasks(task_id) ON DELETE CASCADE,
  prepared_for_guests     INTEGER NOT NULL,
  sheets                  INTEGER NOT NULL,
  towels                  INTEGER NOT NULL,
  bathmats                INTEGER NOT NULL,
  handtowels              INTEGER NOT NULL,
  dishtowels              INTEGER NOT NULL,
  requested_sofabeds_count INTEGER NOT NULL,
  source_reservation_id   TEXT NOT NULL,
  actual_guests           INTEGER NOT NULL,
  infants                 INTEGER NOT NULL,
  number_of_guests_override INTEGER,
  requested_sofabed       INTEGER NOT NULL CHECK (requested_sofabed IN (0, 1)),
  calculated_at           TEXT NOT NULL
);

CREATE TABLE linen_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  event_id    TEXT,
  old_values  TEXT,
  new_values  TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_linen_history_task ON linen_history (task_id, id);

CREATE TABLE processed_events (
  event_id     TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  processed_at TEXT NOT NULL
);
`;
