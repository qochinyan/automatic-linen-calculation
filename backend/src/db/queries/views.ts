import type {
  ApartmentRow,
  Db,
  LinenHistoryRow,
  LinenViewRow,
  ReservationViewRow,
  TaskListRow,
} from "../types.js";

export function listTaskRows(db: Db): TaskListRow[] {
  return db
    .prepare<[], TaskListRow>(
      `SELECT t.task_id, t.task_type, t.status, t.listing_id, l.name AS apartment_name,
              t.reservation_id, t.planned_start, lr.sheets, lr.towels
       FROM tasks t
       LEFT JOIN listings l ON l.listing_id = t.listing_id
       LEFT JOIN linen_records lr ON lr.task_id = t.task_id
       ORDER BY t.planned_start, t.task_id`,
    )
    .all();
}

export function loadApartmentRow(db: Db, listingId: string): ApartmentRow | null {
  return (
    db.prepare<[string], ApartmentRow>(`SELECT listing_id, name FROM listings WHERE listing_id = ?`).get(listingId) ??
    null
  );
}

export function loadReservationViewRow(db: Db, reservationId: string): ReservationViewRow | null {
  return (
    db
      .prepare<[string], ReservationViewRow>(
        `SELECT reservation_id, listing_id, status, planned_arrival_time, planned_departure_time,
                guests_count, infants, number_of_guests_override, requested_sofabed
         FROM reservations WHERE reservation_id = ?`,
      )
      .get(reservationId) ?? null
  );
}

export function loadLinenViewRow(db: Db, taskId: string): LinenViewRow | null {
  return (
    db
      .prepare<[string], LinenViewRow>(
        `SELECT prepared_for_guests, sheets, towels, bathmats, handtowels, dishtowels,
                requested_sofabeds_count, source_reservation_id, actual_guests, infants,
                number_of_guests_override, requested_sofabed, calculated_at
         FROM linen_records WHERE task_id = ?`,
      )
      .get(taskId) ?? null
  );
}

export function listLinenHistoryRows(db: Db, taskId: string): LinenHistoryRow[] {
  return db
    .prepare<[string], LinenHistoryRow>(
      `SELECT id, reason, event_id, old_values, new_values, created_at
       FROM linen_history WHERE task_id = ? ORDER BY id`,
    )
    .all(taskId);
}
