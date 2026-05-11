# Plateforme Mobilité

Vehicle fleet management for social associations. Tracks vehicles, beneficiaries, rental contracts, and payments.

---

## Development

### Quick start

**1. Backend** — from the repo root:

```bash
source .venv/bin/activate
cd backend
# First time only: copy the template (DB_TYPE=sqlite works locally, SECRET_KEY can be anything)
cp .env-template .env
# Edit .env: set SECRET_KEY=any-random-string, DB_TYPE=sqlite, DB_ADDR=db.sqlite3
python manage.py migrate
python manage.py runserver
# Backend runs on http://localhost:8000
```

**2. Default dev user** — run once after the first migrate:

```bash
source .venv/bin/activate
cd backend
python manage.py shell -c "
from django.contrib.auth import get_user_model
from core.models import Action
U = get_user_model()
action, _ = Action.objects.get_or_create(name='Default')
u = U.objects.create_superuser('admin', 'admin@example.com', 'admin')
u.actions.add(action); u.current_action = action; u.save()
print('Created admin@example.com / admin')
"
```

**3. Frontend** — in a second terminal:

```bash
cd frontend
# First time only:
npm install
# Create frontend/.env.local pointing to the backend:
#   BASE_URL=http://localhost:8000
#   VITE_SENTRY_DSN=https://<key>@<host>/<project_id>
npm run dev
# Frontend runs on http://localhost:5173
```

Login at `http://localhost:5173` with **admin@example.com / admin**.

Or use the helper script to start both servers at once:

```bash
./start_dev.sh
```

### Backend commands

```bash
source .venv/bin/activate && cd backend
python manage.py test                                        # all tests
python manage.py test api.tests.MyTestClass.my_test_method  # single test
python manage.py spectacular --file schema.yml               # regenerate OpenAPI schema
```

### Frontend commands

```bash
cd frontend
npm run build
npm run test
npx openapi-typescript ../backend/schema.yml -o src/types/schema.d.ts  # regen types after schema changes
```

### Full stack (Docker)

```bash
# .env at repo root (not inside backend/)
docker compose up --build
# backend: port 3005 | app (nginx): port 8214
```

---

## Production deployment

### Prerequisites

- Docker + Docker Compose
- A `.env` file at the repo root (see `backend/.env-template`)

### Environment variables (`.env`)

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | Django secret key (long random string) | `openssl rand -hex 50` |
| `DEBUG` | Django debug mode — **must be `False` in prod** | `False` |
| `PROD` | Enables production settings (strict CSRF, static root…) | `True` |
| `URL_CSRF` | Allowed origin for CSRF and CORS | `https://mobilite.rezal.fr` |
| `BASE_URL` | Public backend URL (used by the frontend build) | `https://mobilite.rezal.fr` |
| `DB_TYPE` | Database type (`postgres` or `sqlite`) | `postgres` |
| `DB_ADDR` | PostgreSQL hostname | `mobilite-db` |
| `DB_USERNAME` | PostgreSQL user | `mobilite` |
| `DB_PASSWORD` | PostgreSQL password | |
| `DB_NAME` | Database name | `mobilite` |
| `EMAIL_HOST` | SMTP server | `smtp.example.com` |
| `EMAIL_HOST_USER` | SMTP user | |
| `EMAIL_HOST_PASSWORD` | SMTP password | |
| `DEFAULT_FROM_EMAIL` | Default sender address | `noreply@rezal.fr` |
| `SERVER_EMAIL` | Address for server error emails (ADMINS) | `mail.rezal.fr` |

#### Sentry variables (monitoring)

These are also Docker build args for the frontend image — they must be present in `.env` before `docker-compose build`.

| Variable | Description |
|---|---|
| `SENTRY_DSN` | DSN from Sentry Settings → Client Keys (used by the tunnel) |
| `VITE_SENTRY_DSN` | Same value — passed as build arg to the frontend Docker image |
| `SENTRY_AUTH_TOKEN` | Auth token for source map upload at build time only (optional — without it source maps won't be uploaded but the app still works) |

`SENTRY_AUTH_TOKEN` is only needed at **build time** to upload source maps to Sentry. It is not embedded in the final image. The org and project slugs are hardcoded in `vite.config.ts`.

### Build and start

```bash
cp backend/.env-template .env
# Fill in .env

docker-compose build
docker-compose up -d
```

### First start

Migrations and initial data are applied automatically by `entrypoint.sh`.

---

## Architecture

```
nginx (port 8214)
├── /               → frontend static files (React dist)
├── /static/        → Django static files
├── /media/         → uploads
├── /api/           → proxy → Django backend
├── /admin/         → proxy → Django backend
└── /sentry-tunnel/ → proxy → Django backend  ← Sentry ad-blocker bypass tunnel
```

The Sentry tunnel (`/sentry-tunnel/`) is proxied by nginx to the backend, which forwards it to `ingest.de.sentry.io`. This prevents Sentry events from being blocked by browser extensions.

---

## Monitoring (Sentry)

- **Error tracking**: all unhandled exceptions are captured automatically
- **Tracing**: every route change and API call is traced (100 % sample rate)
- **Session Replay**: session recording (100 % buffer mode — full replay triggered on error)
- **Privacy**: `maskAllText` disabled; personal data is selectively masked via the `sentry-mask` CSS class:
  - Beneficiaries: name, address, email, phone, licence number
  - Vehicles: licence plate (`imat`)
