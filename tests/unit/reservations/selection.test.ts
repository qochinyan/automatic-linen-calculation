import { describe, expect, it } from "vitest";
import { PREPARATION_WINDOW_MS, findPreparationReservation, findPreviousReservation } from "../../../src/domain/reservations/selection.js";
import type { ReservationSnapshot, ReservationStatus } from "../../../src/domain/reservations/types.js";

const LISTING = "listing-A";
const TASK_START = Date.parse("2026-03-10T10:00:00Z");

function reservation(
  id: string,
  arrival: string,
  status: ReservationStatus = "Confirmed",
  listingId = LISTING,
): ReservationSnapshot {
  return {
    reservationId: id,
    listingId,
    status,
    arrivalMs: Date.parse(arrival),
    guestsCount: 2,
    infants: 0,
    numberOfGuestsOverride: null,
    requestedSofabed: false,
  };
}

const CURRENT = reservation("CURRENT", "2026-03-05T15:00:00Z");

describe("findPreparationReservation", () => {
  it("selects the next guest arriving exactly at planned_start", () => {
    const next = reservation("NEXT", "2026-03-10T10:00:00Z");
    expect(findPreparationReservation(TASK_START, CURRENT, [CURRENT, next])?.reservationId).toBe("NEXT");
  });

  it("selects the next guest arriving 1 ms before the 72-hour boundary", () => {
    const next = { ...reservation("NEXT", "2026-03-10T10:00:00Z"), arrivalMs: TASK_START + PREPARATION_WINDOW_MS - 1 };
    expect(findPreparationReservation(TASK_START, CURRENT, [CURRENT, next])?.reservationId).toBe("NEXT");
  });

  it("falls back to the default when the next guest arrives exactly 72 hours after planned_start", () => {
    const next = { ...reservation("NEXT", "2026-03-10T10:00:00Z"), arrivalMs: TASK_START + PREPARATION_WINDOW_MS };
    expect(findPreparationReservation(TASK_START, CURRENT, [CURRENT, next])).toBeNull();
  });

  it("falls back to the default when the next guest arrives 1 ms before planned_start", () => {
    const next = { ...reservation("NEXT", "2026-03-10T10:00:00Z"), arrivalMs: TASK_START - 1 };
    expect(findPreparationReservation(TASK_START, CURRENT, [CURRENT, next])).toBeNull();
  });

  it("returns null when there is no later reservation", () => {
    expect(findPreparationReservation(TASK_START, CURRENT, [CURRENT])).toBeNull();
  });

  it("skips Canceled and NoShow reservations and uses the next eligible one", () => {
    const canceled = reservation("CANCELED", "2026-03-11T15:00:00Z", "Canceled");
    const noShow = reservation("NOSHOW", "2026-03-11T16:00:00Z", "NoShow");
    const eligible = reservation("ELIGIBLE", "2026-03-12T15:00:00Z");
    expect(findPreparationReservation(TASK_START, CURRENT, [CURRENT, canceled, noShow, eligible])?.reservationId).toBe(
      "ELIGIBLE",
    );
  });

  it("never selects the task's own reservation", () => {
    expect(findPreparationReservation(TASK_START, CURRENT, [CURRENT])).toBeNull();
  });

  it("ignores reservations on other apartments", () => {
    const other = reservation("OTHER", "2026-03-10T12:00:00Z", "Confirmed", "listing-B");
    expect(findPreparationReservation(TASK_START, CURRENT, [CURRENT, other])).toBeNull();
  });

  it("breaks arrival ties by reservation id", () => {
    const first = reservation("A-NEXT", "2026-03-11T15:00:00Z");
    const second = reservation("B-NEXT", "2026-03-11T15:00:00Z");
    expect(findPreparationReservation(TASK_START, CURRENT, [CURRENT, second, first])?.reservationId).toBe("A-NEXT");
  });
});

describe("findPreviousReservation", () => {
  const target = reservation("TARGET", "2026-03-11T15:00:00Z");

  it("returns the closest earlier arrival on the same apartment", () => {
    const far = reservation("FAR", "2026-03-01T15:00:00Z");
    const close = reservation("CLOSE", "2026-03-05T15:00:00Z");
    expect(findPreviousReservation(target, [far, close, target])?.reservationId).toBe("CLOSE");
  });

  it.each<ReservationStatus>(["Canceled", "NoShow", "CheckedOut"])("skips %s reservations", (status) => {
    const excluded = reservation("EXCLUDED", "2026-03-09T15:00:00Z", status);
    const eligible = reservation("ELIGIBLE", "2026-03-05T15:00:00Z");
    expect(findPreviousReservation(target, [eligible, excluded, target])?.reservationId).toBe("ELIGIBLE");
  });

  it("does not consider later arrivals or other apartments", () => {
    const later = reservation("LATER", "2026-03-20T15:00:00Z");
    const otherApartment = reservation("OTHER", "2026-03-01T15:00:00Z", "Confirmed", "listing-B");
    expect(findPreviousReservation(target, [later, otherApartment, target])).toBeNull();
  });
});
