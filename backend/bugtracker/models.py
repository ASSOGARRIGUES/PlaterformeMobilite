from django.contrib.auth import get_user_model
from django.db import models

# Create your models here.
class Bug(models.Model):
    description = models.TextField()
    reproduction_steps = models.TextField(blank=True, null=True)
    targeted_version = models.CharField(max_length=200)
    logfile = models.FileField(upload_to='logs/', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    #User who reported the bug
    reporter = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='bugtracker_reporter', null=True, blank=True)

    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    severity = models.CharField(
        max_length=8,
        choices=SEVERITY_CHOICES,
        default='medium',
    )

    TYPE_CHOICES = [
        ('bug', 'Bug'),
        ('feature', 'Feature'),
        ('suggestion', 'Suggestions'),
    ]

    type = models.CharField(
        max_length=10,
        choices=TYPE_CHOICES,
        default='bug',
    )

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('pending', 'Pending'),
    ]

    status = models.CharField(
        max_length=7,
        choices=STATUS_CHOICES,
        default='open',
    )

    resolve_version = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return self.description
