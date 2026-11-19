export type ReservationStatus = "Confirmed" | "InHouse" | "CheckedOut" | "Canceled" | "NoShow";

export interface FieldChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface ReservationSnapshot {
  reservationId: string;
  listingId: string;
  status: ReservationStatus;
  arrivalMs: number;
  guestsCount: number;
  infants: number;
  numberOfGuestsOverride: number | null;
  requestedSofabed: boolean;
}
