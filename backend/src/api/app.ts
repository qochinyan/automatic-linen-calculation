import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { ConflictError, NotFoundError } from "../services/errors.js";
import { processReservationEvent, EventRejectedError } from "../services/events.js";
import { createTask, getTask, getTaskHistory, listTasks, updateTask } from "../services/tasks.js";
import type { Db } from "../db/types.js";
import { eventSchema, taskSchema } from "../input/schemas.js";
import { taskPatchSchema } from "./requestSchemas.js";
import type { ErrorBody, TaskParams } from "./types.js";

export function buildApp(db: Db): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error: unknown, _request, reply) => {
    const body = toErrorBody(error);
    reply.status(body.status).send({
      error: { code: body.code, message: body.message, ...(body.details === undefined ? {} : { details: body.details }) },
    });
  });

  app.post("/events/reservation", async (request, reply) => {
    const event = eventSchema.parse(request.body);
    const outcome = processReservationEvent(db, event);
    if (outcome.status === "duplicate") {
      return reply.status(200).send({ status: "duplicate", recalculated_task_ids: [] });
    }
    return reply.status(201).send({ status: "processed", recalculated_task_ids: outcome.recalculatedTaskIds });
  });

  app.get("/tasks", async () => listTasks(db));

  app.post("/tasks", async (request, reply) => {
    const task = taskSchema.parse(request.body);
    return reply.status(201).send(createTask(db, task));
  });

  app.get<{ Params: TaskParams }>("/tasks/:id", async (request) => getTask(db, request.params.id));

  app.patch<{ Params: TaskParams }>("/tasks/:id", async (request) => {
    const patch = taskPatchSchema.parse(request.body);
    return updateTask(db, request.params.id, patch);
  });

  app.get<{ Params: TaskParams }>("/tasks/:id/linen/history", async (request) =>
    getTaskHistory(db, request.params.id),
  );

  return app;
}

function toErrorBody(error: unknown): ErrorBody {
  if (error instanceof ZodError) {
    return { status: 400, code: "validation_error", message: "Request validation failed", details: error.issues };
  }
  if (error instanceof NotFoundError) {
    return { status: 404, code: "not_found", message: error.message };
  }
  if (error instanceof ConflictError) {
    return { status: 409, code: "conflict", message: error.message };
  }
  if (error instanceof EventRejectedError) {
    return { status: 422, code: "event_rejected", message: error.message };
  }
  if (isSqliteError(error)) {
    if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      return { status: 422, code: "reference_not_found", message: "Referenced listing or reservation does not exist" };
    }
    if (error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" || error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { status: 409, code: "conflict", message: "Record already exists" };
    }
    return { status: 422, code: "constraint_violation", message: error.message };
  }
  const statusCode = getFastifyStatusCode(error);
  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    return { status: statusCode, code: "bad_request", message: error instanceof Error ? error.message : "Bad request" };
  }
  console.error(error);
  return { status: 500, code: "internal_error", message: "Internal server error" };
}

function isSqliteError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error && typeof error.code === "string" && error.code.startsWith("SQLITE_");
}

function getFastifyStatusCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  return undefined;
}
