export type Priority = "low" | "medium" | "high";

export type Todo = {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  due_date: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type TodoListResponse = {
  items: Todo[];
  total: number;
  limit: number;
  offset: number;
};

export type TodoStats = {
  total: number;
  active: number;
  completed: number;
  overdue: number;
  by_priority: Record<Priority, number>;
};

export type TodoCreateInput = {
  title: string;
  description?: string | null;
  priority: Priority;
  due_date?: string | null;
};

export type TodoUpdateInput = Partial<TodoCreateInput> & {
  completed?: boolean;
};

export type TodoQuery = {
  completed?: boolean;
  priority?: Priority;
  search?: string;
  sort?: "created_at" | "updated_at" | "due_date" | "priority" | "title";
  order?: "asc" | "desc";
};
