export interface LinenSummary {
  sheets: number;
  towels: number;
}

export interface TaskListItem {
  task_id: string;
  task_type: string;
  status: string;
  listing_id: string | null;
  apartment_name: string | null;
  reservation_id: string | null;
  planned_start: string;
  linen: LinenSummary | null;
}

export interface TaskDetail {
  task: {
    task_id: string;
    task_type: string;
    status: string;
    listing_id: string | null;
    reservation_id: string | null;
    planned_start: string;
  };
  apartment: { listing_id: string; name: string } | null;
  reservation: {
    reservation_id: string;
    listing_id: string;
    status: string;
    planned_arrival_time: string;
    planned_departure_time: string;
    guests_count: number;
    infants: number;
    number_of_guests_override: number | null;
    requested_sofabed: boolean;
  } | null;
  linen: {
    prepared_for_guests: number;
    sheets: number;
    towels: number;
    bathmats: number;
    handtowels: number;
    dishtowels: number;
    requested_sofabeds_count: number;
    source_reservation_id: string;
    actual_guests: number;
    infants: number;
    number_of_guests_override: number | null;
    requested_sofabed: boolean;
    calculated_at: string;
  } | null;
}

export interface LinenValues {
  sheets: number;
  towels: number;
  bathmats: number;
  handtowels: number;
  dishtowels: number;
  requested_sofabeds_count: number;
  source_reservation_id: string;
  actual_guests: number;
  infants: number;
  number_of_guests_override: number | null;
  requested_sofabed: boolean;
}

export interface HistoryEntry {
  id: number;
  reason: string;
  event_id: string | null;
  old_values: LinenValues | null;
  new_values: LinenValues | null;
  created_at: string;
}
