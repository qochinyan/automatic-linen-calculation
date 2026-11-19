import { applyTaskLinen } from "../application/linenCalculation.js";
import { processReservationEvent } from "../application/processReservationEvent.js";
import { parseLinenAttribute } from "../domain/linen/parseLinenAttribute.js";
import type { Db } from "../infrastructure/db/connection.js";
import { insertReservation, loadAllReservations } from "../infrastructure/db/reservationRepository.js";
import { insertTask, loadMainCleaningTaskIds } from "../infrastructure/db/taskRepository.js";
import type { SourceData } from "../infrastructure/input/loadSourceData.js";
import type { EventInput } from "../infrastructure/input/schemas.js";

export interface ReplaySummary {
  processed: number;
  duplicates: number;
  recalculations: number;
}

export function seedInitialState(db: Db, source: SourceData, baselineTimestamp = new Date().toISOString()): void {
  db.transaction(() => {
    const insertListing = db.prepare(`
      INSERT INTO listings (listing_id, name, linen_attribute, beds, bed_spots, sofa_beds, sofa_spots)
      VALUES (@listing_id, @name, @linen_attribute, @beds, @bedSpots, @sofaBeds, @sofaSpots)
    `);
    for (const listing of source.listings) {
      insertListing.run({
        listing_id: listing.listing_id,
        name: listing.name,
        linen_attribute: listing.linen_attribute,
        ...parseLinenAttribute(listing.linen_attribute),
      });
    }
    for (const reservation of source.reservations) insertReservation(db, reservation);
    for (const task of source.tasks) insertTask(db, task);
  })();

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
}

export function replayEvents(db: Db, events: readonly EventInput[]): ReplaySummary {
  const summary: ReplaySummary = { processed: 0, duplicates: 0, recalculations: 0 };
  for (const event of events) {
    const outcome = processReservationEvent(db, event);
    if (outcome.status === "duplicate") {
      summary.duplicates += 1;
    } else {
      summary.processed += 1;
      summary.recalculations += outcome.recalculatedTaskIds.length;
    }
  }
  return summary;
}
