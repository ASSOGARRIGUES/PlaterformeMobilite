cd backend;
python manage.py spectacular --color --file schema.yml;
python manage.py generatePermissionType ../frontend/src/types/PermissionType.ts;
cd ../frontend;
npx openapi-typescript --enum ../backend/schema.yml -o ./src/types/schema.d.ts ;
cd ..
