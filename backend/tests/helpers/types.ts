export interface LinenJson {
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
}

export interface TaskJson {
  task: { task_id: string; listing_id: string | null; planned_start: string; status: string };
  apartment: { listing_id: string; name: string } | null;
  linen: LinenJson | null;
}

export interface HistoryJson {
  id: number;
  reason: string;
  event_id: string | null;
  old_values: Partial<LinenJson> | null;
  new_values: Partial<LinenJson> | null;
  created_at: string;
}

export interface EventResponseJson {
  status: "processed" | "duplicate";
  recalculated_task_ids: string[];
}
