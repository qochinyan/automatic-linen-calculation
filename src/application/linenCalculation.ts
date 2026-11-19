import { calculateDefaultLinen, calculateLinen, effectiveGuests } from "../domain/linen/calculateLinen.js";
import type { LinenQuantities } from "../domain/linen/types.js";
import { findPreparationReservation } from "../domain/reservations/selection.js";
import type { ReservationSnapshot } from "../domain/reservations/types.js";
import {
  deleteLinenRecord,
  insertLinenHistory,
  loadLinenRecord,
  loadListingLinenConfig,
  upsertLinenRecord,
} from "../infrastructure/db/linenRepository.js";
import { loadTask } from "../infrastructure/db/taskRepository.js";
import type { Db, LinenRecordValues, StoredLinenRecord } from "../infrastructure/db/types.js";
import type { LinenRecalculationContext } from "./types.js";

export function applyTaskLinen(db: Db, taskId: string, context: LinenRecalculationContext): void {
  const next = computeLinenValues(db, taskId, context.reservations);
  const existing = loadLinenRecord(db, taskId);
  const previous = existing ? toLinenRecordValues(existing) : null;

  if (!next) {
    if (existing) {
      deleteLinenRecord(db, taskId);
      if (context.recordHistory) writeHistory(db, taskId, context, previous, null);
    }
    return;
  }

  if (previous && linenKey(previous) === linenKey(next)) return;

  upsertLinenRecord(db, taskId, next, context.timestamp);
  if (context.recordHistory) writeHistory(db, taskId, context, previous, next);
}

function computeLinenValues(
  db: Db,
  taskId: string,
  reservations: readonly ReservationSnapshot[],
): LinenRecordValues | null {
  const task = loadTask(db, taskId);
  if (!task || task.task_type !== "Main Cleaning" || !task.listing_id || !task.reservation_id) return null;

  const reservation = reservations.find((r) => r.reservationId === task.reservation_id);
  if (!reservation) return null;

  const listing = loadListingLinenConfig(db, task.listing_id);
  if (!listing) return null;

  const next = findPreparationReservation(Date.parse(task.planned_start), reservation, reservations);
  const source = next ?? reservation;
  const quantities: LinenQuantities = next
    ? calculateLinen({
        apartmentName: listing.name,
        capacity: listing.capacity,
        guests: effectiveGuests(next.guestsCount, next.numberOfGuestsOverride),
        requestedSofabed: next.requestedSofabed,
      })
    : calculateDefaultLinen(listing.name, listing.capacity);

  return {
    sheets: quantities.sheets,
    towels: quantities.towels,
    bathmats: quantities.bathmats,
    handtowels: quantities.handtowels,
    dishtowels: quantities.dishtowels,
    requestedSofabedsCount: quantities.requestedSofabedsCount,
    sourceReservationId: source.reservationId,
    actualGuests: source.guestsCount,
    infants: source.infants,
    numberOfGuestsOverride: source.numberOfGuestsOverride,
    requestedSofabed: source.requestedSofabed,
  };
}

function toLinenRecordValues(row: StoredLinenRecord): LinenRecordValues {
  return {
    sheets: row.sheets,
    towels: row.towels,
    bathmats: row.bathmats,
    handtowels: row.handtowels,
    dishtowels: row.dishtowels,
    requestedSofabedsCount: row.requested_sofabeds_count,
    sourceReservationId: row.source_reservation_id,
    actualGuests: row.actual_guests,
    infants: row.infants,
    numberOfGuestsOverride: row.number_of_guests_override,
    requestedSofabed: row.requested_sofabed === 1,
  };
}

function linenKey(values: LinenRecordValues): string {
  return JSON.stringify([
    values.sheets,
    values.towels,
    values.bathmats,
    values.handtowels,
    values.dishtowels,
    values.requestedSofabedsCount,
    values.sourceReservationId,
    values.actualGuests,
    values.infants,
    values.numberOfGuestsOverride,
    values.requestedSofabed,
  ]);
}

function writeHistory(
  db: Db,
  taskId: string,
  context: LinenRecalculationContext,
  previous: LinenRecordValues | null,
  next: LinenRecordValues | null,
): void {
  insertLinenHistory(db, {
    taskId,
    reason: context.reason,
    eventId: context.eventId,
    oldValues: previous,
    newValues: next,
    createdAt: context.timestamp,
  });
}
