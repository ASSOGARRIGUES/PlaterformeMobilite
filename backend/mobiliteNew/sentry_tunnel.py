import json
import urllib.error
import urllib.request
from os import getenv
from urllib.parse import urlparse

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

_dsn = urlparse(getenv("SENTRY_DSN", ""))
SENTRY_HOST = _dsn.hostname or ""
SENTRY_PROJECT_IDS = {_dsn.path.lstrip("/")} if _dsn.path.lstrip("/") else set()


@csrf_exempt
@require_POST
def sentry_tunnel(request):
    try:
        body = request.body
        # Only decode the first line (envelope header); rest may be binary
        first_line = body.split(b"\n", 1)[0]
        header = json.loads(first_line.decode("utf-8"))
        dsn = header.get("dsn", "")

        parsed = urlparse(dsn)
        project_id = parsed.path.lstrip("/")

        if parsed.hostname != SENTRY_HOST or project_id not in SENTRY_PROJECT_IDS:
            return HttpResponse(status=400)

        sentry_url = f"https://{SENTRY_HOST}/api/{project_id}/envelope/"
        req = urllib.request.Request(
            sentry_url,
            data=body,
            headers={"Content-Type": "application/x-sentry-envelope"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return HttpResponse(resp.read(), status=resp.status)
        except urllib.error.HTTPError as e:
            return HttpResponse(e.read(), status=e.code)
        except urllib.error.URLError:
            return HttpResponse(status=502)
    except Exception:
        return HttpResponse(status=500)
