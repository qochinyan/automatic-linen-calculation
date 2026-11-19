import { z } from "zod";
import { taskStatusSchema } from "../input/schemas.js";

export const taskPatchSchema = z
  .object({
    task_type: z.string().min(1).optional(),
    status: taskStatusSchema.optional(),
    listing_id: z.string().min(1).nullable().optional(),
    reservation_id: z.string().min(1).nullable().optional(),
    planned_start: z.iso.datetime().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: "At least one field must be provided" });
