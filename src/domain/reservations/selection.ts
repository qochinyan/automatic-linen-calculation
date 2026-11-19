import type { ReservationSnapshot, ReservationStatus } from "./types.js";

export const PREPARATION_WINDOW_MS = 72 * 60 * 60 * 1000;

const EXCLUDED_AS_NEXT: ReadonlySet<ReservationStatus> = new Set(["Canceled", "NoShow"]);
const EXCLUDED_AS_PREVIOUS: ReadonlySet<ReservationStatus> = new Set(["Canceled", "NoShow", "CheckedOut"]);

export function findPreparationReservation(
  taskStartMs: number,
  reservation: ReservationSnapshot,
  reservations: readonly ReservationSnapshot[],
): ReservationSnapshot | null {
  const next = reservations
    .filter(
      (r) =>
        r.listingId === reservation.listingId &&
        r.reservationId !== reservation.reservationId &&
        !EXCLUDED_AS_NEXT.has(r.status) &&
        r.arrivalMs > reservation.arrivalMs,
    )
    .sort(compareArrivalAscending)[0];

  if (!next) return null;

  const offsetMs = next.arrivalMs - taskStartMs;
  return offsetMs >= 0 && offsetMs < PREPARATION_WINDOW_MS ? next : null;
}

export function findPreviousReservation(
  reservation: ReservationSnapshot,
  reservations: readonly ReservationSnapshot[],
): ReservationSnapshot | null {
  const previous = reservations
    .filter(
      (r) =>
        r.listingId === reservation.listingId &&
        r.reservationId !== reservation.reservationId &&
        !EXCLUDED_AS_PREVIOUS.has(r.status) &&
        r.arrivalMs < reservation.arrivalMs,
    )
    .sort((a, b) => compareArrivalAscending(b, a))[0];

  return previous ?? null;
}

function compareArrivalAscending(a: ReservationSnapshot, b: ReservationSnapshot): number {
  if (a.arrivalMs !== b.arrivalMs) return a.arrivalMs - b.arrivalMs;
  return a.reservationId < b.reservationId ? -1 : a.reservationId > b.reservationId ? 1 : 0;
}
