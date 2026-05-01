# Full-Stack Todo List

FastAPI backend plus Next.js frontend with shadcn-style components.

## Backend

```powershell
cd backend
uv sync
uv run fastapi dev
```

Open:

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

Environment:

```powershell
$env:TODO_DB_PATH="todos.db"
$env:CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
```

## Frontend

```powershell
cd frontend
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open `http://localhost:3000`.

If your backend is deployed, set this in `frontend/.env.local`:

```powershell
NEXT_PUBLIC_API_URL=https://your-fastapi-cloud-url.fastapicloud.dev
```

## Deploy Backend To FastAPI Cloud

```powershell
cd backend
uv sync
uv run fastapi login
uv run fastapi deploy
```

For your deployed frontend domain, update CORS in FastAPI Cloud:

```powershell
uv run fastapi cloud env set CORS_ORIGINS="https://your-frontend-domain.com"
```

Then redeploy:

```powershell
uv run fastapi deploy
```
