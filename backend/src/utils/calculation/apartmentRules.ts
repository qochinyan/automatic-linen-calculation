export function bathroomCount(apartmentName: string): number {
  if (apartmentName.includes("SS")) return 0;
  if (apartmentName.includes("2BA")) return 2;
  return 1;
}

export function dishtowelCount(apartmentName: string): number {
  return apartmentName.includes("BR") || apartmentName.includes("ST") ? 1 : 0;
}
