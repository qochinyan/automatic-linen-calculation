import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchTask, fetchTaskHistory, type HistoryEntry, type LinenValues, type TaskDetail } from "../api";
import { formatDateTime, formatOptional, formatYesNo } from "../format";

interface PageData {
  detail: TaskDetail;
  history: HistoryEntry[];
}

type LinenCountKey = "sheets" | "towels" | "bathmats" | "handtowels" | "dishtowels" | "requested_sofabeds_count";

const LINEN_FIELDS: Array<{ key: LinenCountKey; label: string }> = [
  { key: "sheets", label: "Sheets" },
  { key: "towels", label: "Towels" },
  { key: "bathmats", label: "Bathmats" },
  { key: "handtowels", label: "Handtowels" },
  { key: "dishtowels", label: "Dishtowels" },
  { key: "requested_sofabeds_count", label: "Opened sofa beds" },
];

export function TaskDetailPage() {
  const { taskId = "" } = useParams();
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    Promise.all([fetchTask(taskId), fetchTaskHistory(taskId)])
      .then(([detail, history]) => {
        if (!cancelled) setData({ detail, history });
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Failed to load task");
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (error) {
    return (
      <p className="message error">
        {error} <Link to="/tasks">Back to tasks</Link>
      </p>
    );
  }
  if (!data) return <p className="message">Loading task…</p>;

  const { detail, history } = data;
  const { task, apartment, reservation, linen } = detail;

  return (
    <article className="task-detail">
      <p>
        <Link to="/tasks">← All tasks</Link>
      </p>
      <h2>
        {task.task_id} <span className="muted">({task.task_type})</span>
      </h2>

      <section>
        <h3>Task</h3>
        <dl>
          <dt>Status</dt>
          <dd>{task.status}</dd>
          <dt>Planned start</dt>
          <dd>{formatDateTime(task.planned_start)}</dd>
          <dt>Apartment</dt>
          <dd>{formatOptional(apartment?.name)}</dd>
          <dt>Reservation</dt>
          <dd>{formatOptional(task.reservation_id)}</dd>
        </dl>
      </section>

      <section>
        <h3>Reservation</h3>
        {reservation ? (
          <dl>
            <dt>Status</dt>
            <dd>{reservation.status}</dd>
            <dt>Arrival</dt>
            <dd>{formatDateTime(reservation.planned_arrival_time)}</dd>
            <dt>Departure</dt>
            <dd>{formatDateTime(reservation.planned_departure_time)}</dd>
            <dt>Guests (source)</dt>
            <dd>{reservation.guests_count}</dd>
            <dt>Infants</dt>
            <dd>{reservation.infants}</dd>
            <dt>Guest override</dt>
            <dd>{formatOptional(reservation.number_of_guests_override)}</dd>
            <dt>Requested sofa bed</dt>
            <dd>{formatYesNo(reservation.requested_sofabed)}</dd>
          </dl>
        ) : (
          <p className="muted">No reservation found for this task.</p>
        )}
      </section>

      {linen && (
        <section>
          <h3>Linen</h3>
          <p className="muted">
            Prepared for reservation {linen.source_reservation_id}, calculated {formatDateTime(linen.calculated_at)}
          </p>
          <dl>
            <dt>Towels</dt>
            <dd>{linen.towels}</dd>
            <dt>Sheets</dt>
            <dd>{linen.sheets}</dd>
            <dt>Bathmats</dt>
            <dd>{linen.bathmats}</dd>
            <dt>Handtowels</dt>
            <dd>{linen.handtowels}</dd>
            <dt>Dishtowels</dt>
            <dd>{linen.dishtowels}</dd>
            <dt>Total guests</dt>
            <dd>{linen.prepared_for_guests}</dd>
            <dt>Infants (included in total)</dt>
            <dd>{linen.infants}</dd>
            <dt>Requested sofa bed</dt>
            <dd>{formatYesNo(linen.requested_sofabed)}</dd>
            {linen.requested_sofabeds_count > 0 && (
              <>
                <dt>Requested sofa beds count</dt>
                <dd>{linen.requested_sofabeds_count}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      <section>
        <h3>Linen history</h3>
        {history.length === 0 ? (
          <p className="muted">No recalculations recorded.</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Reason</th>
                <th>Event</th>
                <th>Changes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.created_at)}</td>
                  <td>{entry.reason}</td>
                  <td>{formatOptional(entry.event_id)}</td>
                  <td>{describeChanges(entry.old_values, entry.new_values)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </article>
  );
}

function describeChanges(oldValues: LinenValues | null, newValues: LinenValues | null): string {
  if (!newValues) return "Linen record removed";
  const changes = LINEN_FIELDS.flatMap(({ key, label }) => {
    const before = oldValues ? oldValues[key] : null;
    const after = newValues[key];
    if (before === after) return [];
    return [`${label}: ${formatOptional(before)} → ${formatOptional(after)}`];
  });
  if (!oldValues) return `Linen created (${changes.join(", ")})`;
  return changes.length > 0 ? changes.join("; ") : "Source reservation or guest data changed";
}
