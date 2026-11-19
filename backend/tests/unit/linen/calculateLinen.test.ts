import { describe, expect, it } from "vitest";
import { calculateDefaultLinen, calculateLinen, effectiveGuests } from "../../../src/utils/calculation/calculateLinen.js";
import { parseLinenAttribute } from "../../../src/utils/calculation/parseLinenAttribute.js";
import type { ApartmentCapacity, LinenQuantities } from "../../../src/utils/calculation/types.js";

function capacity(beds: number, bedSpots: number, sofaBeds: number, sofaSpots: number): ApartmentCapacity {
  return { beds, bedSpots, sofaBeds, sofaSpots };
}

function quantities(q: Omit<LinenQuantities, "requestedSofabedsCount"> & { sofa: number }): LinenQuantities {
  return {
    sheets: q.sheets,
    towels: q.towels,
    bathmats: q.bathmats,
    handtowels: q.handtowels,
    dishtowels: q.dishtowels,
    requestedSofabedsCount: q.sofa,
  };
}

describe("PDF examples table", () => {
  const cases: Array<{
    name: string;
    apartment: string;
    capacity: ApartmentCapacity;
    guests: number;
    requestedSofabed: boolean;
    expected: LinenQuantities;
  }> = [
    {
      name: "2BR 3 guests, sofa bed requested",
      apartment: "Aurora 104 2BR",
      capacity: capacity(2, 4, 1, 2),
      guests: 3,
      requestedSofabed: true,
      expected: quantities({ sheets: 3, towels: 6, bathmats: 1, handtowels: 7, dishtowels: 1, sofa: 1 }),
    },
    {
      name: "3BR-2BA 4 guests",
      apartment: "Lumen 301 3BR-2BA",
      capacity: capacity(3, 6, 1, 2),
      guests: 4,
      requestedSofabed: false,
      expected: quantities({ sheets: 3, towels: 6, bathmats: 2, handtowels: 8, dishtowels: 1, sofa: 0 }),
    },
    {
      name: "3BR 4 guests, no sofa bed requested",
      apartment: "Test 3BR",
      capacity: capacity(3, 6, 1, 2),
      guests: 4,
      requestedSofabed: false,
      expected: quantities({ sheets: 3, towels: 6, bathmats: 1, handtowels: 7, dishtowels: 1, sofa: 0 }),
    },
    {
      name: "3BR 4 guests, sofa requested, one of two sofas opened",
      apartment: "Test 3BR",
      capacity: capacity(3, 6, 2, 4),
      guests: 4,
      requestedSofabed: true,
      expected: quantities({ sheets: 4, towels: 7, bathmats: 1, handtowels: 8, dishtowels: 1, sofa: 1 }),
    },
    {
      name: "3BR-2BA 5 guests, sofa requested, both sofas opened",
      apartment: "Test 3BR-2BA",
      capacity: capacity(3, 6, 2, 4),
      guests: 5,
      requestedSofabed: true,
      expected: quantities({ sheets: 5, towels: 10, bathmats: 2, handtowels: 12, dishtowels: 1, sofa: 2 }),
    },
    {
      name: "1BR 4 guests, sofa opened although not requested",
      apartment: "Test 1BR",
      capacity: capacity(1, 2, 1, 2),
      guests: 4,
      requestedSofabed: false,
      expected: quantities({ sheets: 2, towels: 4, bathmats: 1, handtowels: 5, dishtowels: 1, sofa: 1 }),
    },
    {
      name: "2BR 2 guests with override 6",
      apartment: "Test 2BR",
      capacity: capacity(2, 4, 1, 2),
      guests: effectiveGuests(2, 6),
      requestedSofabed: false,
      expected: quantities({ sheets: 3, towels: 6, bathmats: 1, handtowels: 7, dishtowels: 1, sofa: 1 }),
    },
    {
      name: "ST 2 guests, no sofa bed requested",
      apartment: "Aurora 201 ST",
      capacity: capacity(1, 2, 1, 1),
      guests: 2,
      requestedSofabed: false,
      expected: quantities({ sheets: 1, towels: 2, bathmats: 1, handtowels: 3, dishtowels: 1, sofa: 0 }),
    },
    {
      name: "SS 3 guests, no bathroom",
      apartment: "Nova 401 SS",
      capacity: capacity(2, 4, 0, 0),
      guests: 3,
      requestedSofabed: false,
      expected: quantities({ sheets: 2, towels: 4, bathmats: 0, handtowels: 0, dishtowels: 0, sofa: 0 }),
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(
        calculateLinen({
          apartmentName: c.apartment,
          capacity: c.capacity,
          guests: c.guests,
          requestedSofabed: c.requestedSofabed,
        }),
      ).toEqual(c.expected);
    });
  }

  it("default calculation (no next guests) uses beds and bed spots only", () => {
    expect(calculateDefaultLinen("Test 1BR", capacity(1, 2, 1, 2))).toEqual(
      quantities({ sheets: 1, towels: 2, bathmats: 1, handtowels: 3, dishtowels: 1, sofa: 0 }),
    );
  });
});

