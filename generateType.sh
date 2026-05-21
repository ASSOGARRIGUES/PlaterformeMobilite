#!/bin/bash
set -e

source .venv/bin/activate

cd backend
python manage.py spectacular --color --file schema.yml
python manage.py generatePermissionType ../frontend/src/types/PermissionType.ts
cd ../frontend
npx openapi-typescript --enum ../backend/schema.yml -o ./src/types/schema.d.ts
# drf-spectacular generates BlankEnum with "= """ which is invalid TS — remove the "=" to get a valid member name.
sed -i 's/     = ""/     ""/' ./src/types/schema.d.ts
cd ..
