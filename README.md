# Automatic Linen Calculation

A small system for housekeeping teams in short-term rentals. It works out how much linen (sheets, towels, bathmats, handtowels, dishtowels, sofa beds) each Main Cleaning task needs, based on the next guests, and keeps those numbers up to date as reservations change.

The project has two parts:

| Part | Folder | What it does | Guide |
|---|---|---|---|
| Backend | [`backend/`](backend/) | Imports the source data, processes reservation events, calculates linen, and serves the HTTP API | [backend/README.md](backend/README.md) |
| Frontend | [`frontend/`](frontend/) | React web app: task list, task details, linen, and change history | [frontend/README.md](frontend/README.md) |

## Folder layout

```
automatic-linen-calculation/
├── backend/                 Node.js + TypeScript API and database
│   ├── data/                Source JSON files and the task specification (read-only)
│   ├── src/
│   │   ├── api/             HTTP routes, server, request validation
│   │   ├── services/        Use cases: process events, create/update tasks, recalculate linen
│   │   ├── utils/           Pure business rules
│   │   │   ├── calculation/     Linen quantities, apartment rules, capacity parsing
│   │   │   └── reservations/    Next/previous guest selection, recalculation triggers
│   │   ├── db/              Database connection, schema, and types
│   │   │   └── queries/         SQL queries grouped by entity (tasks, linen, reservations, events, read views)
│   │   ├── input/           Loading and validating the source JSON files
│   │   └── seed/            Seed script: rebuild the database from data/
│   └── tests/               Unit, scenario, and integration tests
├── frontend/                React + TypeScript + Tailwind web app
│   └── src/
│       ├── api/             HTTP client for the backend
│       ├── components/      Shared UI building blocks
│       ├── pages/           Task list and task detail pages
│       ├── types/           Types for API responses and page state
│       └── utils/           Formatting helpers
├── .gitignore
└── README.md
```

## Quick start

Requirements: Node.js 24 or newer, npm.

```bash
# 1. Backend: install, build the database, start the API
cd backend
npm install
npm run seed          # creates db/linen.sqlite from data/
npm start             # API on http://127.0.0.1:3000

# 2. Frontend (in a second terminal): install and start the UI
cd frontend
npm install
npm run dev           # UI on http://localhost:5173
```

Then open http://localhost:5173/tasks.

## Checks

```bash
cd backend && npm run typecheck && npm test     # type check and 80 automated tests
cd frontend && npm run typecheck && npm run build
```

## Documentation

- [backend/README.md](backend/README.md): linen rules, event processing, API reference, testing, design decisions, limitations.
- [frontend/README.md](frontend/README.md): running the UI, folder structure, how it talks to the API.
