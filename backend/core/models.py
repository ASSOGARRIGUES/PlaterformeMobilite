from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _

# Create your models here.
class User(AbstractUser):
    phone = models.CharField(max_length=100)
    email = models.EmailField(_("email address"), unique=True,
        error_messages={
            "unique": _("A user with that email already exists."),
        },)

    REQUIRED_FIELDS = ['phone', "first_name", "last_name", "username"]
    USERNAME_FIELD = "email"



