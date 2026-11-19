import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createSchema, openDatabase } from "../infrastructure/db/connection.js";
import { loadSourceData } from "../infrastructure/input/loadSourceData.js";
import { replayEvents, seedInitialState } from "./buildDatabase.js";

const dataDir = resolve(process.env.DATA_DIR ?? "data");
const dbPath = resolve(process.env.DB_PATH ?? "db/linen.sqlite");

for (const suffix of ["", "-wal", "-shm"]) {
  const path = `${dbPath}${suffix}`;
  if (existsSync(path)) rmSync(path);
}
mkdirSync(dirname(dbPath), { recursive: true });

const source = loadSourceData(dataDir);
const db = openDatabase(dbPath);
createSchema(db);
seedInitialState(db, source);
const summary = replayEvents(db, source.events);
db.close();

console.log(
  `Seeded ${dbPath}: ${source.listings.length} listings, ${source.reservations.length} reservations, ` +
    `${source.tasks.length} tasks. Events: ${summary.processed} processed, ${summary.duplicates} duplicate, ` +
    `${summary.recalculations} task recalculations.`,
);
