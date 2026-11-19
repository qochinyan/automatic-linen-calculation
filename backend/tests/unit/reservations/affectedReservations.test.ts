import { describe, expect, it } from "vitest";
import { affectedReservationIds, requiresRecalculation } from "../../../src/utils/reservations/affectedReservations.js";
import type { ReservationSnapshot } from "../../../src/utils/reservations/types.js";

function reservation(id: string, arrival: string, listingId = "listing-A"): ReservationSnapshot {
  return {
    reservationId: id,
    listingId,
    status: "Confirmed",
    arrivalMs: Date.parse(arrival),
    guestsCount: 2,
    infants: 0,
    numberOfGuestsOverride: null,
    requestedSofabed: false,
  };
}

describe("requiresRecalculation", () => {
  const updated = (field: string, newValue: unknown) => [{ field, old: null, new: newValue }];

  it.each(["guests_count", "infants", "planned_arrival_time", "listing_id", "number_of_guests_override", "requested_sofabed"])(
    "triggers on %s",
    (field) => {
      expect(requiresRecalculation("Reservation.Updated", updated(field, "x"))).toBe(true);
    },
  );

  it("does not trigger on planned_departure_time", () => {
    expect(requiresRecalculation("Reservation.Updated", updated("planned_departure_time", "2026-03-14T11:00:00Z"))).toBe(
      false,
    );
  });

  it("triggers on check-in and check-out", () => {
    expect(requiresRecalculation("Reservation.Updated", updated("status", "InHouse"))).toBe(true);
    expect(requiresRecalculation("Reservation.Updated", updated("status", "CheckedOut"))).toBe(true);
  });

  it("triggers when a reservation is canceled or becomes a no-show", () => {
    expect(requiresRecalculation("Reservation.Updated", updated("status", "Canceled"))).toBe(true);
    expect(requiresRecalculation("Reservation.Updated", updated("status", "NoShow"))).toBe(true);
  });

  it("does not trigger on a status change that is not check-in, check-out, or cancellation", () => {
    expect(requiresRecalculation("Reservation.Updated", updated("status", "Confirmed"))).toBe(false);
  });

  it("always triggers on creation", () => {
    expect(requiresRecalculation("Reservation.Created", [])).toBe(true);
  });
});

describe("affectedReservationIds", () => {
  const predecessor = reservation("PREV", "2026-03-05T15:00:00Z");
  const changed = reservation("CHANGED", "2026-03-11T15:00:00Z");
  const all = [predecessor, changed];

  it("includes the changed reservation and its previous reservation", () => {
    expect(affectedReservationIds(changed, { ...changed, guestsCount: 5 }, all)).toEqual(["CHANGED", "PREV"]);
  });

  it("includes both previous reservations when a listing changes", () => {
    const oldListingPrevious = reservation("OLD-PREV", "2026-03-01T15:00:00Z", "listing-old");
    const newListingPrevious = reservation("NEW-PREV", "2026-03-02T15:00:00Z", "listing-new");
    const before = { ...changed, listingId: "listing-old" };
    const after = { ...changed, listingId: "listing-new" };
    const ids = affectedReservationIds(before, after, [oldListingPrevious, newListingPrevious, before]);
    expect(ids).toEqual(expect.arrayContaining(["CHANGED", "OLD-PREV", "NEW-PREV"]));
    expect(ids).toHaveLength(3);
  });

  it("returns only the reservation itself when it has no previous reservation", () => {
    const first = reservation("FIRST", "2026-03-05T15:00:00Z");
    expect(affectedReservationIds(first, { ...first, guestsCount: 4 }, [first])).toEqual(["FIRST"]);
  });

  it("includes the new creation's previous reservation", () => {
    const created = reservation("NEW", "2026-03-11T15:00:00Z");
    expect(affectedReservationIds(null, created, [predecessor])).toEqual(["NEW", "PREV"]);
  });
});
