import sentry_sdk


def sentry_user_context_exception_handler(exc, context):
    # imported lazily: rest_framework.views isn't safe to import while
    # settings.py is still being evaluated (Django apps aren't ready yet)
    from rest_framework.views import exception_handler

    request = context.get('request')
    if request is not None and request.user.is_authenticated:
        sentry_sdk.set_user({"id": request.user.pk, "email": request.user.email})

    return exception_handler(exc, context)
