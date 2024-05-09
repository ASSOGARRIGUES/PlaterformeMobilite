import os
from io import BytesIO

from django.conf import settings
from django.contrib.staticfiles import finders
from django.http import HttpResponse
from django.template.loader import get_template

from xhtml2pdf import pisa


def link_callback(uri, rel):

    """
    Convert HTML URIs to absolute system paths so xhtml2pdf can access those
    resources
    """

    sUrl = settings.STATIC_URL  # Typically /static/
    sRoot = settings.STATIC_ROOT  # Typically /home/userX/project_static/
    mUrl = settings.MEDIA_URL  # Typically /media/
    mRoot = settings.MEDIA_ROOT  # Typically /home/userX/project_static/media/

    if uri.startswith(mUrl):
        path = os.path.join(mRoot, uri.replace(mUrl, ""))
    elif uri.startswith(sUrl):
        if settings.PROD:
            path = os.path.join(sRoot, uri.replace(sUrl, ""))
        else:
            path = os.path.join(settings.STATICFILES_DIRS[0], uri.replace(sUrl, ""))
    else:
        return uri

    # make sure that file exists
    if not os.path.isfile(path):
        raise RuntimeError(
            'media URI must start with %s or %s. Uri: %s Path: %s' % (sUrl, mUrl,uri,path)
        )
    return path

def render_to_pdf(template_src, context_dict={}):
    template = get_template(template_src)
    html = template.render(context_dict)
    result = BytesIO()
    #pdf = pisa.pisaDocument(BytesIO(html.encode("utf-8")), result, encoding='UTF-8')
    pdf = pisa.CreatePDF(html, dest=result, encoding='UTF-8', link_callback=link_callback)
    if not pdf.err:
        return HttpResponse(result.getvalue(), content_type='application/pdf')
    return None

