# Automatic Linen Calculation

Backend service that receives reservation events and keeps the linen (sheets, towels, bathmats, handtowels, dishtowels, sofa beds) of open Main Cleaning tasks up to date. A React + TypeScript front end will show tasks, linen, and recalculation history.

Status: Stage 6 (event processing). The schema, seed, calculation engine, reservation selection, and transactional event processing are implemented. The HTTP API and UI are not implemented yet, and tests are not written yet.

## Requirements

- Node.js 24 or newer
- npm

## Setup

```bash
npm install
```

## Database initialization and seeding

```bash
npm run seed
```

The seed deletes the database file (`db/linen.sqlite`, override with `DB_PATH`), creates the schema, and imports listings, reservations, and tasks from `data/`. Re-running it is the reset procedure, so it never duplicates records. Listing capacities are parsed from `linen_attribute`; the seed fails if an attribute is malformed.

The seed then:
1. Calculates baseline linen for every Main Cleaning task, including Completed and Cancelled ones. Baseline calculations are not written to history.
2. Replays `events.json` in file order, one transaction per event. The duplicate `E-duplicate` is detected through `processed_events` and has no effect.

Baseline `calculated_at` timestamps come from the wall clock, so they differ between runs. Linen values and history contents are deterministic. Event-driven rows use the event's `created_at`.

Each event is applied in a single transaction:
- The event is recorded in `processed_events`. A repeated `event_id` is a no-op.
- Reservation fields are updated. Unknown fields or invalid values reject the event and roll back everything.
- If the event triggers recalculation, the open Main Cleaning tasks of the changed reservation and of its previous reservations are recalculated. A listing change also moves the reservation's open tasks to the new apartment.
- A history row is written only when a task's linen values actually change.

## Testing and type checking

```bash
npm run typecheck
npm test
```

## Input data

`data/` holds the four source files and the task specification (`TMS-Linen-Test-Task.pdf`). The source files are read-only and never modified.

## Design decisions

- `tasks.reservation_id` has no foreign key. The source data contains a task (`T-missing-reservation`) that points to a reservation that does not exist, and the spec requires that such a task is stored and simply has no linen record.
- Listing and reservation references are enforced by foreign keys.

## Documentation to be completed

Linen calculation rules and their interpretation, the event processing model, the API reference, the frontend run instructions, and documented limitations will be added as each stage is implemented.
