"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  clearCompleted,
  createTodo,
  deleteTodo,
  getStats,
  listTodos,
  toggleTodo,
  updateTodo,
} from "@/lib/api";
import type { Priority, Todo, TodoQuery, TodoStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type StatusFilter = "all" | "active" | "completed";
type SortField = NonNullable<TodoQuery["sort"]>;
type SortOrder = NonNullable<TodoQuery["order"]>;

type FilterState = {
  status: StatusFilter;
  priority: Priority | "all";
  search: string;
  sort: SortField;
  order: SortOrder;
};

type TodoFormState = {
  title: string;
  description: string;
  priority: Priority;
  due_date: string;
};

const initialForm: TodoFormState = {
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
};

const priorityStyles: Record<Priority, string> = {
  high: "border-red-200 bg-red-50 text-red-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function formatDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function isOverdue(todo: Todo) {
  if (!todo.due_date || todo.completed) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${todo.due_date}T00:00:00`);

  return dueDate < today;
}

export function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<TodoStats | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    priority: "all",
    search: "",
    sort: "created_at",
    order: "desc",
  });
  const [form, setForm] = useState<TodoFormState>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workingId, setWorkingId] = useState<number | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo<TodoQuery>(() => {
    return {
      completed:
        filters.status === "completed"
          ? true
          : filters.status === "active"
            ? false
            : undefined,
      priority: filters.priority === "all" ? undefined : filters.priority,
      search: filters.search.trim() || undefined,
      sort: filters.sort,
      order: filters.order,
    };
  }, [filters]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [todoResponse, statsResponse] = await Promise.all([
        listTodos(query),
        getStats(),
      ]);
      setTodos(todoResponse.items);
      setStats(statsResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load todos.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createTodo({
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        due_date: form.due_date || null,
      });
      setForm(initialForm);
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create the task.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(id: number) {
    setWorkingId(id);
    setError(null);

    try {
      await toggleTodo(id);
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update the task.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function handlePriorityChange(id: number, priority: Priority) {
    setWorkingId(id);
    setError(null);

    try {
      await updateTodo(id, { priority });
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update priority.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function handleDelete(id: number) {
    setWorkingId(id);
    setError(null);

    try {
      await deleteTodo(id);
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not delete the task.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function handleClearCompleted() {
    setWorkingId("clear");
    setError(null);

    try {
      await clearCompleted();
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not clear completed tasks.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  const statCards = [
    {
      label: "Total",
      value: stats?.total ?? 0,
      icon: ClipboardList,
      className: "bg-white",
    },
    {
      label: "Active",
      value: stats?.active ?? 0,
      icon: XCircle,
      className: "bg-cyan-50",
    },
    {
      label: "Done",
      value: stats?.completed ?? 0,
      icon: CheckCircle2,
      className: "bg-emerald-50",
    },
    {
      label: "Overdue",
      value: stats?.overdue ?? 0,
      icon: AlertCircle,
      className: "bg-red-50",
    },
  ];

  return (
    <main className="min-h-screen">
      <section className="border-b bg-card/80">
        <div className="container flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Full-stack practice</p>
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              Todo Desk
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Capture daily work, sort priorities, and keep completion visible.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadData()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </section>

      <section className="container space-y-6 py-6">
        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} className={cn("shadow-none", item.className)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-card">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>New task</CardTitle>
              <CardDescription>
                Add title, context, priority, and an optional due date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreate}>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={form.title}
                    maxLength={160}
                    placeholder="Prepare project notes"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    maxLength={2000}
                    placeholder="Add useful details"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      id="priority"
                      value={form.priority}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          priority: event.target.value as Priority,
                        }))
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={form.due_date}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          due_date: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!form.title.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add task
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="shadow-none">
              <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_140px_150px_140px_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search tasks"
                    className="pl-9"
                    value={filters.search}
                    placeholder="Search tasks"
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                  />
                </div>

                <Select
                  aria-label="Filter status"
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value as StatusFilter,
                    }))
                  }
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </Select>

                <Select
                  aria-label="Filter priority"
                  value={filters.priority}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      priority: event.target.value as Priority | "all",
                    }))
                  }
                >
                  <option value="all">All priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>

                <Select
                  aria-label="Sort tasks"
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      sort: event.target.value as SortField,
                    }))
                  }
                >
                  <option value="created_at">Created</option>
                  <option value="updated_at">Updated</option>
                  <option value="due_date">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="title">Title</option>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  disabled={workingId === "clear" || (stats?.completed ?? 0) === 0}
                  onClick={() => void handleClearCompleted()}
                >
                  {workingId === "clear" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Clear
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {isLoading && todos.length === 0 ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="shadow-none">
                    <CardContent className="space-y-3 p-4">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-full animate-pulse rounded bg-muted" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    </CardContent>
                  </Card>
                ))
              ) : todos.length === 0 ? (
                <Card className="shadow-none">
                  <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                    <ClipboardList className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <h2 className="text-lg font-semibold">No tasks found</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Try a different filter or add a fresh task.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                todos.map((todo) => (
                  <Card
                    key={todo.id}
                    className={cn(
                      "shadow-none transition-colors",
                      todo.completed && "bg-muted/60",
                    )}
                  >
                    <CardContent className="flex gap-4 p-4">
                      <Checkbox
                        aria-label={`Toggle ${todo.title}`}
                        checked={todo.completed}
                        disabled={workingId === todo.id}
                        onCheckedChange={() => void handleToggle(todo.id)}
                      />

                      <div className="min-w-0 flex-1 space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <h2
                              className={cn(
                                "break-words text-base font-semibold leading-6",
                                todo.completed &&
                                  "text-muted-foreground line-through",
                              )}
                            >
                              {todo.title}
                            </h2>
                            {todo.description ? (
                              <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
                                {todo.description}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <Badge className={priorityStyles[todo.priority]}>
                              {todo.priority}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Delete task"
                              aria-label={`Delete ${todo.title}`}
                              disabled={workingId === todo.id}
                              onClick={() => void handleDelete(todo.id)}
                            >
                              {workingId === todo.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="h-4 w-4" />
                              {formatDate(todo.due_date)}
                            </span>
                            {todo.completed ? (
                              <Badge variant="success">Completed</Badge>
                            ) : isOverdue(todo) ? (
                              <Badge variant="danger">Overdue</Badge>
                            ) : null}
                          </div>

                          <Select
                            aria-label={`Change priority for ${todo.title}`}
                            className="h-9 w-full sm:w-36"
                            value={todo.priority}
                            disabled={workingId === todo.id}
                            onChange={(event) =>
                              void handlePriorityChange(
                                todo.id,
                                event.target.value as Priority,
                              )
                            }
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
