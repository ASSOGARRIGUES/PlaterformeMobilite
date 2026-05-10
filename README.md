# Plateforme Mobilité

Application de gestion de prêts de véhicules (scooters, voitures) pour associations d'insertion.

Stack : Django REST + React (Refine / Mantine) — déployé via Docker Compose + nginx.

---

## Déploiement en production

### Prérequis

- Docker + Docker Compose
- Un fichier `.env` à la racine du projet (voir `.env-template`)

### Variables d'environnement (`.env`)

| Variable | Description | Exemple |
|---|---|---|
| `SECRET_KEY` | Clé secrète Django (chaîne aléatoire longue) | `openssl rand -hex 50` |
| `DEBUG` | Mode debug Django — **doit être `False` en prod** | `False` |
| `PROD` | Active les réglages de production (CSRF strict, static root…) | `True` |
| `URL_CSRF` | Origine autorisée pour CSRF et CORS | `https://mobilite.rezal.fr` |
| `BASE_URL` | URL publique du backend (utilisée par le frontend build) | `https://mobilite.rezal.fr` |
| `DB_TYPE` | Type de base de données (`postgres` ou `sqlite`) | `postgres` |
| `DB_ADDR` | Hostname du serveur PostgreSQL | `mobilite-db` |
| `DB_USERNAME` | Utilisateur PostgreSQL | `mobilite` |
| `DB_PASSWORD` | Mot de passe PostgreSQL | |
| `DB_NAME` | Nom de la base | `mobilite` |
| `EMAIL_HOST` | Serveur SMTP | `smtp.example.com` |
| `EMAIL_HOST_USER` | Utilisateur SMTP | |
| `EMAIL_HOST_PASSWORD` | Mot de passe SMTP | |
| `DEFAULT_FROM_EMAIL` | Adresse expéditeur par défaut | `noreply@rezal.fr` |
| `SERVER_EMAIL` | Adresse pour les erreurs serveur (ADMINS) | `mail.rezal.fr` |

#### Variables Sentry (monitoring)

Ces variables sont aussi des build args Docker pour l'image frontend — elles doivent donc être présentes dans `.env` avant le `docker-compose build`.

| Variable | Description |
|---|---|
| `VITE_SENTRY_DSN` | DSN du projet Sentry (affiché dans Settings → Client Keys) |
| `SENTRY_ORG` | Slug de l'organisation Sentry (pour l'upload des source maps) |
| `SENTRY_PROJECT` | Slug du projet Sentry |
| `SENTRY_AUTH_TOKEN` | Token d'auth Sentry avec scope `project:releases` (optionnel — sans lui les source maps ne sont pas uploadées mais l'appli fonctionne) |

`SENTRY_ORG`, `SENTRY_PROJECT` et `SENTRY_AUTH_TOKEN` sont uniquement nécessaires au moment du **build** pour uploader les source maps vers Sentry. Ils ne sont pas embarqués dans l'image finale.

### Build et démarrage

```bash
cp backend/.env-template .env
# Remplir .env

docker-compose build
docker-compose up -d
```

### Premier démarrage

Les migrations et les données initiales sont appliquées automatiquement par `entrypoint.sh`.

---

## Architecture

```
nginx (port 8214)
├── /               → fichiers statiques frontend (dist React)
├── /static/        → fichiers statiques Django
├── /media/         → uploads
├── /api/           → proxy → backend Django
├── /admin/         → proxy → backend Django
└── /sentry-tunnel/ → proxy → backend Django  ← tunnel anti-adblocker Sentry
```

Le tunnel Sentry (`/sentry-tunnel/`) est proxifié par nginx vers le backend qui le retransmet à `ingest.de.sentry.io`. Cela évite que les événements Sentry soient bloqués par les extensions navigateur.

---

## Développement local

### Backend

```bash
cd backend
python -m venv .venv  # ou utiliser le venv à la racine du repo
source .venv/bin/activate
pip install -r requirements.txt
cp .env-template .env  # adapter les valeurs
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
# Créer frontend/.env.local :
#   BASE_URL=http://localhost:8000
#   VITE_SENTRY_DSN=https://<key>@<host>/<project_id>
npm run dev
```

---

## Monitoring (Sentry)

- **Error tracking** : toutes les exceptions non gérées sont capturées automatiquement
- **Tracing** : chaque changement de route et appel API est tracé (sample rate 100 %)
- **Session Replay** : enregistrement des sessions (100 % en mode buffer — replay complet déclenché sur erreur)
- **Confidentialité** : `maskAllText` désactivé ; les données personnelles sont masquées sélectivement via la classe CSS `sentry-mask` :
  - Bénéficiaires : nom, prénom, adresse, email, téléphone, numéro de permis
  - Véhicules : immatriculation
