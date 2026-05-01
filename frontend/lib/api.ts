import type {
  Todo,
  TodoCreateInput,
  TodoListResponse,
  TodoQuery,
  TodoStats,
  TodoUpdateInput,
} from "@/lib/types";

const DEFAULT_API_URL = "https://badar-todolist.fastapicloud.dev";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? DEFAULT_API_URL;

function buildQuery(params: TodoQuery = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Keep the status message when the API returns no JSON body.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function listTodos(params: TodoQuery = {}) {
  return request<TodoListResponse>(`/api/todos${buildQuery(params)}`);
}

export function getStats() {
  return request<TodoStats>("/api/todos/stats");
}

export function createTodo(payload: TodoCreateInput) {
  return request<Todo>("/api/todos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTodo(id: number, payload: TodoUpdateInput) {
  return request<Todo>(`/api/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function toggleTodo(id: number) {
  return request<Todo>(`/api/todos/${id}/toggle`, {
    method: "POST",
  });
}

export function deleteTodo(id: number) {
  return request<void>(`/api/todos/${id}`, {
    method: "DELETE",
  });
}

export function clearCompleted() {
  return request<{ deleted: number }>("/api/todos/completed", {
    method: "DELETE",
  });
}
