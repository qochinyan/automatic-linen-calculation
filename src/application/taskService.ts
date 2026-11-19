import type { Db } from "../infrastructure/db/connection.js";
import type { LinenRecordValues } from "../infrastructure/db/linenRepository.js";
import { loadAllReservations } from "../infrastructure/db/reservationRepository.js";
import {
  listLinenHistoryRows,
  listTaskRows,
  loadApartmentRow,
  loadLinenViewRow,
  loadReservationViewRow,
} from "../infrastructure/db/queryRepository.js";
import {
  insertTask,
  loadTask,
  updateTaskColumns,
  type TaskColumn,
  type TaskValues,
} from "../infrastructure/db/taskRepository.js";
import type { TaskPatch } from "../infrastructure/http/requestSchemas.js";
import { ConflictError, NotFoundError } from "./errors.js";
import { applyTaskLinen } from "./linenCalculation.js";

const CLOSED_STATUSES: ReadonlySet<string> = new Set(["Completed", "Cancelled"]);
const LINEN_TRIGGER_COLUMNS: readonly TaskColumn[] = ["task_type", "listing_id", "reservation_id", "planned_start"];
const PATCHABLE_COLUMNS: readonly TaskColumn[] = ["task_type", "status", "listing_id", "reservation_id", "planned_start"];

export interface TaskListItem {
  task_id: string;
  task_type: string;
  status: string;
  listing_id: string | null;
  apartment_name: string | null;
  reservation_id: string | null;
  planned_start: string;
  linen: { sheets: number; towels: number } | null;
}

export interface TaskDetail {
  task: TaskValues;
  apartment: { listing_id: string; name: string } | null;
  reservation: {
    reservation_id: string;
    listing_id: string;
    status: string;
    planned_arrival_time: string;
    planned_departure_time: string;
    guests_count: number;
    infants: number;
    number_of_guests_override: number | null;
    requested_sofabed: boolean;
  } | null;
  linen: {
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
    requested_sofabed: boolean;
    calculated_at: string;
  } | null;
}

export interface TaskHistoryEntry {
  id: number;
  reason: string;
  event_id: string | null;
  old_values: unknown;
  new_values: unknown;
  created_at: string;
}

export function listTasks(db: Db): TaskListItem[] {
  return listTaskRows(db).map((row) => ({
    task_id: row.task_id,
    task_type: row.task_type,
    status: row.status,
    listing_id: row.listing_id,
    apartment_name: row.apartment_name,
    reservation_id: row.reservation_id,
    planned_start: row.planned_start,
    linen: row.sheets === null || row.towels === null ? null : { sheets: row.sheets, towels: row.towels },
  }));
}

export function getTask(db: Db, taskId: string): TaskDetail {
  const task = loadTask(db, taskId);
  if (!task) throw new NotFoundError(`Task ${taskId} not found`);

  const apartment = task.listing_id ? loadApartmentRow(db, task.listing_id) : null;
  const reservation = task.reservation_id ? loadReservationViewRow(db, task.reservation_id) : null;
  const linen = loadLinenViewRow(db, taskId);

  return {
    task,
    apartment: apartment ? { listing_id: apartment.listing_id, name: apartment.name } : null,
    reservation: reservation
      ? {
          reservation_id: reservation.reservation_id,
          listing_id: reservation.listing_id,
          status: reservation.status,
          planned_arrival_time: reservation.planned_arrival_time,
          planned_departure_time: reservation.planned_departure_time,
          guests_count: reservation.guests_count,
          infants: reservation.infants,
          number_of_guests_override: reservation.number_of_guests_override,
          requested_sofabed: reservation.requested_sofabed === 1,
        }
      : null,
    linen: linen
      ? {
          prepared_for_guests: linen.prepared_for_guests,
          sheets: linen.sheets,
          towels: linen.towels,
          bathmats: linen.bathmats,
          handtowels: linen.handtowels,
          dishtowels: linen.dishtowels,
          requested_sofabeds_count: linen.requested_sofabeds_count,
          source_reservation_id: linen.source_reservation_id,
          actual_guests: linen.actual_guests,
          infants: linen.infants,
          number_of_guests_override: linen.number_of_guests_override,
          requested_sofabed: linen.requested_sofabed === 1,
          calculated_at: linen.calculated_at,
        }
      : null,
  };
}

export function getTaskHistory(db: Db, taskId: string): TaskHistoryEntry[] {
  if (!loadTask(db, taskId)) throw new NotFoundError(`Task ${taskId} not found`);
  return listLinenHistoryRows(db, taskId).map((row) => ({
    id: row.id,
    reason: row.reason,
    event_id: row.event_id,
    old_values: row.old_values === null ? null : toSnakeCaseLinen(JSON.parse(row.old_values)),
    new_values: row.new_values === null ? null : toSnakeCaseLinen(JSON.parse(row.new_values)),
    created_at: row.created_at,
  }));
}

function toSnakeCaseLinen(stored: LinenRecordValues): Record<string, unknown> {
  return {
    sheets: stored.sheets,
    towels: stored.towels,
    bathmats: stored.bathmats,
    handtowels: stored.handtowels,
    dishtowels: stored.dishtowels,
    requested_sofabeds_count: stored.requestedSofabedsCount,
    source_reservation_id: stored.sourceReservationId,
    actual_guests: stored.actualGuests,
    infants: stored.infants,
    number_of_guests_override: stored.numberOfGuestsOverride,
    requested_sofabed: stored.requestedSofabed,
  };
}

export function createTask(db: Db, task: TaskValues): TaskDetail {
  return db.transaction((): TaskDetail => {
    if (loadTask(db, task.task_id)) throw new ConflictError(`Task ${task.task_id} already exists`);

    insertTask(db, task);
    applyTaskLinen(db, task.task_id, {
      reservations: loadAllReservations(db),
      timestamp: new Date().toISOString(),
      reason: "task.created",
      eventId: null,
      recordHistory: true,
    });

    return getTask(db, task.task_id);
  })();
}

export function updateTask(db: Db, taskId: string, patch: TaskPatch): TaskDetail {
  return db.transaction((): TaskDetail => {
    const before = loadTask(db, taskId);
    if (!before) throw new NotFoundError(`Task ${taskId} not found`);

    const changes: Partial<Record<TaskColumn, string | null>> = {};
    for (const column of PATCHABLE_COLUMNS) {
      const value = patch[column];
      if (value !== undefined) changes[column] = value;
    }
    updateTaskColumns(db, taskId, changes);

    const after = loadTask(db, taskId);
    if (!after) throw new Error(`Task ${taskId} disappeared during update`);

    const changedLinenColumns = LINEN_TRIGGER_COLUMNS.filter((column) => before[column] !== after[column]);
    if (changedLinenColumns.length > 0 && !CLOSED_STATUSES.has(after.status)) {
      applyTaskLinen(db, taskId, {
        reservations: loadAllReservations(db),
        timestamp: new Date().toISOString(),
        reason: `task.updated (${changedLinenColumns.join(", ")})`,
        eventId: null,
        recordHistory: true,
      });
    }

    return getTask(db, taskId);
  })();
}
