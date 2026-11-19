import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTasks, type TaskListItem } from "../api";
import { formatDateTime, formatOptional } from "../format";

export function TaskListPage() {
  const [tasks, setTasks] = useState<TaskListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTasks()
      .then((items) => {
        if (!cancelled) setTasks(items);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Failed to load tasks");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="message error">{error}</p>;
  if (!tasks) return <p className="message">Loading tasks…</p>;
  if (tasks.length === 0) return <p className="message">No tasks found.</p>;

  return (
    <table className="task-table">
      <thead>
        <tr>
          <th>Task ID</th>
          <th>Type</th>
          <th>Status</th>
          <th>Apartment</th>
          <th>Reservation</th>
          <th>Planned start</th>
          <th>Linen (sheets / towels)</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.task_id}>
            <td>
              <Link to={`/tasks/${encodeURIComponent(task.task_id)}`}>{task.task_id}</Link>
            </td>
            <td>{task.task_type}</td>
            <td>
              <span className={`status status-${task.status.replace(/\s+/g, "-").toLowerCase()}`}>{task.status}</span>
            </td>
            <td>{formatOptional(task.apartment_name)}</td>
            <td>{formatOptional(task.reservation_id)}</td>
            <td>{formatDateTime(task.planned_start)}</td>
            <td>{task.linen ? `${task.linen.sheets} / ${task.linen.towels}` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
