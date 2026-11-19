# Automatic Linen Calculation

A backend service that receives reservation events and keeps the linen (sheets, towels, bathmats, handtowels, dishtowels, sofa beds) of open Main Cleaning tasks up to date. A React + TypeScript interface shows tasks, linen, and recalculation history.

## Requirements

- Node.js 24 or newer
- npm

## Setup

```bash
npm install
cd web && npm install && cd ..
```

## Database initialization and seeding

```bash
npm run seed
```

The seed deletes `db/linen.sqlite` (override with `DB_PATH`), creates the schema, and imports listings, reservations, and tasks from `data/`. Re-running it is the reset procedure, so it never duplicates records. Listing capacities are parsed from `linen_attribute`; the seed fails if an attribute is malformed.

The seed then:
1. Calculates baseline linen for every Main Cleaning task, including Completed and Cancelled ones. Baseline calculations are not written to history.
2. Replays `events.json` in file order, one transaction per event. The duplicate `E-duplicate` is detected through `processed_events` and has no effect.

Baseline `calculated_at` timestamps come from the wall clock, so they differ between runs. Linen values and history contents are deterministic. Event-driven rows use the event's `created_at`.

## Running the API and the interface

```bash
npm start          # API on http://127.0.0.1:3000 (override with PORT)
cd web && npm run dev   # UI on http://localhost:5173, proxies /api to the API
```

Open http://localhost:5173/tasks for the task list. Each task links to a detail page with task, reservation, linen, and history sections.

## Testing and type checking

```bash
npm run typecheck      # backend
npm test               # backend unit, integration, and scenario tests
cd web && npm run typecheck && npm run build
```

Tests run against an in-memory SQLite database seeded from `data/`. Nothing is written to `db/`.

- `tests/unit`: calculation table (every example row of the spec), sofa bed rules, the 72-hour boundary, previous/next reservation selection, and recalculation triggers.
- `tests/scenarios`: the ten required scenarios, run through the HTTP API.
- `tests/integration`: API validation, error codes, task create/update rules, and transaction rollback.

## Linen calculation

Next guest selection: among reservations on the same apartment that arrive after the task's reservation (skipping Canceled and NoShow), the earliest is used if it arrives at or after `planned_start` and strictly less than 72 hours later. Otherwise the default calculation applies.

Default calculation: sheets = beds, towels = bed spots, no sofa bed opened.

Sofa beds and towels follow the spec's four cases. When a sofa bed is requested and guests exceed the beds:
- Opened sofa beds = `min(guests − beds, sofa beds)`.
- If all sofa beds open, sheets = beds + sofa beds and towels = bed spots + sofa spots.
- If only some open, sheets = guests and towels = bed spots + opened sofa beds.
- The exception (1 bed, 1 sofa bed, 2 guests, sofa requested) gives 2 sheets, 2 towels, 1 sofa bed.

When guests exceed bed spots, all sofa beds open even if not requested. Towels = max(guests, bed spots + min(sofa spots, sofa beds)).

Handtowels = towels + bathrooms, or 0 with no bathroom. Bathrooms: `SS` 0, `2BA` 2, otherwise 1. Dishtowels: 1 for names containing `BR` or `ST`.

Effective guests = max(`guests_count`, `number_of_guests_override`). Infants are already included in `guests_count`.

## Event processing

Each event is applied in a single transaction:
- The event is recorded in `processed_events`. A repeated `event_id` returns `200 duplicate` and changes nothing.
- Reservation fields are updated. Unknown fields or invalid values reject the event (422) and roll back everything, including the `processed_events` record.
- Recalculation runs for the changed reservation's open Main Cleaning tasks and for the previous reservation on the old and new apartments.
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

Errors use the shape `{ "error": { "code", "message", "details?" } }`. Codes: `validation_error` (400), `not_found` (404), `conflict` (409), `event_rejected` and `reference_not_found` (422).

Closed tasks (Completed or Cancelled) never recalculate. A PATCH to a closed task keeps its linen values.

## Design decisions

- `tasks.reservation_id` has no foreign key, because the source data contains a task (`T-missing-reservation`) that points to a missing reservation. Such tasks are stored and have no linen record.
- Listing and reservation references are enforced by foreign keys.
- Status changes to Canceled or NoShow trigger recalculation of the previous cleaning, since the cancellation changes which reservation is the next guest. The spec's trigger list does not mention this.
- A task created or changed through the API is recalculated with a history entry (reason `task.created` or `task.updated (...)`).
- Status-only task changes do not recalculate. Reopening a closed task does not recalculate by itself, so its values may be stale until a relevant field changes.
- Unknown event fields are rejected rather than ignored.

## Limitations

- The API has no authentication, and the server listens on 127.0.0.1 only.
- Tasks are not deleted through the API.
- Event `old` values are not checked against the current state.
- Event timestamps are used as given. Event order is file order for the seed and arrival order for the API.
- `Total guests` in the interface shows `prepared_for_guests`, which is the towel count, following the spec's field definition.
- The interface has been type-checked and built but not visually reviewed in a browser.
- Baseline `calculated_at` values are wall-clock timestamps and are not reproducible between runs.

## Input data

`data/` holds the four source files and the task specification (`TMS-Linen-Test-Task.pdf`). The source files are read-only and never modified.
