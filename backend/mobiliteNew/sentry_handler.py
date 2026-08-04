import sentry_sdk
from rest_framework.views import exception_handler


def sentry_user_context_exception_handler(exc, context):
    request = context.get('request')
    if request is not None and request.user.is_authenticated:
        sentry_sdk.set_user({"id": request.user.pk, "email": request.user.email})

    return exception_handler(exc, context)
