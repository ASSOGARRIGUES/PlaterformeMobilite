from .settings import *  # noqa

SECRET_KEY = 'django-insecure-test-key-for-testing-only'
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Skip app migrations and use syncdb instead.
# api.0010 calls Parking.get_default_parking_pk() during SQLite table rebuild,
# which queries core_action before that table exists in the migration sequence.
MIGRATION_MODULES = {
    'api': None,
    'core': None,
    'bugtracker': None,
    'inappcom': None,
}
