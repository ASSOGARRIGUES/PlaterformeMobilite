FROM python:3 as base
WORKDIR /backend

FROM base as deps
COPY requirements.txt .
COPY requirements-postgres.txt .
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD curl -v -X GET -H "Accept: application/json" --fail http://localhost:8000/status/ || exit 1
RUN pip install --no-cache-dir -r requirements-postgres.txt

FROM deps as build
COPY . .
CMD ["bash", "entrypoint.sh"]