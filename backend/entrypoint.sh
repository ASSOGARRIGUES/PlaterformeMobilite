echo "Starting backend with PROD=$PROD and DEBUG=$DEBUG"


if [ "$DEBUG" == "False" ]; then
echo "Running migrations"
python manage.py migrate || exit 2
fi

echo "Registering cron jobs"
python manage.py crontab add

echo "Inserting base data if necessary"
echo "import insert_base_data" | python manage.py shell || { echo "Missing super user configuration. Check the environment variables."; exit 3; }

if [ "$PROD" == "True" ]; then
  echo "Collecting static files"
  python manage.py collectstatic --noinput
fi

if [ "$PROD" == "True" ] && [ "$DEBUG" == "False" ]; then
  echo "Starting Server"
  gunicorn mobiliteNew.wsgi:application --bind 0.0.0.0:8000 --workers 3
else
  echo "Starting Development Server"
  python manage.py runserver 0:8000
fi
