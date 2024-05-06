from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User


# Register your models here.
class MyUserAdmin(UserAdmin):
    # Add the new field to the admin form in the _('Personal info') section
    # Detach the actual fields and add them to the new field
    fieldsets = []
    for fieldset in UserAdmin.fieldsets:
        if(fieldset[0] == _('Personal info')):
            current_fields = fieldset[1]['fields']
            fieldsets.append((_('Personal info'), {'fields': current_fields + ('phone',)}))
        else:
            fieldsets.append(fieldset)

admin.site.register(User, MyUserAdmin)