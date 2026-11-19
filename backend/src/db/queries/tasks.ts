import type { Db, TaskColumn, TaskRow, TaskValues } from "../types.js";

export function loadTask(db: Db, taskId: string): TaskRow | null {
  return (
    db
      .prepare<[string], TaskRow>(
        `SELECT task_id, task_type, status, listing_id, reservation_id, planned_start
         FROM tasks WHERE task_id = ?`,
      )
      .get(taskId) ?? null
  );
}

export function loadMainCleaningTaskIds(db: Db): string[] {
  return db
    .prepare<[], { task_id: string }>(`SELECT task_id FROM tasks WHERE task_type = 'Main Cleaning' ORDER BY task_id`)
    .all()
    .map((row) => row.task_id);
}

export function insertTask(db: Db, task: TaskValues): void {
  db.prepare(
    `INSERT INTO tasks (task_id, task_type, status, listing_id, reservation_id, planned_start)
     VALUES (@task_id, @task_type, @status, @listing_id, @reservation_id, @planned_start)`,
  ).run(task);
}

const TASK_COLUMNS: readonly TaskColumn[] = ["task_type", "status", "listing_id", "reservation_id", "planned_start"];

export function updateTaskColumns(db: Db, taskId: string, values: Partial<Record<TaskColumn, string | null>>): void {
  const entries = TASK_COLUMNS.filter((column) => values[column] !== undefined).map((column) => [column, values[column]] as const);
  if (entries.length === 0) return;
  const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
  db.prepare(`UPDATE tasks SET ${assignments} WHERE task_id = ?`).run(...entries.map(([, value]) => value), taskId);
}

export function moveOpenTasksToListing(db: Db, reservationId: string, listingId: string): void {
  db.prepare(
    `UPDATE tasks SET listing_id = ?
     WHERE reservation_id = ? AND status NOT IN ('Completed', 'Cancelled')`,
  ).run(listingId, reservationId);
}
