# Run Guide

This project has 3 services:

- `ai-service`: FastAPI face recognition service
- `backend`: Express API
- `frontend`: React + Vite app

## Working local URLs

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/health`
- AI health: `http://localhost:8001/health`

## Before you start

Make sure these env files exist and are filled:

- `backend/.env`
- `frontend/.env`
- `ai-service/.env`

Important:

- The AI service should be run with `ai-service/.venv312`, not `ai-service/venv`
- `backend/.env` should ideally contain `JWT_SECRET` for production-grade auth

## Start the project

Open 3 terminals.

### 1. Setup & Start AI service

> [!NOTE]
> If `.venv312` does not exist, create it with: `python -m venv .venv312` and install dependencies with `.\.venv312\Scripts\pip.exe install -r requirements.txt`

```powershell
cd c:\Users\dhine\Desktop\attendance_system\ai-service
.\.venv312\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8001
```

Expected health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health | Select-Object -ExpandProperty Content
```

### 2. Start backend

```powershell
cd c:\Users\dhine\Desktop\attendance_system\backend
npm run dev
```

Expected health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5000/health | Select-Object -ExpandProperty Content
```

### 3. Start frontend

```powershell
cd c:\Users\dhine\Desktop\attendance_system\frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

Then open:

```text
http://localhost:5173
```

## Current verified startup order

The order that worked locally was:

1. `ai-service`
2. `backend`
3. `frontend`

## Logs

If you run services in the background, these log files are useful:

- `ai-service/logs/run-ai.out.log`
- `ai-service/logs/run-ai.err.log`
- `backend/logs/run-backend.out.log`
- `backend/logs/run-backend.err.log`
- `frontend/logs/run-frontend.out.log`
- `frontend/logs/run-frontend.err.log`

## Stop the project

If running in foreground terminals, press `Ctrl + C` in each terminal.

If running in background, stop by port:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 5000,5173,8001 } | Select-Object LocalPort,OwningProcess
Stop-Process -Id <PID> -Force
```

## Troubleshooting

### AI service starts but recognition does not work

Use this interpreter:

```powershell
cd c:\Users\dhine\Desktop\attendance_system\ai-service
.\.venv312\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8001
```

### Frontend opens but API calls fail

Check:

- `frontend/.env` has `VITE_API_URL=http://localhost:5000`
- backend is running on port `5000`

### Backend runs but auth health says `authConfigured: false`

The app can still run with the current fallback, but you should add this to `backend/.env`:

```text
JWT_SECRET=replace-with-a-long-random-secret
```
