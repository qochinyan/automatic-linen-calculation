import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { eventSchema, listingSchema, reservationSchema, taskSchema } from "./schemas.js";
import type { SourceData } from "./types.js";

function readJsonArray<T>(dataDir: string, fileName: string, schema: z.ZodType<T>): T[] {
  const path = join(dataDir, fileName);
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  const parsed = z.array(schema).safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid ${fileName}: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function loadSourceData(dataDir: string): SourceData {
  return {
    listings: readJsonArray(dataDir, "listings.json", listingSchema),
    reservations: readJsonArray(dataDir, "reservations.json", reservationSchema),
    tasks: readJsonArray(dataDir, "tasks.json", taskSchema),
    events: readJsonArray(dataDir, "events.json", eventSchema),
  };
}
