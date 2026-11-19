import type { ReservationSnapshot } from "../../utils/reservations/types.js";
import type { ReservationField, ReservationInput } from "../../input/types.js";
import type { Db, OpenTaskRow, ReservationRow } from "../types.js";

function toSnapshot(row: ReservationRow): ReservationSnapshot {
  return {
    reservationId: row.reservation_id,
    listingId: row.listing_id,
    status: row.status,
    arrivalMs: Date.parse(row.planned_arrival_time),
    guestsCount: row.guests_count,
    infants: row.infants,
    numberOfGuestsOverride: row.number_of_guests_override,
    requestedSofabed: row.requested_sofabed === 1,
  };
}

export function loadAllReservations(db: Db): ReservationSnapshot[] {
  const rows = db
    .prepare<[], ReservationRow>(
      `SELECT reservation_id, listing_id, status, planned_arrival_time, guests_count, infants,
              number_of_guests_override, requested_sofabed
       FROM reservations`,
    )
    .all();
  return rows.map(toSnapshot);
}

export function loadReservation(db: Db, reservationId: string): ReservationSnapshot | null {
  const row = db
    .prepare<[string], ReservationRow>(
      `SELECT reservation_id, listing_id, status, planned_arrival_time, guests_count, infants,
              number_of_guests_override, requested_sofabed
       FROM reservations WHERE reservation_id = ?`,
    )
    .get(reservationId);
  return row ? toSnapshot(row) : null;
}

export function insertReservation(db: Db, reservation: ReservationInput): void {
  db.prepare(
    `INSERT INTO reservations (
       reservation_id, listing_id, status, planned_arrival_time, planned_departure_time,
       guests_count, infants, number_of_guests_override, requested_sofabed
     ) VALUES (
       @reservation_id, @listing_id, @status, @planned_arrival_time, @planned_departure_time,
       @guests_count, @infants, @number_of_guests_override, @requested_sofabed
     )`,
  ).run({
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

export function setReservationField(
  db: Db,
  reservationId: string,
  field: ReservationField,
  value: string | number | null,
): void {
  db.prepare(`UPDATE reservations SET ${field} = ? WHERE reservation_id = ?`).run(value, reservationId);
}

export function findOpenMainCleaningTasksForReservations(db: Db, reservationIds: readonly string[]): OpenTaskRow[] {
  if (reservationIds.length === 0) return [];
  const placeholders = reservationIds.map(() => "?").join(", ");
  return db
    .prepare<string[], OpenTaskRow>(
      `SELECT task_id, listing_id, reservation_id, planned_start
       FROM tasks
       WHERE task_type = 'Main Cleaning'
         AND status NOT IN ('Completed', 'Cancelled')
         AND reservation_id IN (${placeholders})
       ORDER BY task_id`,
    )
    .all(...reservationIds);
}
