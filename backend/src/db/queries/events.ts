import type { Db } from "../types.js";

export function recordProcessedEvent(
  db: Db,
  event: { event_id: string; aggregate_id: string; event_type: string },
  processedAt: string,
): boolean {
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO processed_events (event_id, aggregate_id, event_type, processed_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(event.event_id, event.aggregate_id, event.event_type, processedAt);
  return result.changes === 1;
}
