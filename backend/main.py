from __future__ import annotations

import os
import sqlite3
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


Priority = Literal["low", "medium", "high"]
SortField = Literal["created_at", "updated_at", "due_date", "priority", "title"]
SortOrder = Literal["asc", "desc"]


@dataclass(frozen=True)
class Settings:
    app_name: str
    database_path: Path
    cors_origins: list[str]
    cors_origin_regex: str | None


def load_settings() -> Settings:
    database_path = Path(
        os.getenv("TODO_DB_PATH", Path(__file__).with_name("todos.db"))
    ).resolve()
    cors_origins = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]

    return Settings(
        app_name=os.getenv("APP_NAME", "Todo List API"),
        database_path=database_path,
        cors_origins=cors_origins,
        cors_origin_regex=os.getenv(
            "CORS_ORIGIN_REGEX",
            r"https://.*\.vercel\.app",
        ),
    )


settings = load_settings()


class TodoBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2_000)
    priority: Priority = "medium"
    due_date: date | None = None


class TodoCreate(TodoBase):
    pass


class TodoUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2_000)
    priority: Priority | None = None
    due_date: date | None = None
    completed: bool | None = None


class TodoRead(TodoBase):
    id: int
    completed: bool
    created_at: datetime
    updated_at: datetime


class TodoListResponse(BaseModel):
    items: list[TodoRead]
    total: int
    limit: int
    offset: int


class TodoStats(BaseModel):
    total: int
    active: int
    completed: int
    overdue: int
    by_priority: dict[Priority, int]


