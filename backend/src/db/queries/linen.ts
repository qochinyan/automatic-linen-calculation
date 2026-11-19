import type { Db, LinenHistoryEntry, LinenRecordValues, ListingLinenConfig, ListingRow, StoredLinenRecord } from "../types.js";

export function loadListingLinenConfig(db: Db, listingId: string): ListingLinenConfig | null {
  const row = db
    .prepare<[string], ListingRow>(`SELECT name, beds, bed_spots, sofa_beds, sofa_spots FROM listings WHERE listing_id = ?`)
    .get(listingId);
  if (!row) return null;
  return {
    name: row.name,
    capacity: { beds: row.beds, bedSpots: row.bed_spots, sofaBeds: row.sofa_beds, sofaSpots: row.sofa_spots },
  };
}

export function loadLinenRecord(db: Db, taskId: string): StoredLinenRecord | null {
  return (
    db
      .prepare<[string], StoredLinenRecord>(
        `SELECT sheets, towels, bathmats, handtowels, dishtowels, requested_sofabeds_count,
                source_reservation_id, actual_guests, infants, number_of_guests_override, requested_sofabed
         FROM linen_records WHERE task_id = ?`,
      )
      .get(taskId) ?? null
  );
}

export function upsertLinenRecord(db: Db, taskId: string, values: LinenRecordValues, calculatedAt: string): void {
  db.prepare(
    `INSERT INTO linen_records (
       task_id, prepared_for_guests, sheets, towels, bathmats, handtowels, dishtowels,
       requested_sofabeds_count, source_reservation_id, actual_guests, infants,
       number_of_guests_override, requested_sofabed, calculated_at
     ) VALUES (
       @taskId, @towels, @sheets, @towels, @bathmats, @handtowels, @dishtowels,
       @requestedSofabedsCount, @sourceReservationId, @actualGuests, @infants,
       @numberOfGuestsOverride, @requestedSofabed, @calculatedAt
     )
     ON CONFLICT (task_id) DO UPDATE SET
       prepared_for_guests = excluded.prepared_for_guests,
       sheets = excluded.sheets,
       towels = excluded.towels,
       bathmats = excluded.bathmats,
       handtowels = excluded.handtowels,
       dishtowels = excluded.dishtowels,
       requested_sofabeds_count = excluded.requested_sofabeds_count,
       source_reservation_id = excluded.source_reservation_id,
       actual_guests = excluded.actual_guests,
       infants = excluded.infants,
       number_of_guests_override = excluded.number_of_guests_override,
       requested_sofabed = excluded.requested_sofabed,
       calculated_at = excluded.calculated_at`,
  ).run({
    taskId,
    sheets: values.sheets,
    towels: values.towels,
    bathmats: values.bathmats,
    handtowels: values.handtowels,
    dishtowels: values.dishtowels,
    requestedSofabedsCount: values.requestedSofabedsCount,
    sourceReservationId: values.sourceReservationId,
    actualGuests: values.actualGuests,
    infants: values.infants,
    numberOfGuestsOverride: values.numberOfGuestsOverride,
    requestedSofabed: values.requestedSofabed ? 1 : 0,
    calculatedAt,
  });
}

export function deleteLinenRecord(db: Db, taskId: string): void {
  db.prepare(`DELETE FROM linen_records WHERE task_id = ?`).run(taskId);
}

export function insertLinenHistory(db: Db, entry: LinenHistoryEntry): void {
  db.prepare(
    `INSERT INTO linen_history (task_id, reason, event_id, old_values, new_values, created_at)
     VALUES (@taskId, @reason, @eventId, @oldValues, @newValues, @createdAt)`,
  ).run({
    taskId: entry.taskId,
    reason: entry.reason,
    eventId: entry.eventId,
    oldValues: entry.oldValues === null ? null : JSON.stringify(entry.oldValues),
    newValues: entry.newValues === null ? null : JSON.stringify(entry.newValues),
    createdAt: entry.createdAt,
  });
}
