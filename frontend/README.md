# Frontend

React + TypeScript web app built with Vite and Tailwind CSS. It shows cleaning tasks, the linen to prepare for each one, and the history of how that linen was calculated.

All commands below run from the `frontend/` folder.

## Requirements

- Node.js 24 or newer
- npm
- The backend API running (see [../backend/README.md](../backend/README.md))

## Running

```bash
npm install
npm run dev            # http://localhost:5173
```

Open http://localhost:5173/tasks. The dev server forwards `/api/*` to the backend at `http://127.0.0.1:3000`. To use a different backend address, set `API_URL` before starting the dev server.

## Building and type checking

```bash
npm run typecheck     # TypeScript, no emit
npm run build         # type check, then production build into dist/
npm run preview       # serve the production build locally
```

## Pages

- **Tasks** (`/tasks`): summary cards (all, open, completed, with linen), search by task, apartment, or reservation, a status filter, and a table of tasks with linen counts.
- **Task detail** (`/tasks/:id`): task header and status, reservation and schedule details, the linen to prepare (shown only when a linen record exists), and the change history with the values that changed.

## Folder structure

| Folder | Purpose |
|---|---|
| `src/pages/` | Page components: task list and task detail |
| `src/components/` | Shared UI pieces: status badge, cards, stat tiles, messages, loading placeholders |
| `src/api/` | HTTP client functions that call the backend |
| `src/types/` | Types for API responses (`api.ts`) and page state (`view.ts`) |
| `src/utils/` | Formatting helpers for dates, yes/no values, and empty values |
| `src/main.tsx` | App entry point: routes and layout |
| `src/styles.css` | Tailwind entry point |

Types are kept in `src/types/` and functions in the other folders, so the UI code and the data shapes can be read separately.
