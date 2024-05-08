from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.sites.shortcuts import get_current_site
from django.utils.translation import gettext_lazy as _

from .models import User


# Register your models here.
class MyUserAdmin(UserAdmin):

    actions = UserAdmin.actions + ('reset_password',)

    # Add the new field to the admin form in the _('Personal info') section
    # Detach the actual fields and add them to the new field
    fieldsets = []
    for fieldset in UserAdmin.fieldsets:
        if(fieldset[0] == _('Personal info')):
            current_fields = fieldset[1]['fields']
            fieldsets.append((_('Personal info'), {'fields': current_fields + ('phone',)}))
        else:
            fieldsets.append(fieldset)

    @admin.action(description='Envoi mail reset mdp')
    def reset_password(self, request, queryset):
        successCount = 0
        errors = []
        for user in queryset:
            current_site = get_current_site(request)
            site_name = current_site.name
            domain = current_site.domain

            success = user.send_reset_password_email(domain, site_name, request.is_secure())
            if success is True:
                successCount += 1
            else:
                errors.append(success) # if success is not True, it's an error message

        if successCount>0:
            self.message_user(request, str(successCount) + " mails envoyés avec succès")
        if errors:
            #Convert errors to text and join errors with \n
            errors_string = [str(error) for error in errors]
            error_text = ",".join(errors_string)
            self.message_user(request, "Erreurs: " + error_text, level='ERROR')

admin.site.register(User, MyUserAdmin)