describe("sofa bed rules", () => {
  it("applies the 1 bed + 1 sofa bed + 2 guests exception", () => {
    expect(
      calculateLinen({
        apartmentName: "Aurora 201 ST",
        capacity: capacity(1, 2, 1, 1),
        guests: 2,
        requestedSofabed: true,
      }),
    ).toEqual(quantities({ sheets: 2, towels: 2, bathmats: 1, handtowels: 3, dishtowels: 1, sofa: 1 }));
  });

  it("does not open a sofa bed for the exception case when none was requested", () => {
    const actual = calculateLinen({
      apartmentName: "Aurora 201 ST",
      capacity: capacity(1, 2, 1, 1),
      guests: 2,
      requestedSofabed: false,
    });
    expect(actual.requestedSofabedsCount).toBe(0);
  });

  it("opens only as many sofa beds as there are guests beyond the beds (partial opening)", () => {
    expect(
      calculateLinen({
        apartmentName: "Lumen 501 2BR",
        capacity: capacity(2, 4, 2, 4),
        guests: 3,
        requestedSofabed: true,
      }),
    ).toEqual(quantities({ sheets: 3, towels: 5, bathmats: 1, handtowels: 6, dishtowels: 1, sofa: 1 }));
  });

  it("opens all sofa beds when guests exceed bed spots, and caps towels by sofa spots", () => {
    expect(
      calculateLinen({
        apartmentName: "Test 1BR",
        capacity: capacity(1, 2, 2, 1),
        guests: 4,
        requestedSofabed: false,
      }),
    ).toEqual(quantities({ sheets: 3, towels: 4, bathmats: 1, handtowels: 5, dishtowels: 1, sofa: 2 }));
  });
});

describe("apartment item rules", () => {
  it("has no handtowels and bathmats without a bathroom", () => {
    const actual = calculateDefaultLinen("Nova 401 SS", capacity(1, 2, 0, 0));
    expect(actual.handtowels).toBe(0);
    expect(actual.bathmats).toBe(0);
  });

  it("has dishtowels only for BR and ST apartments", () => {
    expect(calculateDefaultLinen("Haven 214 2BR", capacity(2, 4, 1, 2)).dishtowels).toBe(1);
    expect(calculateDefaultLinen("Aurora 201 ST", capacity(1, 2, 1, 1)).dishtowels).toBe(1);
    expect(calculateDefaultLinen("Nova 401 SS", capacity(1, 2, 0, 0)).dishtowels).toBe(0);
  });
});

describe("effectiveGuests", () => {
  it("uses the larger of guests_count and the override", () => {
    expect(effectiveGuests(2, 6)).toBe(6);
    expect(effectiveGuests(5, 3)).toBe(5);
    expect(effectiveGuests(2, null)).toBe(2);
  });
});

describe("parseLinenAttribute", () => {
  it("parses the source linen attribute", () => {
    expect(parseLinenAttribute("G:6;Beds:2;BedSpots:4;Sofabeds:1;SofaSpots:2")).toEqual({
      beds: 2,
      bedSpots: 4,
      sofaBeds: 1,
      sofaSpots: 2,
    });
  });

  it("rejects a missing key", () => {
    expect(() => parseLinenAttribute("Beds:2;BedSpots:4;Sofabeds:1")).toThrow(/sofaspots/);
  });

  it("rejects a malformed segment", () => {
    expect(() => parseLinenAttribute("Beds2;BedSpots:4;Sofabeds:1;SofaSpots:2")).toThrow(/Malformed/);
  });
});
