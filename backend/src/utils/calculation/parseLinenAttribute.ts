import type { ApartmentCapacity } from "./types.js";

const REQUIRED_KEYS = ["beds", "bedspots", "sofabeds", "sofaspots"] as const;

export function parseLinenAttribute(raw: string): ApartmentCapacity {
  const values = new Map<string, number>();

  for (const part of raw.split(";")) {
    const separator = part.indexOf(":");
    if (separator === -1) {
      throw new Error(`Malformed linen attribute segment "${part}" in "${raw}"`);
    }
    const key = part.slice(0, separator).trim().toLowerCase();
    const value = Number(part.slice(separator + 1).trim());
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Linen attribute "${key}" must be a non-negative integer in "${raw}"`);
    }
    values.set(key, value);
  }

  for (const key of REQUIRED_KEYS) {
    if (!values.has(key)) {
      throw new Error(`Linen attribute "${raw}" is missing "${key}"`);
    }
  }

  return {
    beds: values.get("beds")!,
    bedSpots: values.get("bedspots")!,
    sofaBeds: values.get("sofabeds")!,
    sofaSpots: values.get("sofaspots")!,
  };
}
