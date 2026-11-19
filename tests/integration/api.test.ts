import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../src/infrastructure/db/types.js";
import { createTestApp, eventById, postEvent, postEventById } from "../helpers/fixtures.js";

let app: FastifyInstance;
let db: Db;

beforeEach(() => {
  ({ app, db } = createTestApp());
});

afterEach(async () => {
  await app.close();
  db.close();
});

const newTask = (overrides: Record<string, unknown> = {}) => ({
  task_id: "T-api-new",
  task_type: "Main Cleaning",
  status: "Pending",
  listing_id: "8dd86c8fd658ff3e3a159120",
  reservation_id: "HSWQRSVE-1",
  planned_start: "2026-03-10T10:00:00Z",
  ...overrides,
});

describe("event endpoint validation and rejection", () => {
  it("rejects an unknown event type with 400", async () => {
    const response = await postEvent(app, { ...eventById("E-chain-guests"), event_type: "Reservation.Deleted" } as never);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
  });

  it("rejects an unsupported field with 422 and rolls back the whole event", async () => {
    const before = await app.inject({ method: "GET", url: "/tasks/T-chain-A" });
    const response = await postEvent(app, {
      event_id: "E-rollback-unknown-field",
      aggregate_id: "WSABFEUA-1",
      event_type: "Reservation.Updated",
      created_at: "2026-03-09T09:00:00Z",
      changes: [
        { field: "guests_count", old: 1, new: 5 },
        { field: "not_a_field", old: 1, new: 2 },
      ],
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("event_rejected");

    const after = await app.inject({ method: "GET", url: "/tasks/T-chain-A" });
    expect(after.json()).toEqual(before.json());
  });

  it("rolls back and reports a reference error for an unknown listing", async () => {
    const response = await postEvent(app, {
      event_id: "E-rollback-bad-listing",
      aggregate_id: "WSABFEUA-1",
      event_type: "Reservation.Updated",
      created_at: "2026-03-09T09:00:00Z",
      changes: [
        { field: "guests_count", old: 1, new: 5 },
        { field: "listing_id", old: "8dd86c8fd658ff3e3a159120", new: "does-not-exist" },
      ],
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("reference_not_found");

    expect((await app.inject({ method: "GET", url: "/tasks/T-chain-A" })).json().linen.towels).toBe(4);
  });

  it("does not record a rolled-back event, so the same event_id can be processed later", async () => {
    await postEvent(app, {
      event_id: "E-retry-after-failure",
      aggregate_id: "WSABFEUA-1",
      event_type: "Reservation.Updated",
      created_at: "2026-03-09T09:00:00Z",
      changes: [{ field: "not_a_field", old: 1, new: 2 }],
    });
    const retry = await postEvent(app, {
      event_id: "E-retry-after-failure",
      aggregate_id: "WSABFEUA-1",
      event_type: "Reservation.Updated",
      created_at: "2026-03-09T09:00:00Z",
      changes: [{ field: "guests_count", old: 1, new: 5 }],
    });
    expect(retry.statusCode).toBe(201);
    expect(retry.json().status).toBe("processed");
  });

  it("rejects an update for an unknown reservation", async () => {
    const response = await postEvent(app, {
      event_id: "E-unknown-reservation",
      aggregate_id: "NO-SUCH-RES",
      event_type: "Reservation.Updated",
      created_at: "2026-03-09T09:00:00Z",
      changes: [{ field: "guests_count", old: 1, new: 2 }],
    });
    expect(response.statusCode).toBe(422);
  });

  it("rejects creating a reservation that already exists", async () => {
    const response = await postEventById(app, "E-new-reservation");
    expect(response.statusCode).toBe(201);
    const again = await app.inject({
      method: "POST",
      url: "/events/reservation",
      payload: { ...eventById("E-new-reservation"), event_id: "E-new-reservation-again" },
    });
    expect(again.statusCode).toBe(422);
  });
});

describe("task endpoints", () => {
  it("creates a Main Cleaning task and calculates its linen with history", async () => {
    const response = await app.inject({ method: "POST", url: "/tasks", payload: newTask() });
    expect(response.statusCode).toBe(201);
    expect(response.json().linen).toMatchObject({ sheets: 2, towels: 4 });

    const history = await app.inject({ method: "GET", url: "/tasks/T-api-new/linen/history" });
    expect(history.json()).toHaveLength(1);
    expect(history.json()[0].reason).toBe("task.created");
  });

  it("creates a Deep Cleaning task without linen", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/tasks",
      payload: newTask({ task_type: "Deep Cleaning" }),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().linen).toBeNull();
  });

  it("rejects a duplicate task_id with 409", async () => {
    const response = await app.inject({ method: "POST", url: "/tasks", payload: newTask({ task_id: "T-chain-A" }) });
    expect(response.statusCode).toBe(409);
  });

  it("rejects a task that references a missing listing with 422", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/tasks",
      payload: newTask({ listing_id: "no-such-listing" }),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("reference_not_found");
  });

  it("rejects an invalid task body with 400", async () => {
    const response = await app.inject({ method: "POST", url: "/tasks", payload: newTask({ status: "Unknown" }) });
    expect(response.statusCode).toBe(400);
  });

  it("returns 404 for an unknown task", async () => {
    expect((await app.inject({ method: "GET", url: "/tasks/NOPE" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/tasks/NOPE/linen/history" })).statusCode).toBe(404);
    expect((await app.inject({ method: "PATCH", url: "/tasks/NOPE", payload: { status: "Paused" } })).statusCode).toBe(404);
  });

  it("rejects an empty PATCH with 400", async () => {
    const response = await app.inject({ method: "PATCH", url: "/tasks/T-chain-A", payload: {} });
    expect(response.statusCode).toBe(400);
  });

  it("does not recalculate when only the status changes", async () => {
    const before = await app.inject({ method: "GET", url: "/tasks/T-chain-A" });
    const response = await app.inject({ method: "PATCH", url: "/tasks/T-chain-A", payload: { status: "Paused" } });
    expect(response.statusCode).toBe(200);
    expect(response.json().linen).toEqual(before.json().linen);
    expect(response.json().task.status).toBe("Paused");
  });

  it("removes the linen record when the task becomes a non-Main Cleaning task", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/tasks/T-chain-A",
      payload: { task_type: "Deep Cleaning" },
    });
    expect(response.json().linen).toBeNull();

    const history = await app.inject({ method: "GET", url: "/tasks/T-chain-A/linen/history" });
    const last = history.json().at(-1);
    expect(last.new_values).toBeNull();
  });

  it("keeps a Completed task's linen when its planned_start changes", async () => {
    const before = await app.inject({ method: "GET", url: "/tasks/T-completed-A" });
    const response = await app.inject({
      method: "PATCH",
      url: "/tasks/T-completed-A",
      payload: { planned_start: "2026-03-20T10:00:00Z" },
    });
    expect(response.json().linen).toEqual(before.json().linen);
    expect(response.json().task.planned_start).toBe("2026-03-20T10:00:00Z");
  });

  it("keeps a Cancelled task's linen when its reservation changes", async () => {
    await app.inject({ method: "PATCH", url: "/tasks/T-chain-B", payload: { status: "Cancelled" } });
    const before = await app.inject({ method: "GET", url: "/tasks/T-chain-B" });
    const response = await app.inject({
      method: "PATCH",
      url: "/tasks/T-chain-B",
      payload: { reservation_id: "HSWQRSVE-1" },
    });
    expect(response.json().linen).toEqual(before.json().linen);
  });

  it("lists tasks with a linen summary where a record exists", async () => {
    const list = (await app.inject({ method: "GET", url: "/tasks" })).json() as Array<{ task_id: string; linen: unknown }>;
    expect(list).toHaveLength(28);
    expect(list.find((item) => item.task_id === "T-deep-cleaning")?.linen).toBeNull();
    expect(list.find((item) => item.task_id === "T-chain-A")?.linen).toEqual({ sheets: 2, towels: 4 });
  });
});
