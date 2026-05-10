# Plateforme Mobilité

Vehicle fleet management for social associations. Tracks vehicles, beneficiaries, rental contracts, and payments.

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
# Create .env pointing to the backend (already gitignored):
echo 'BASE_URL=http://localhost:8000' > .env
npm run dev
# Frontend runs on http://localhost:5173
```

Login at `http://localhost:5173` with **admin@example.com / admin**.

Or use the helper script to start both servers at once:

```bash
./start_dev.sh
```

---

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
npx openapi-typescript ../backend/schema.yml -o src/types/schema.d.ts  # regen types after schema changes
```

### Full stack (Docker)

```bash
# .env at repo root (not inside backend/)
docker compose up --build
# backend: port 3005 | app (nginx): port 8214
```
