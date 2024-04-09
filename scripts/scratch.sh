python ../backend/manage.py spectacular --color --file schema.yml
cd ../frontend
npx openapi-typescript ../backend/schema.yml -o ./src/types/schema.d.ts
echo "OpenAPI schema generated and typescript types created"