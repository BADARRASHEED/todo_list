# Todo List API

FastAPI backend with SQLite persistence, validation, CORS, search/filtering, stats,
and interactive API docs.

## Local setup

```powershell
cd backend
uv sync
uv run fastapi dev main.py --host 127.0.0.1 --port 8000
```

Useful URLs:

- API root: `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

## Environment

```powershell
$env:TODO_DB_PATH="todos.db"
$env:CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
```

## Production command

```powershell
uv run fastapi run main.py --host 0.0.0.0 --port 8000
```

If your host provides `$PORT`, use that port in the start command.
