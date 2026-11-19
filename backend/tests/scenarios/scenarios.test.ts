import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../src/db/types.js";
import { createTestApp, getJson, postEventById } from "../helpers/fixtures.js";
import type { EventResponseJson, HistoryJson, LinenJson, TaskJson } from "../helpers/types.js";

let app: FastifyInstance;
let db: Db;

beforeEach(() => {
  ({ app, db } = createTestApp());
});

afterEach(async () => {
  await app.close();
  db.close();
});

const task = (id: string) => getJson<TaskJson>(app, `/tasks/${id}`);
const history = (id: string) => getJson<HistoryJson[]>(app, `/tasks/${id}/linen/history`);

async function linen(id: string): Promise<LinenJson> {
  const detail = await task(id);
  if (!detail.linen) throw new Error(`Expected linen for ${id}`);
  return detail.linen;
}

async function event(id: string): Promise<EventResponseJson> {
  const response = await postEventById(app, id);
  expect(response.statusCode).toBeLessThan(300);
  return response.json() as EventResponseJson;
}

describe("scenario 1: chain", () => {
  it("B's guest change updates A's cleaning, while B keeps using C", async () => {
    const aBefore = await linen("T-chain-A");
    expect(aBefore).toMatchObject({ sheets: 2, towels: 4, source_reservation_id: "WSABFEUA-1", actual_guests: 1 });

    const result = await event("E-chain-guests");
    expect(result.recalculated_task_ids).toEqual(expect.arrayContaining(["T-chain-A", "T-chain-B"]));

    const aAfter = await linen("T-chain-A");
    expect(aAfter).toMatchObject({ sheets: 3, towels: 5, requested_sofabeds_count: 1, actual_guests: 5 });

    const bAfter = await linen("T-chain-B");
    expect(bAfter).toMatchObject({ source_reservation_id: "HXAPEGRD-1" });
    expect(await history("T-chain-B")).toHaveLength(0);
  });

  it("B's departure time change recalculates nothing", async () => {
    const result = await event("E-chain-departure");
    expect(result).toEqual({ status: "processed", recalculated_task_ids: [] });
    expect(await history("T-chain-A")).toHaveLength(0);
  });
});

describe("scenario 2: custom-fields", () => {
  it("sofa bed request and then guest override update the previous cleaning", async () => {
    const baseline = await linen("T-custom-fields-A");
    expect(baseline).toMatchObject({ sheets: 2, towels: 4, requested_sofabeds_count: 0 });

    await event("E-sofabed-requested");
    const afterSofa = await linen("T-custom-fields-A");
    expect(afterSofa).toMatchObject({ sheets: 3, towels: 6, requested_sofabeds_count: 1, requested_sofabed: true });

    await event("E-override-set");
    const afterOverride = await linen("T-custom-fields-A");
    expect(afterOverride).toMatchObject({ sheets: 3, towels: 5, requested_sofabeds_count: 1, number_of_guests_override: 5 });

    expect(await history("T-custom-fields-A")).toHaveLength(2);
  });
});

describe("scenario 3: arrival-change", () => {
  it("switches between next-guest and default calculation when the arrival leaves and re-enters the 72-hour window", async () => {
    expect(await linen("T-arrival-change-A")).toMatchObject({
      sheets: 3,
      towels: 6,
      source_reservation_id: "LNRKYYHN-1",
    });

    await event("E-arrival-later");
    expect(await linen("T-arrival-change-A")).toMatchObject({
      sheets: 2,
      towels: 4,
      requested_sofabeds_count: 0,
      source_reservation_id: "UQTPZYFN-1",
    });

    await event("E-arrival-earlier");
    expect(await linen("T-arrival-change-A")).toMatchObject({
      sheets: 3,
      towels: 6,
      source_reservation_id: "LNRKYYHN-1",
    });
    expect(await history("T-arrival-change-A")).toHaveLength(2);
  });
});

