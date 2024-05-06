from django.contrib.auth.models import AbstractUser
from django.db import models

# Create your models here.
class User(AbstractUser):
    phone = models.CharField(max_length=100)

    REQUIRED_FIELDS = AbstractUser.REQUIRED_FIELDS+['phone', "first_name", "last_name"]