class BulkDeleteResponse(BaseModel):
    deleted: int


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(settings.database_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


def get_db():
    connection = connect()
    try:
        yield connection
    finally:
        connection.close()


def initialize_database() -> None:
    with connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT NOT NULL DEFAULT 'medium'
                    CHECK(priority IN ('low', 'medium', 'high')),
                due_date TEXT,
                completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_todos_completed
                ON todos(completed);
            CREATE INDEX IF NOT EXISTS idx_todos_priority
                ON todos(priority);
            CREATE INDEX IF NOT EXISTS idx_todos_due_date
                ON todos(due_date);
            """
        )


def normalize_description(value: str | None) -> str | None:
    if value is None:
        return None

    stripped = value.strip()
    return stripped or None


def row_to_todo(row: sqlite3.Row) -> TodoRead:
    data = dict(row)
    data["completed"] = bool(data["completed"])
    return TodoRead.model_validate(data)


def get_todo_or_404(connection: sqlite3.Connection, todo_id: int) -> TodoRead:
    row = connection.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id {todo_id} was not found.",
        )

    return row_to_todo(row)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title=settings.app_name,
    summary="A polished FastAPI backend for a full-stack todo list app.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials="*" not in settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "status": "ready",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "database": str(settings.database_path),
        "time": utc_now(),
    }


@app.get("/api/todos", response_model=TodoListResponse, tags=["todos"])
def list_todos(
    db: Annotated[sqlite3.Connection, Depends(get_db)],
    completed: Annotated[
        bool | None,
        Query(description="Filter by completion state."),
    ] = None,
    priority: Annotated[
        Priority | None,
        Query(description="Filter by priority."),
    ] = None,
    search: Annotated[
        str | None,
        Query(min_length=1, max_length=120, description="Search title/description."),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: SortField = "created_at",
    order: SortOrder = "desc",
) -> TodoListResponse:
    clauses: list[str] = []
    params: list[object] = []

    if completed is not None:
        clauses.append("completed = ?")
        params.append(1 if completed else 0)

    if priority is not None:
        clauses.append("priority = ?")
        params.append(priority)

    if search is not None:
        pattern = f"%{search.lower()}%"
        clauses.append("(LOWER(title) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?)")
        params.extend([pattern, pattern])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    order_direction = "ASC" if order == "asc" else "DESC"
    sort_columns = {
        "created_at": "created_at",
        "updated_at": "updated_at",
        "due_date": "due_date",
        "priority": "CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END",
        "title": "LOWER(title)",
    }
    order_sql = sort_columns[sort]

    total = db.execute(
        f"SELECT COUNT(*) FROM todos {where_sql}",
        params,
    ).fetchone()[0]
    rows = db.execute(
        f"""
        SELECT * FROM todos
        {where_sql}
        ORDER BY {order_sql} {order_direction}, id {order_direction}
        LIMIT ? OFFSET ?
        """,
        [*params, limit, offset],
    ).fetchall()

    return TodoListResponse(
        items=[row_to_todo(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@app.get("/api/todos/stats", response_model=TodoStats, tags=["todos"])
def todo_stats(db: Annotated[sqlite3.Connection, Depends(get_db)]) -> TodoStats:
    counts = db.execute(
        """
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed,
            SUM(
                CASE
                    WHEN completed = 0
                        AND due_date IS NOT NULL
                        AND due_date < DATE('now')
                    THEN 1
                    ELSE 0
                END
            ) AS overdue
        FROM todos
        """
    ).fetchone()
    priority_rows = db.execute(
        "SELECT priority, COUNT(*) AS count FROM todos GROUP BY priority"
    ).fetchall()
    by_priority: dict[Priority, int] = {"low": 0, "medium": 0, "high": 0}

    for row in priority_rows:
        by_priority[row["priority"]] = row["count"]

    return TodoStats(
        total=counts["total"] or 0,
        active=counts["active"] or 0,
        completed=counts["completed"] or 0,
        overdue=counts["overdue"] or 0,
        by_priority=by_priority,
    )


@app.post(
    "/api/todos",
    response_model=TodoRead,
    status_code=status.HTTP_201_CREATED,
    tags=["todos"],
)
def create_todo(
    payload: TodoCreate,
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> TodoRead:
    now = utc_now()
    cursor = db.execute(
        """
        INSERT INTO todos (
            title,
            description,
            priority,
            due_date,
            completed,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, 0, ?, ?)
        """,
        (
            payload.title,
            normalize_description(payload.description),
            payload.priority,
            payload.due_date.isoformat() if payload.due_date else None,
            now,
            now,
        ),
    )
    db.commit()

    return get_todo_or_404(db, cursor.lastrowid)


@app.delete(
    "/api/todos/completed",
    response_model=BulkDeleteResponse,
    tags=["todos"],
)
def clear_completed(
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> BulkDeleteResponse:
    cursor = db.execute("DELETE FROM todos WHERE completed = 1")
    db.commit()
    return BulkDeleteResponse(deleted=cursor.rowcount)


@app.get("/api/todos/{todo_id}", response_model=TodoRead, tags=["todos"])
def get_todo(
    todo_id: int,
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> TodoRead:
    return get_todo_or_404(db, todo_id)


@app.patch("/api/todos/{todo_id}", response_model=TodoRead, tags=["todos"])
def update_todo(
    todo_id: int,
    payload: TodoUpdate,
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> TodoRead:
    get_todo_or_404(db, todo_id)
    update_data = payload.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Send at least one field to update.",
        )

    if "description" in update_data:
        update_data["description"] = normalize_description(update_data["description"])
    if "due_date" in update_data and update_data["due_date"] is not None:
        update_data["due_date"] = update_data["due_date"].isoformat()
    if "completed" in update_data:
        update_data["completed"] = 1 if update_data["completed"] else 0

    update_data["updated_at"] = utc_now()
    assignments = ", ".join(f"{field} = ?" for field in update_data)

    db.execute(
        f"UPDATE todos SET {assignments} WHERE id = ?",
        [*update_data.values(), todo_id],
    )
    db.commit()

    return get_todo_or_404(db, todo_id)


@app.post("/api/todos/{todo_id}/toggle", response_model=TodoRead, tags=["todos"])
def toggle_todo(
    todo_id: int,
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> TodoRead:
    todo = get_todo_or_404(db, todo_id)
    now = utc_now()
    db.execute(
        "UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?",
        (0 if todo.completed else 1, now, todo_id),
    )
    db.commit()

    return get_todo_or_404(db, todo_id)


@app.delete(
    "/api/todos/{todo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["todos"],
)
def delete_todo(
    todo_id: int,
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> Response:
    cursor = db.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    db.commit()

    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Todo with id {todo_id} was not found.",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "true").lower() == "true",
    )
