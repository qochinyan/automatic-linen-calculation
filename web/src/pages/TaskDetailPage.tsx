import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchTask, fetchTaskHistory, type HistoryEntry, type LinenValues, type TaskDetail } from "../api";
import { Card, Field, LinenTile, Message, Skeleton, StatusBadge, YesNo } from "../components/ui";
import { formatDateTime, formatOptional } from "../format";

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
  { key: "requested_sofabeds_count", label: "Sofa beds opened" },
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

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link to="/tasks" className="hover:text-slate-900">
          Tasks
        </Link>
        <span className="mx-2">/</span>
        <span className="font-medium text-slate-900">{taskId}</span>
      </nav>

      {error && (
        <Message tone="error">
          {error}. <Link to="/tasks" className="font-medium underline">Back to tasks</Link>
        </Message>
      )}
      {!error && !data && <DetailSkeleton />}
      {!error && data && <TaskDetailContent detail={data.detail} history={data.history} />}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

function TaskDetailContent({ detail, history }: PageData) {
  const { task, apartment, reservation, linen } = detail;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{task.task_type}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{task.task_id}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {formatOptional(apartment?.name)} · starts {formatDateTime(task.planned_start)}
            </p>
          </div>
          <StatusBadge status={task.status} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Reservation" subtitle="Guests of the reservation this task follows">
          {reservation ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Reservation">
                <span className="font-mono text-xs">{reservation.reservation_id}</span>
              </Field>
              <Field label="Status">{reservation.status}</Field>
              <Field label="Arrival">{formatDateTime(reservation.planned_arrival_time)}</Field>
              <Field label="Departure">{formatDateTime(reservation.planned_departure_time)}</Field>
              <Field label="Guests">{reservation.guests_count}</Field>
              <Field label="Infants">{reservation.infants}</Field>
              <Field label="Guest override">{formatOptional(reservation.number_of_guests_override)}</Field>
              <Field label="Sofa bed requested">
                <YesNo value={reservation.requested_sofabed} />
              </Field>
            </dl>
          ) : (
            <Message>No reservation found for this task.</Message>
          )}
        </Card>

        <Card title="Apartment & schedule">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
            <Field label="Apartment">{formatOptional(apartment?.name)}</Field>
            <Field label="Listing ID">
              <span className="font-mono text-xs">{formatOptional(task.listing_id)}</span>
            </Field>
            <Field label="Planned start">{formatDateTime(task.planned_start)}</Field>
            <Field label="Task status">{task.status}</Field>
          </dl>
        </Card>
      </div>

      {linen && (
        <Card
          title="Linen to prepare"
          subtitle={`Based on reservation ${linen.source_reservation_id}, calculated ${formatDateTime(linen.calculated_at)}`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <LinenTile label="Towels" value={linen.towels} />
            <LinenTile label="Sheets" value={linen.sheets} />
            <LinenTile label="Bathmats" value={linen.bathmats} />
            <LinenTile label="Handtowels" value={linen.handtowels} />
            <LinenTile label="Dishtowels" value={linen.dishtowels} />
            <LinenTile label="Total guests" value={linen.prepared_for_guests} />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-100 pt-5 sm:grid-cols-4">
            <Field label="Infants (in total)">{linen.infants}</Field>
            <Field label="Sofa bed requested">
              <YesNo value={linen.requested_sofabed} />
            </Field>
            {linen.requested_sofabeds_count > 0 && (
              <Field label="Sofa beds to open">{linen.requested_sofabeds_count}</Field>
            )}
            <Field label="Guests (source)">{linen.actual_guests}</Field>
          </dl>
        </Card>
      )}

      <Card title="Change history" subtitle="Every recalculation of this task's linen">
        {history.length === 0 ? (
          <Message>No recalculations recorded for this task.</Message>
        ) : (
          <ol className="relative ml-2 space-y-6 border-l border-slate-200">
            {history.map((entry) => (
              <li key={entry.id} className="ml-6">
                <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-500 shadow" />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm font-medium text-slate-900">{entry.reason}</p>
                  <time className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</time>
                  {entry.event_id && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                      {entry.event_id}
                    </span>
                  )}
                </div>
                <ChangeList oldValues={entry.old_values} newValues={entry.new_values} />
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}

function ChangeList({ oldValues, newValues }: { oldValues: LinenValues | null; newValues: LinenValues | null }) {
  if (!newValues) {
    return <p className="mt-2 text-sm text-rose-600">Linen record removed{oldValues ? ` (was ${oldValues.towels} towels)` : ""}.</p>;
  }

  const changes = LINEN_FIELDS.flatMap(({ key, label }) => {
    const before = oldValues ? oldValues[key] : null;
    const after = newValues[key];
    return before === after ? [] : [{ label, before, after }];
  });

  if (!oldValues) {
    return <p className="mt-2 text-sm text-emerald-700">Linen calculated for the first time.</p>;
  }
  if (changes.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">Source reservation or guest data changed; quantities unchanged.</p>;
  }

  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {changes.map((change) => (
        <li key={change.label} className="rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-700 ring-1 ring-inset ring-slate-200">
          <span className="font-medium">{change.label}</span>{" "}
          <span className="text-slate-400">{formatOptional(change.before)}</span>
          <span className="mx-1 text-slate-400">→</span>
          <span className="font-semibold text-slate-900">{formatOptional(change.after)}</span>
        </li>
      ))}
    </ul>
  );
}
