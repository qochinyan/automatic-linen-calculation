import type { z } from "zod";
import type { taskPatchSchema } from "./requestSchemas.js";

export interface TaskParams {
  id: string;
}

export interface ErrorBody {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export type TaskPatch = z.infer<typeof taskPatchSchema>;
