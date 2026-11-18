# Automatic Linen Calculation

Backend service that receives reservation events and keeps the linen (sheets, towels, bathmats, handtowels, dishtowels, sofa beds) of open Main Cleaning tasks up to date. A React + TypeScript front end will show tasks, linen, and recalculation history.

Status: Stage 3 (project foundation). The database schema and seed are implemented. The calculation engine, event processing, API, and UI are not implemented yet.

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

Events are validated but not applied yet. Event processing, baseline linen calculation, and the history log arrive in later stages.

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