describe("scenario 4: move", () => {
  it("moves the reservation's task to the new apartment and recalculates both affected cleanings", async () => {
    const result = await event("E-move-listing");
    expect([...result.recalculated_task_ids].sort()).toEqual(["T-move-A", "T-move-B"]);

    const movedTask = await task("T-move-B");
    expect(movedTask.task.listing_id).toBe("4b4a495ebcc125a877bf11d0");
    expect(movedTask.apartment?.name).toBe("Lumen 302 3BR-2BA");
    expect(movedTask.linen).toMatchObject({ sheets: 3, towels: 6, bathmats: 2, source_reservation_id: "FUPVNNAY-1" });

    expect(await linen("T-move-A")).toMatchObject({
      sheets: 4,
      towels: 8,
      bathmats: 2,
      requested_sofabeds_count: 1,
      source_reservation_id: "WAEQBZXT-1",
      actual_guests: 4,
    });
  });
});

describe("scenario 5: date-change", () => {
  it("recalculates with the new planned_start after PATCH", async () => {
    const before = await linen("T-date-change-A");
    expect(before).toMatchObject({ sheets: 2, towels: 4, source_reservation_id: "SQBJMFYF-1" });

    const response = await app.inject({
      method: "PATCH",
      url: "/tasks/T-date-change-A",
      payload: { planned_start: "2026-03-12T10:00:00Z" },
    });
    expect(response.statusCode).toBe(200);

    const after = await linen("T-date-change-A");
    expect(after).toMatchObject({ sheets: 3, towels: 6, requested_sofabeds_count: 1, source_reservation_id: "FNTBPBAA-1" });

    const entries = await history("T-date-change-A");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.reason).toContain("planned_start");
  });
});

describe("scenario 6: duplicate", () => {
  it("a repeated event changes nothing and adds no history entry", async () => {
    const first = await event("E-duplicate");
    expect(first).toEqual({ status: "processed", recalculated_task_ids: ["T-duplicate-A"] });

    const second = await postEventById(app, "E-duplicate");
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ status: "duplicate", recalculated_task_ids: [] });

    expect(await history("T-duplicate-A")).toHaveLength(1);
    expect(await linen("T-duplicate-A")).toMatchObject({ sheets: 3, towels: 5 });
  });
});

describe("scenario 7: new-reservation", () => {
  it("creating a reservation recalculates the previous cleaning", async () => {
    const result = await event("E-new-reservation");
    expect(result.recalculated_task_ids).toEqual(["T-new-reservation-A"]);

    expect(await linen("T-new-reservation-A")).toMatchObject({
      sheets: 3,
      towels: 5,
      requested_sofabeds_count: 1,
      source_reservation_id: "CNNCLBXG-1",
      actual_guests: 5,
    });
  });
});

describe("scenario 8: completed", () => {
  it("a Completed task keeps its linen after a guest change", async () => {
    const before = await linen("T-completed-A");
    const result = await event("E-completed-guests");

    expect(result.recalculated_task_ids).not.toContain("T-completed-A");
    expect(await linen("T-completed-A")).toEqual(before);
    expect(await history("T-completed-A")).toHaveLength(0);
  });
});

describe("scenario 9: checked-out", () => {
  it("a later change to the next guest does not recalculate a checked-out reservation's cleaning", async () => {
    await event("E-checkout");
    const afterCheckout = await linen("T-checked-out-A");

    const result = await event("E-after-checkout");
    expect(result.recalculated_task_ids).not.toContain("T-checked-out-A");

    expect(await linen("T-checked-out-A")).toEqual(afterCheckout);
    expect(afterCheckout).toMatchObject({ source_reservation_id: "VJHJMTPV-1", actual_guests: 1 });
  });
});

describe("scenario 10: skip-canceled", () => {
  it("skips a Canceled next reservation and uses the one after it", async () => {
    expect(await linen("T-skip-canceled-A")).toMatchObject({
      sheets: 3,
      towels: 6,
      requested_sofabeds_count: 1,
      source_reservation_id: "CZJKJTQF-1",
    });
  });

  it("gives no linen to a non-Main Cleaning task", async () => {
    const response = await app.inject({ method: "GET", url: "/tasks/T-deep-cleaning" });
    expect((response.json() as TaskJson).linen).toBeNull();
  });

  it("gives no linen to a task whose reservation does not exist", async () => {
    const response = await app.inject({ method: "GET", url: "/tasks/T-missing-reservation" });
    expect((response.json() as TaskJson).linen).toBeNull();
  });
});
