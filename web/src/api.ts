import type { HistoryEntry, TaskDetail, TaskListItem } from "./types/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`);
  if (!response.ok) {
    throw new ApiError(response.status, `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchTasks(): Promise<TaskListItem[]> {
  return getJson<TaskListItem[]>("/tasks");
}

export function fetchTask(taskId: string): Promise<TaskDetail> {
  return getJson<TaskDetail>(`/tasks/${encodeURIComponent(taskId)}`);
}

export function fetchTaskHistory(taskId: string): Promise<HistoryEntry[]> {
  return getJson<HistoryEntry[]>(`/tasks/${encodeURIComponent(taskId)}/linen/history`);
}
