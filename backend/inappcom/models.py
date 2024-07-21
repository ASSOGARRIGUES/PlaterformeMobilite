from django.contrib.auth import get_user_model
from django.db import models
from tinymce.models import HTMLField

# Create your models here.
class InAppBroadcast(models.Model):
    title = models.CharField(max_length=100)

    body = HTMLField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    viewedBy = models.ManyToManyField(get_user_model(), related_name='viewedBy', blank=True)

    active = models.BooleanField(default=True)

    def __str__(self):
        return self.title

