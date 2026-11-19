import type Database from "better-sqlite3";
import type { ApartmentCapacity } from "../utils/calculation/types.js";
import type { ReservationStatus } from "../utils/reservations/types.js";

export type Db = Database.Database;

export type TaskColumn = "task_type" | "status" | "listing_id" | "reservation_id" | "planned_start";

export interface ListingLinenConfig {
  name: string;
  capacity: ApartmentCapacity;
}

export interface ListingRow {
  name: string;
  beds: number;
  bed_spots: number;
  sofa_beds: number;
  sofa_spots: number;
}

export interface StoredLinenRecord {
  sheets: number;
  towels: number;
  bathmats: number;
  handtowels: number;
  dishtowels: number;
  requested_sofabeds_count: number;
  source_reservation_id: string;
  actual_guests: number;
  infants: number;
  number_of_guests_override: number | null;
  requested_sofabed: number;
}

export interface LinenRecordValues {
  sheets: number;
  towels: number;
  bathmats: number;
  handtowels: number;
  dishtowels: number;
  requestedSofabedsCount: number;
  sourceReservationId: string;
  actualGuests: number;
  infants: number;
  numberOfGuestsOverride: number | null;
  requestedSofabed: boolean;
}

export interface LinenHistoryEntry {
  taskId: string;
  reason: string;
  eventId: string | null;
  oldValues: unknown;
  newValues: unknown;
  createdAt: string;
}

export interface TaskRow {
  task_id: string;
  task_type: string;
  status: string;
  listing_id: string | null;
  reservation_id: string | null;
  planned_start: string;
}

export interface TaskValues {
  task_id: string;
  task_type: string;
  status: string;
  listing_id: string | null;
  reservation_id: string | null;
  planned_start: string;
}

export interface TaskListRow {
  task_id: string;
  task_type: string;
  status: string;
  listing_id: string | null;
  apartment_name: string | null;
  reservation_id: string | null;
  planned_start: string;
  sheets: number | null;
  towels: number | null;
}

export interface ApartmentRow {
  listing_id: string;
  name: string;
}

export interface ReservationRow {
  reservation_id: string;
  listing_id: string;
  status: ReservationStatus;
  planned_arrival_time: string;
  guests_count: number;
  infants: number;
  number_of_guests_override: number | null;
  requested_sofabed: number;
}

export interface ReservationViewRow {
  reservation_id: string;
  listing_id: string;
  status: string;
  planned_arrival_time: string;
  planned_departure_time: string;
  guests_count: number;
  infants: number;
  number_of_guests_override: number | null;
  requested_sofabed: number;
}

export interface OpenTaskRow {
  task_id: string;
  listing_id: string | null;
  reservation_id: string;
  planned_start: string;
}

export interface LinenViewRow {
  prepared_for_guests: number;
  sheets: number;
  towels: number;
  bathmats: number;
  handtowels: number;
  dishtowels: number;
  requested_sofabeds_count: number;
  source_reservation_id: string;
  actual_guests: number;
  infants: number;
  number_of_guests_override: number | null;
  requested_sofabed: number;
  calculated_at: string;
}

export interface LinenHistoryRow {
  id: number;
  reason: string;
  event_id: string | null;
  old_values: string | null;
  new_values: string | null;
  created_at: string;
}
