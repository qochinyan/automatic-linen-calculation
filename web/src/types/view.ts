import type { HistoryEntry, TaskDetail } from "./api";

export interface PageData {
  detail: TaskDetail;
  history: HistoryEntry[];
}

export type LinenCountKey =
  | "sheets"
  | "towels"
  | "bathmats"
  | "handtowels"
  | "dishtowels"
  | "requested_sofabeds_count";
