import { z } from "zod";
import { affectedReservationIds, requiresRecalculation } from "../utils/reservations/affectedReservations.js";
import type { FieldChange, ReservationSnapshot } from "../utils/reservations/types.js";
import { recordProcessedEvent } from "../db/queries/events.js";
import {
  findOpenMainCleaningTasksForReservations,
  insertReservation,
  loadAllReservations,
  loadReservation,
  setReservationField,
} from "../db/queries/reservations.js";
import { moveOpenTasksToListing } from "../db/queries/tasks.js";
import type { Db } from "../db/types.js";
import { reservationFieldSchemas } from "../input/reservationFieldSchemas.js";
import type { EventInput, ReservationField } from "../input/types.js";
import { applyTaskLinen } from "./linenRecalculation.js";
import type { EventOutcome } from "./types.js";

export class EventRejectedError extends Error {}

export function processReservationEvent(db: Db, event: EventInput): EventOutcome {
  return db.transaction((): EventOutcome => {
    if (!recordProcessedEvent(db, event, new Date().toISOString())) {
      return { status: "duplicate" };
    }

    const reservationsBefore = loadAllReservations(db);
    const before = applyEvent(db, event);
    const after = loadReservation(db, event.aggregate_id);
    if (!after) {
      throw new EventRejectedError(`Reservation ${event.aggregate_id} is missing after applying the event`);
    }

    if (!requiresRecalculation(event.event_type, event.changes)) {
      return { status: "processed", recalculatedTaskIds: [] };
    }

    if (before && before.listingId !== after.listingId) {
      moveOpenTasksToListing(db, after.reservationId, after.listingId);
    }

    const tasks = findOpenMainCleaningTasksForReservations(
      db,
      affectedReservationIds(before, after, reservationsBefore),
    );
    const reservationsAfter = loadAllReservations(db);
    const reason = describeEvent(event.event_type, event.changes);

    for (const task of tasks) {
      applyTaskLinen(db, task.task_id, {
        reservations: reservationsAfter,
        timestamp: event.created_at,
        reason,
        eventId: event.event_id,
        recordHistory: true,
      });
    }

    return { status: "processed", recalculatedTaskIds: tasks.map((task) => task.task_id) };
  })();
}

function applyEvent(db: Db, event: EventInput): ReservationSnapshot | null {
  if (event.event_type === "Reservation.Created") {
    const payload = event.reservation;
    if (!payload) throw new EventRejectedError("Reservation.Created event has no reservation payload");
    if (payload.reservation_id !== event.aggregate_id) {
      throw new EventRejectedError("Reservation.Created payload does not match aggregate_id");
    }
    if (loadReservation(db, payload.reservation_id)) {
      throw new EventRejectedError(`Reservation ${payload.reservation_id} already exists`);
    }
    insertReservation(db, payload);
    return null;
  }

  const before = loadReservation(db, event.aggregate_id);
  if (!before) throw new EventRejectedError(`Reservation ${event.aggregate_id} does not exist`);
  for (const change of event.changes) {
    applyFieldChange(db, event.aggregate_id, change);
  }
  return before;
}

function applyFieldChange(db: Db, reservationId: string, change: FieldChange): void {
  if (!Object.hasOwn(reservationFieldSchemas, change.field)) {
    throw new EventRejectedError(`Unsupported reservation field "${change.field}"`);
  }
  const field = change.field as ReservationField;
  const schema: z.ZodType = reservationFieldSchemas[field];
  const parsed = schema.safeParse(change.new);
  if (!parsed.success) {
    throw new EventRejectedError(`Invalid value for ${field}: ${parsed.error.message}`);
  }
  const data = parsed.data as string | number | boolean | null;
  const value = typeof data === "boolean" ? (data ? 1 : 0) : data;
  setReservationField(db, reservationId, field, value);
}

function describeEvent(eventType: string, changes: readonly FieldChange[]): string {
  if (changes.length === 0) return eventType;
  return `${eventType} (${changes.map((change) => change.field).join(", ")})`;
}
