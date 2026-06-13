from django.apps import AppConfig


class GarageAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'garage'

    def ready(self):
        from django.db.models.signals import post_migrate
        post_migrate.connect(_setup_garage_groups, sender=self)


def _setup_garage_groups(sender, **kwargs):
    from django.contrib.auth.management import create_permissions
    from django.contrib.auth.models import Group, Permission
    from django.apps import apps as django_apps

    # Garantit que les permissions garage sont créées avant de les assigner,
    # même sur un premier déploiement où create_permissions n'a pas encore tourné.
    create_permissions(django_apps.get_app_config('garage'), verbosity=0)

    GROUPS_PERMISSIONS = {
        'Garagiste': [
            'view_dashboard', 'view_vehicle', 'manage_intervention', 'manage_inspection',
        ],
        'Responsable garagiste': [
            'view_dashboard', 'view_vehicle', 'manage_intervention', 'manage_inspection',
            'correct_mileage', 'override_maintenance_block',
        ],
        'Référents': [
            'view_dashboard', 'view_vehicle',
        ],
        'Responsable référents': [
            'view_dashboard', 'view_vehicle', 'correct_mileage', 'override_maintenance_block',
        ],
    }

    garage_perms = {
        p.codename: p
        for p in Permission.objects.filter(content_type__app_label='garage')
    }

    for group_name, codenames in GROUPS_PERMISSIONS.items():
        group, _ = Group.objects.get_or_create(name=group_name)
        perms_to_set = [garage_perms[c] for c in codenames if c in garage_perms]
        # set() scoped aux permissions garage uniquement — préserve les perms tierces du groupe
        non_garage = list(group.permissions.exclude(content_type__app_label='garage'))
        group.permissions.set(non_garage + perms_to_set)
