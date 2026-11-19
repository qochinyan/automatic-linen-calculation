export interface ApartmentCapacity {
  beds: number;
  bedSpots: number;
  sofaBeds: number;
  sofaSpots: number;
}

export interface LinenQuantities {
  sheets: number;
  towels: number;
  bathmats: number;
  handtowels: number;
  dishtowels: number;
  requestedSofabedsCount: number;
}

export interface LinenRequest {
  apartmentName: string;
  capacity: ApartmentCapacity;
  guests: number;
  requestedSofabed: boolean;
}
