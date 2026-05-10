# Plateforme Mobilité

Vehicle fleet management for social associations. Tracks vehicles, beneficiaries, rental contracts, and payments.

## Development

### Backend

```bash
cd backend
# copy .env-template to .env and fill in values (DB_TYPE=sqlite works locally)
python manage.py migrate
python manage.py runserver
```

```bash
python manage.py test                                        # all tests
python manage.py test api.tests.MyTestClass.my_test_method  # single test
python manage.py spectacular --file schema.yml               # regenerate OpenAPI schema
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # dev server, proxies /api to localhost:8000
npm run build
```

Regenerate TypeScript types after backend schema changes:
```bash
npx openapi-typescript ../backend/schema.yml -o src/types/schema.d.ts
```

### Full stack (Docker)

```bash
# .env at repo root (not inside backend/)
docker compose up --build
# backend: port 3005 | app (nginx): port 8214
```
