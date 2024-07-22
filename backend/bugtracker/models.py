from django.contrib.auth import get_user_model
from django.db import models
from django.core.mail import mail_admins
from django.template import loader


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

    reporter_have_been_notified = models.BooleanField(default=False)

    def __str__(self):
        return self.description

    #Send email to the reporter when the bug is marked as closed
    def email_reporter(self):
        if not self.reporter:
            return
        context = {
            'user': self.reporter,
            'bug': self,
        }
        self.reporter.send_mail(
            'Mobilité - Un bug que vous avez signalé a été résolu',
            'bug_resolved_email.html',
            context,
        )

    def save(self, *args, **kwargs):
        #Send a bug report to the admins if this is a new bug
        if not self.pk:
            self.email_admins()

        #Send an email to the reporter if the bug is marked as closed
        if self.status == 'closed' and not self.reporter_have_been_notified:
            self.email_reporter()
            self.reporter_have_been_notified = True
        super().save(*args, **kwargs)

    #Send a bug report to the admins
    def email_admins(self):
        context = {
            'bug': self,
        }
        body = loader.render_to_string('admin_bug_report_email.html', context)
        mail_admins(
            'Mobilité - Un nouveau bug a été signalé - Priorité: {}'.format(self.severity),
            body,
        )

