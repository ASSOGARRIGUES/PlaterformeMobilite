from django.db import migrations


def create_default_config(apps, schema_editor):
    MaintenanceConfig = apps.get_model('garage', 'MaintenanceConfig')
    if not MaintenanceConfig.objects.exists():
        MaintenanceConfig.objects.create()


class Migration(migrations.Migration):
    dependencies = [
        ('garage', '0004_maintenanceconfig'),
    ]
    operations = [
        migrations.RunPython(create_default_config, migrations.RunPython.noop),
    ]
