# Backend

Node.js + TypeScript service. It loads the source data into SQLite, processes reservation events, keeps the linen of open Main Cleaning tasks up to date, and serves a JSON API for the frontend.

All commands below run from the `backend/` folder.

## Requirements

- Node.js 24 or newer
- npm

## Setup

```bash
npm install
```

## Database and seeding

```bash
npm run seed
```

The seed:
1. Deletes `db/linen.sqlite` (override the location with `DB_PATH`).
2. Creates the schema and imports listings, reservations, and tasks from `data/`. Listing capacities are parsed from `linen_attribute`, and the seed fails if an attribute is malformed.
3. Calculates baseline linen for every Main Cleaning task, including Completed and Cancelled ones. Baseline values are not written to history.
4. Replays `events.json` in file order, one transaction per event. The duplicate `E-duplicate` is detected through `processed_events` and has no effect.

Re-running the seed is the reset procedure, so it never duplicates records. Baseline `calculated_at` timestamps come from the wall clock and differ between runs. Linen values and history are deterministic, and event-driven rows use the event's `created_at`.

## Running the API

```bash
npm start              # http://127.0.0.1:3000 (override with PORT)
```

The server reads the database from `db/linen.sqlite`, so run `npm run seed` first.

## Tests and type checking

```bash
npm run typecheck
npm test
```

Tests use an in-memory SQLite database seeded from `data/`, so they never touch `db/`.

| Folder | What it covers |
|---|---|
| `tests/unit/linen` | Every example row of the spec, sofa bed rules, apartment rules, capacity parsing |
| `tests/unit/reservations` | 72-hour boundary, next and previous guest selection, recalculation triggers |
| `tests/scenarios` | The ten required scenarios, run through the HTTP API |
| `tests/integration` | API validation, error codes, task create and update rules, transaction rollback |

## Folder structure

| Folder | Purpose |
|---|---|
| `src/api/` | Fastify app, routes, server entry point, request schemas |
| `src/services/` | Use cases: process a reservation event, create or update a task, recalculate linen for a task |
| `src/utils/calculation/` | Pure linen rules: quantities, bathrooms and dishtowels, capacity parsing |
| `src/utils/reservations/` | Pure reservation rules: next and previous guests, which events trigger recalculation |
| `src/db/` | Connection, schema, and database row types |
| `src/db/queries/` | SQL queries grouped by entity: `tasks`, `linen`, `reservations`, `events`, and `views` (read models for the API) |
| `src/input/` | Loading and validating the source JSON files |
| `src/seed/` | Seed script and the steps it runs |
| `data/` | Source files and the task specification (read-only) |
| `tests/` | Automated tests, described above |

Business rules live in `src/utils/` and are free of database and HTTP code, so they can be tested without setup. Database access lives in `src/db/queries/` only.

## Linen calculation

**Next guest.** Among reservations on the same apartment that arrive after the task's reservation (skipping Canceled and NoShow), the earliest one is used if it arrives at or after `planned_start` and less than 72 hours later. Otherwise the default calculation applies.

**Default.** Sheets = beds, towels = bed spots, no sofa bed opened.

**Sofa beds and towels** follow the spec's four cases. When a sofa bed is requested and guests exceed the beds:
- Opened sofa beds = `min(guests − beds, sofa beds)`.
- If all sofa beds open: sheets = beds + sofa beds, towels = bed spots + sofa spots.
- If only some open: sheets = guests, towels = bed spots + opened sofa beds.
- Exception (1 bed, 1 sofa bed, 2 guests, sofa requested): 2 sheets, 2 towels, 1 sofa bed.

When guests exceed bed spots, all sofa beds open even if not requested. Towels = `max(guests, bed spots + min(sofa spots, sofa beds))`.

**Other items.** Handtowels = towels + bathrooms, or 0 with no bathroom. Bathrooms: `SS` → 0, `2BA` → 2, otherwise 1. Dishtowels: 1 for names containing `BR` or `ST`.

**Guests.** Effective guests = `max(guests_count, number_of_guests_override)`. Infants are already included in `guests_count`.

## Event processing

Each event is applied in one transaction:
- The event is recorded in `processed_events`. A repeated `event_id` returns `200 duplicate` and changes nothing.
- Reservation fields are updated. Unknown fields or invalid values reject the event (422) and roll back everything, including the `processed_events` record.
- Recalculation runs for the changed reservation's open Main Cleaning tasks and for the previous reservation on both the old and new apartment.
- A listing change moves the reservation's open tasks to the new apartment.
- A history row is written only when a task's linen values actually change.

Recalculation triggers: creation, check-in or check-out (`status` becomes `InHouse` or `CheckedOut`), `guests_count`, `infants`, `planned_arrival_time`, `listing_id`, `number_of_guests_override`, `requested_sofabed`. Changes to `planned_departure_time` do not trigger recalculation.

## API

| Method | Path | Description |
|---|---|---|
| POST | `/events/reservation` | Process a reservation event. 201 when processed, 200 when duplicate. |
| GET | `/tasks` | List tasks with apartment name and linen summary. |
| POST | `/tasks` | Create a task. Linen is calculated for Main Cleaning tasks. 201. |
| GET | `/tasks/:id` | Task details: task, apartment, reservation, and linen (or `null`). |
| PATCH | `/tasks/:id` | Update fields. Recalculates when `task_type`, `listing_id`, `reservation_id`, or `planned_start` changes on an open task. |
| GET | `/tasks/:id/linen/history` | Recalculation history: reason, event ID, old and new values, timestamp. |

Errors use the shape `{ "error": { "code", "message", "details?" } }`:

| Status | Code | Meaning |
|---|---|---|
| 400 | `validation_error` | Request body is invalid |
| 404 | `not_found` | Task does not exist |
| 409 | `conflict` | Task ID already exists |
| 422 | `event_rejected` | Event cannot be applied (unknown field, invalid value, unknown reservation) |
| 422 | `reference_not_found` | A referenced listing or reservation does not exist |

Closed tasks (Completed or Cancelled) never recalculate, and a PATCH to a closed task keeps its linen values.

## Design decisions

- `tasks.reservation_id` has no foreign key, because the source data contains a task (`T-missing-reservation`) that points to a missing reservation. Such tasks are stored and have no linen record.
- Listing and reservation references are enforced by foreign keys.
- Status changes to Canceled or NoShow trigger recalculation of the previous cleaning, because a cancellation changes which reservation is the next guest. The spec's trigger list does not mention this.
- Tasks created or changed through the API get a history entry (`task.created` or `task.updated (...)`).
- Status-only task changes do not recalculate. Reopening a closed task does not recalculate by itself, so its values may be stale until a relevant field changes.
- Unknown event fields are rejected rather than ignored.

## Limitations

- The API has no authentication, and the server listens on 127.0.0.1 only.
- Tasks cannot be deleted through the API.
- Event `old` values are not checked against the current state.
- Event timestamps are used as given. The seed replays events in file order, and the API processes them in arrival order.
- The frontend's "Total guests" shows `prepared_for_guests`, which is the towel count, following the spec's field definition.
- Baseline `calculated_at` values are wall-clock timestamps, so they are not reproducible between runs.
