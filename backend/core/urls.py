from django.conf import settings
from django.contrib.auth.views import PasswordResetView, PasswordResetConfirmView, PasswordResetCompleteView, \
    PasswordResetDoneView
from django.urls import path


urlpatterns = [
    path('password-reset/', PasswordResetView.as_view(email_template_name="password_reset_email.html", subject_template_name="password_reset_email_subject.txt", extra_email_context={"timeout": settings.PASSWORD_RESET_TIMEOUT/3600}), name='password_reset'),
    path('password-reset/done/', PasswordResetDoneView.as_view(), name='password_reset_done'),
    path('password-reset-confirm/<uidb64>/<token>/',PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('password-reset-complete/', PasswordResetCompleteView.as_view(), name='password_reset_complete'),
]

