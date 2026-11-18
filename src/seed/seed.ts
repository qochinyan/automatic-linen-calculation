import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseLinenAttribute } from "../domain/linen/parseLinenAttribute.js";
import { createSchema, openDatabase } from "../infrastructure/db/connection.js";
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
const insertReservation = db.prepare(`
  INSERT INTO reservations (
    reservation_id, listing_id, status, planned_arrival_time, planned_departure_time,
    guests_count, infants, number_of_guests_override, requested_sofabed
  ) VALUES (
    @reservation_id, @listing_id, @status, @planned_arrival_time, @planned_departure_time,
    @guests_count, @infants, @number_of_guests_override, @requested_sofabed
  )
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
  for (const reservation of source.reservations) {
    insertReservation.run({
      reservation_id: reservation.reservation_id,
      listing_id: reservation.listing_id,
      status: reservation.status,
      planned_arrival_time: reservation.planned_arrival_time,
      planned_departure_time: reservation.planned_departure_time,
      guests_count: reservation.guests_count,
      infants: reservation.infants,
      number_of_guests_override: reservation.customFields.number_of_guests_override,
      requested_sofabed: reservation.customFields.requested_sofabed ? 1 : 0,
    });
  }
  for (const task of source.tasks) insertTask.run(task);
})();

db.close();

console.log(
  `Seeded ${dbPath}: ${source.listings.length} listings, ${source.reservations.length} reservations, ` +
    `${source.tasks.length} tasks. ${source.events.length} events validated, not yet applied (Stage 6).`,
);
