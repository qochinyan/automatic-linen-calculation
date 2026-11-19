import { z } from "zod";
import { reservationStatusSchema } from "./schemas.js";

const nonNegativeInt = z.number().int().nonnegative();
const isoDateTime = z.iso.datetime();

export const reservationFieldSchemas = {
  guests_count: nonNegativeInt,
  infants: nonNegativeInt,
  planned_arrival_time: isoDateTime,
  planned_departure_time: isoDateTime,
  status: reservationStatusSchema,
  listing_id: z.string().min(1),
  number_of_guests_override: nonNegativeInt.nullable(),
  requested_sofabed: z.boolean(),
};
