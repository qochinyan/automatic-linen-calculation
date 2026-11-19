import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { applyTaskLinen } from "../application/linenCalculation.js";
import { processReservationEvent } from "../application/processReservationEvent.js";
import { parseLinenAttribute } from "../domain/linen/parseLinenAttribute.js";
import { createSchema, openDatabase } from "../infrastructure/db/connection.js";
import { insertReservation, loadAllReservations } from "../infrastructure/db/reservationRepository.js";
import { loadMainCleaningTaskIds } from "../infrastructure/db/taskRepository.js";
import { loadSourceData } from "../infrastructure/input/loadSourceData.js";

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

const insertListing = db.prepare(`
  INSERT INTO listings (listing_id, name, linen_attribute, beds, bed_spots, sofa_beds, sofa_spots)
  VALUES (@listing_id, @name, @linen_attribute, @beds, @bedSpots, @sofaBeds, @sofaSpots)
`);
const insertTask = db.prepare(`
  INSERT INTO tasks (task_id, task_type, status, listing_id, reservation_id, planned_start)
  VALUES (@task_id, @task_type, @status, @listing_id, @reservation_id, @planned_start)
`);

db.transaction(() => {
  for (const listing of source.listings) {
    insertListing.run({
      listing_id: listing.listing_id,
      name: listing.name,
      linen_attribute: listing.linen_attribute,
      ...parseLinenAttribute(listing.linen_attribute),
    });
  }
  for (const reservation of source.reservations) insertReservation(db, reservation);
  for (const task of source.tasks) insertTask.run(task);
})();

const baselineTimestamp = new Date().toISOString();
db.transaction(() => {
  const reservations = loadAllReservations(db);
  for (const taskId of loadMainCleaningTaskIds(db)) {
    applyTaskLinen(db, taskId, {
      reservations,
      timestamp: baselineTimestamp,
      reason: "baseline",
      eventId: null,
      recordHistory: false,
    });
  }
})();

let processed = 0;
let duplicates = 0;
let recalculations = 0;
for (const event of source.events) {
  const outcome = processReservationEvent(db, event);
  if (outcome.status === "duplicate") {
    duplicates += 1;
  } else {
    processed += 1;
    recalculations += outcome.recalculatedTaskIds.length;
  }
}

db.close();

console.log(
  `Seeded ${dbPath}: ${source.listings.length} listings, ${source.reservations.length} reservations, ` +
    `${source.tasks.length} tasks. Events: ${processed} processed, ${duplicates} duplicate, ` +
    `${recalculations} task recalculations.`,
);
