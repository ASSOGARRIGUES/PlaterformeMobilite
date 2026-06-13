from django.db import migrations


def create_default_config(apps, schema_editor):
    MaintenanceConfig = apps.get_model('garage', 'MaintenanceConfig')
    if not MaintenanceConfig.objects.exists():
        MaintenanceConfig.objects.create()


def delete_default_config(apps, schema_editor):
    MaintenanceConfig = apps.get_model('garage', 'MaintenanceConfig')
    MaintenanceConfig.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('garage', '0004_maintenanceconfig'),
    ]
    operations = [
        migrations.RunPython(create_default_config, delete_default_config),
    ]
