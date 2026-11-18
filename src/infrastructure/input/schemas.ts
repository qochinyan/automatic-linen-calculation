import { z } from "zod";

const nonNegativeInt = z.number().int().nonnegative();
const isoDateTime = z.iso.datetime();

export const listingSchema = z.object({
  listing_id: z.string().min(1),
  name: z.string().min(1),
  linen_attribute: z.string().min(1),
});

export const reservationStatusSchema = z.enum(["Confirmed", "InHouse", "CheckedOut", "Canceled", "NoShow"]);

export const reservationSchema = z.object({
  reservation_id: z.string().min(1),
  listing_id: z.string().min(1),
  status: reservationStatusSchema,
  planned_arrival_time: isoDateTime,
  planned_departure_time: isoDateTime,
  guests_count: nonNegativeInt,
  infants: nonNegativeInt,
  customFields: z.object({
    number_of_guests_override: nonNegativeInt.nullable(),
    requested_sofabed: z.boolean(),
  }),
});

export const taskStatusSchema = z.enum(["Pending", "In Progress", "Paused", "Completed", "Cancelled"]);

export const taskSchema = z.object({
  task_id: z.string().min(1),
  task_type: z.string().min(1),
  status: taskStatusSchema,
  listing_id: z.string().min(1).nullable(),
  reservation_id: z.string().min(1).nullable(),
  planned_start: isoDateTime,
});

export const eventTypeSchema = z.enum([
  "Reservation.Created",
  "Reservation.Updated",
  "Reservation.CustomFields.Updated",
]);

export const eventSchema = z.object({
  event_id: z.string().min(1),
  aggregate_id: z.string().min(1),
  event_type: eventTypeSchema,
  created_at: isoDateTime,
  changes: z.array(
    z.object({
      field: z.string().min(1),
      old: z.unknown(),
      new: z.unknown(),
    }),
  ),
  reservation: reservationSchema.optional(),
});

export type ListingInput = z.infer<typeof listingSchema>;
export type ReservationInput = z.infer<typeof reservationSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type EventInput = z.infer<typeof eventSchema>;
