"""
Django settings for mobiliteNew project.

Generated by 'django-admin startproject' using Django 5.0.3.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.0/ref/settings/
"""

import os
from datetime import timedelta
from pathlib import Path
from os import getenv
from dotenv import load_dotenv


load_dotenv(".env")

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = getenv("SECRET_KEY")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = getenv("DEBUG", "False") == "True"
PROD = getenv("PROD", "False") == "True"

BASE_URL = getenv("BASE_URL", "http://localhost:8000")

ALLOWED_HOSTS = ["*"]
CSRF_TRUSTED_ORIGINS = ["http://localhost:5173", getenv("URL_CSRF", "http://localhost:8000")] if DEBUG and not PROD else [getenv("URL_CSRF", "http://localhost:8000")]

CORS_ALLOWED_ORIGINS = CSRF_TRUSTED_ORIGINS

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'health_check',
    'health_check.db',
    'health_check.cache',
    'health_check.storage',
    'health_check.contrib.migrations',
    'health_check.contrib.psutil',
    'corsheaders',
    'rest_framework',
    'django_filters',
    'tinymce',
    'core',
    'api',
    'drf_spectacular',
    'dbbackup',
    'solo',
    'dbbackup_admin',
    'django_crontab',
    'bugtracker',
    'inappcom',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'mobiliteNew.urls'

AUTH_USER_MODEL = "core.User"

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates']
        ,
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

DECIMAL_SEPARATOR = '.'
USE_THOUSAND_SEPARATOR = True
THOUSAND_SEPARATOR = ' '
NUMBER_GROUPING = 3

WSGI_APPLICATION = 'mobiliteNew.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases

DB_TYPE = getenv("DB_TYPE", "sqlite")

if DB_TYPE == "postgres":
    DB_ENGINE = "django.db.backends.postgresql_psycopg2"
    DB_NAME = getenv("DB_NAME", "postgres")
elif DB_TYPE == "mysql":
    DB_ENGINE = "django.db.backends.mysql"
    DB_NAME = getenv("DB_NAME", "mysql")
else:
    DB_ENGINE = "django.db.backends.sqlite3"
    DB_NAME = str(BASE_DIR / "db.sqlite3")

DB_SETTINGS = {
    "NAME": DB_NAME,
    "ENGINE": DB_ENGINE,
    "USER": getenv("DB_USERNAME", ""),
    "PASSWORD": getenv("DB_PASSWORD", ""),
    "HOST": getenv("DB_ADDR", ""),
}

DATABASES = {
    "default": DB_SETTINGS,
}


# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

PASSWORD_RESET_TIMEOUT = 3600*24 # 24 hours
LOGIN_URL = BASE_URL + "/login"


# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = 'fr-FR'

TIME_ZONE = 'Europe/Paris'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/

STATIC_URL = '/static/'


if PROD:
    STATIC_ROOT = BASE_DIR / "static"
else:
    STATICFILES_DIRS = (os.path.join(BASE_DIR, "static"),)

MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'


# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email settings
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = getenv("EMAIL_HOST", "")
EMAIL_HOST_USER = getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_PORT = 587
EMAIL_USE_TLS = True
DEFAULT_FROM_EMAIL = getenv("DEFAULT_FROM_EMAIL", "")
SERVER_EMAIL = getenv("SERVER_EMAIL", "")


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 10,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ]
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}


#Backup
DBBACKUP_STORAGE = 'django.core.files.storage.FileSystemStorage'
DBBACKUP_STORAGE_OPTIONS = {'location': os.path.join(BASE_DIR, 'db_backups')}


ADMINS = [("Simon", "simon.galand43@gmail.com")]

CRONJOBS = [
    ('0 22 */ * *', 'core.crons.dbBackup')
]


SPECTACULAR_SETTINGS = {
    'ENUM_NAME_OVERRIDES': {
        'VehicleStatusEnum': 'api.models.Vehicle.STATUS_CHOICES',
        'VehicleTypeEnum': 'api.models.Vehicle.VEHICLE_TYPE_CHOICES',
        'ContractStatusEnum': 'api.models.Contract.STATUS_CHOICES',
        'PaymentModeEnum': 'api.models.PaymentMode',
        'BugSeverityEnum': 'bugtracker.models.Bug.SEVERITY_CHOICES',
        'BugTypeEnum': 'bugtracker.models.Bug.TYPE_CHOICES',
        'BugStatusEnum': 'bugtracker.models.Bug.STATUS_CHOICES',
    }
}
