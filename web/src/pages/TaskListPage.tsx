import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTasks, type TaskListItem } from "../api";
import { Card, Message, Skeleton, StatCard, StatusBadge } from "../components/ui";
import { formatDateTime, formatOptional } from "../format";

const STATUSES = ["Pending", "In Progress", "Paused", "Completed", "Cancelled"] as const;
const CLOSED_STATUSES = new Set<string>(["Completed", "Cancelled"]);

export function TaskListPage() {
  const [tasks, setTasks] = useState<TaskListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

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

  const stats = useMemo(() => {
    if (!tasks) return null;
    return {
      total: tasks.length,
      open: tasks.filter((task) => !CLOSED_STATUSES.has(task.status)).length,
      completed: tasks.filter((task) => task.status === "Completed").length,
      withLinen: tasks.filter((task) => task.linen !== null).length,
    };
  }, [tasks]);

  const visible = useMemo(() => {
    if (!tasks) return [];
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== "All" && task.status !== statusFilter) return false;
      if (!needle) return true;
      return [task.task_id, task.task_type, task.apartment_name, task.reservation_id].some((value) =>
        value?.toLowerCase().includes(needle),
      );
    });
  }, [tasks, query, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Cleaning tasks</h1>
        <p className="mt-1 text-sm text-slate-500">Linen to prepare for each Main Cleaning task.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard label="All tasks" value={stats.total} />
            <StatCard label="Open" value={stats.open} hint="Not completed or cancelled" />
            <StatCard label="Completed" value={stats.completed} />
            <StatCard label="With linen" value={stats.withLinen} hint="Linen record calculated" />
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)
        )}
      </div>

      <Card
        title="Tasks"
        subtitle={tasks ? `Showing ${visible.length} of ${tasks.length}` : undefined}
        action={
          tasks && (
            <div className="flex gap-2">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search task, apartment, reservation"
                className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="All">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          )
        }
        className="overflow-hidden p-0"
      >
        {error && <Message tone="error">{error}</Message>}
        {!error && !tasks && (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        )}
        {!error && tasks && tasks.length === 0 && <Message>No tasks found. Run the seed to load data.</Message>}
        {!error && tasks && tasks.length > 0 && visible.length === 0 && (
          <Message>No tasks match your search.</Message>
        )}
        {!error && tasks && visible.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Task</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Apartment</th>
                  <th className="px-5 py-3">Reservation</th>
                  <th className="px-5 py-3">Planned start</th>
                  <th className="px-5 py-3">Linen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visible.map((task) => (
                  <tr key={task.task_id} className="transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3">
                      <Link
                        to={`/tasks/${encodeURIComponent(task.task_id)}`}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {task.task_id}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{task.task_type}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-900">{formatOptional(task.apartment_name)}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-600">
                      {formatOptional(task.reservation_id)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDateTime(task.planned_start)}</td>
                    <td className="px-5 py-3">
                      {task.linen ? (
                        <div className="flex gap-1.5">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {task.linen.sheets} sheets
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {task.linen.towels} towels
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
