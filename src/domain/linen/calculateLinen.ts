import { bathroomCount, dishtowelCount } from "./apartmentRules.js";
import type { ApartmentCapacity, LinenQuantities, LinenRequest } from "./types.js";

export function effectiveGuests(guestsCount: number, numberOfGuestsOverride: number | null): number {
  return Math.max(guestsCount, numberOfGuestsOverride ?? 0);
}

export function calculateDefaultLinen(apartmentName: string, capacity: ApartmentCapacity): LinenQuantities {
  return withOtherItems(apartmentName, {
    sheets: capacity.beds,
    towels: capacity.bedSpots,
    requestedSofabedsCount: 0,
  });
}

export function calculateLinen(request: LinenRequest): LinenQuantities {
  const { apartmentName, capacity, guests, requestedSofabed } = request;
  const { beds, bedSpots, sofaBeds, sofaSpots } = capacity;

  if (guests <= beds || (guests <= bedSpots && !requestedSofabed)) {
    return calculateDefaultLinen(apartmentName, capacity);
  }

  if (guests > bedSpots) {
    return withOtherItems(apartmentName, {
      sheets: beds + sofaBeds,
      towels: Math.max(guests, bedSpots + Math.min(sofaSpots, sofaBeds)),
      requestedSofabedsCount: sofaBeds,
    });
  }

  if (beds === 1 && sofaBeds === 1 && guests === 2) {
    return withOtherItems(apartmentName, { sheets: 2, towels: 2, requestedSofabedsCount: 1 });
  }

  const sofasNeeded = Math.min(guests - beds, sofaBeds);
  if (sofasNeeded === sofaBeds) {
    return withOtherItems(apartmentName, {
      sheets: beds + sofaBeds,
      towels: bedSpots + sofaSpots,
      requestedSofabedsCount: sofaBeds,
    });
  }

  return withOtherItems(apartmentName, {
    sheets: guests,
    towels: bedSpots + sofasNeeded,
    requestedSofabedsCount: sofasNeeded,
  });
}

function withOtherItems(
  apartmentName: string,
  core: { sheets: number; towels: number; requestedSofabedsCount: number },
): LinenQuantities {
  const bathrooms = bathroomCount(apartmentName);
  return {
    sheets: core.sheets,
    towels: core.towels,
    bathmats: bathrooms,
    handtowels: bathrooms === 0 ? 0 : core.towels + bathrooms,
    dishtowels: dishtowelCount(apartmentName),
    requestedSofabedsCount: core.requestedSofabedsCount,
  };
}
