from smtplib import SMTPException

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives, BadHeaderError
from django.db import models
from django.template import loader
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
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

    def send_reset_password_email(self, domain, site_name, use_https):
        user_email = self.email
        context = {
            "email": user_email,
            "domain": domain,
            "site_name": site_name,
            "uid": urlsafe_base64_encode(force_bytes(self.pk)),
            "user": self,
            "token": default_token_generator.make_token(self),
            "protocol": "https" if use_https else "http",
            "timeout": settings.PASSWORD_RESET_TIMEOUT/3600,
        }
        return self.send_mail(
            "Plaforme mobilité - Reset de votre mot de passe",
            "password_reset_email.html",
            context,
        )

    def send_mail(
        self,
        subject,
        email_template_name,
        context,
        from_email=None,
        html_email_template_name=None,
    ):
        """
        Send a django.core.mail.EmailMultiAlternatives to `to_email`.
        """
        # Email subject *must not* contain newlines
        subject = "".join(subject.splitlines())
        body = loader.render_to_string(email_template_name, context)

        email_message = EmailMultiAlternatives(subject, body, from_email, [self.email])
        if html_email_template_name is not None:
            html_email = loader.render_to_string(html_email_template_name, context)
            email_message.attach_alternative(html_email, "text/html")
        try:
            email_message.send()
            return True
        except BadHeaderError:
            return "Entête invalide."
        except SMTPException as e:
            return e
        except Exception as e:
            return e


