echo "Making migrations"
python manage.py makemigrations || exit 1

echo "Running migrations"
python manage.py migrate || exit 2

echo "prod: $DEFAULT_SUPER_USER"

echo "Inserting base data if necessary"
echo "import insert_base_data" | python manage.py shell || { echo "Missing super user configuration. Check the environment variables."; exit 3; }

if [ "$PROD" == "True" ]; then
  echo "Collecting static files"
  python manage.py collectstatic --noinput
fi

if [ "$PROD" == "True" ] && [ "$DEBUG" == "False" ]; then
  echo "Starting Server"
  gunicorn mobiliteNew.wsgi:application --bind 0.0.0.0:8000
else
  echo "Starting Development Server"
  python manage.py runserver 0:8000
fi