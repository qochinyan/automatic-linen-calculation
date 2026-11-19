import type { z } from "zod";
import type { reservationFieldSchemas } from "./reservationFieldSchemas.js";
import type { eventSchema, listingSchema, reservationSchema, taskSchema } from "./schemas.js";

export type ListingInput = z.infer<typeof listingSchema>;
export type ReservationInput = z.infer<typeof reservationSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type EventInput = z.infer<typeof eventSchema>;

export type ReservationField = keyof typeof reservationFieldSchemas;

export interface SourceData {
  listings: ListingInput[];
  reservations: ReservationInput[];
  tasks: TaskInput[];
  events: EventInput[];
}
