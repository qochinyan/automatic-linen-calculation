import { findPreviousReservation } from "./selection.js";
import type { ReservationSnapshot, ReservationStatus } from "./types.js";

export interface FieldChange {
  field: string;
  old: unknown;
  new: unknown;
}

const RECALCULATION_FIELDS: ReadonlySet<string> = new Set([
  "guests_count",
  "infants",
  "planned_arrival_time",
  "listing_id",
  "number_of_guests_override",
  "requested_sofabed",
]);

const RECALCULATION_STATUSES: ReadonlySet<unknown> = new Set<ReservationStatus>([
  "InHouse",
  "CheckedOut",
  "Canceled",
  "NoShow",
]);

export function requiresRecalculation(eventType: string, changes: readonly FieldChange[]): boolean {
  if (eventType === "Reservation.Created") return true;

  return changes.some(
    (change) =>
      RECALCULATION_FIELDS.has(change.field) ||
      (change.field === "status" && RECALCULATION_STATUSES.has(change.new)),
  );
}

export function affectedReservationIds(
  before: ReservationSnapshot | null,
  after: ReservationSnapshot,
  reservationsBeforeEvent: readonly ReservationSnapshot[],
): string[] {
  const others = reservationsBeforeEvent.filter((r) => r.reservationId !== after.reservationId);

  const previousBefore = before ? findPreviousReservation(before, others) : null;
  const previousAfter = findPreviousReservation(after, others);

  const ids = [after.reservationId, previousBefore?.reservationId, previousAfter?.reservationId];
  return [...new Set(ids.filter((id): id is string => id !== undefined))];
}
