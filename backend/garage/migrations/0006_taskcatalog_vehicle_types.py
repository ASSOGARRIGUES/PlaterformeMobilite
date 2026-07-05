from django.db import migrations, models

VEHICLE_TYPE_MIGRATION_MAP = {
    'voiture': ['voiture'],
    '2_roues': ['scouter'],
    'les_deux': ['voiture', 'scouter'],
}


def migrate_vehicle_types(apps, schema_editor):
    TaskCatalog = apps.get_model('garage', 'TaskCatalog')
    for task in TaskCatalog.objects.all():
        task.vehicle_types = VEHICLE_TYPE_MIGRATION_MAP.get(task.vehicle_type, [])
        task.save()


class Migration(migrations.Migration):
    dependencies = [
        ('garage', '0005_maintenanceconfig_default'),
    ]
    operations = [
        # 1 — Ajouter vehicle_types (nullable pour pouvoir remplir avant de rendre obligatoire)
        migrations.AddField(
            model_name='taskcatalog',
            name='vehicle_types',
            field=models.JSONField(default=list, help_text='Types de véhicules concernés (ex: ["voiture", "scouter"])'),
        ),
        # 2 — Migrer les données depuis vehicle_type
        migrations.RunPython(migrate_vehicle_types, migrations.RunPython.noop),
        # 3 — Supprimer l'ancien champ
        migrations.RemoveField(
            model_name='taskcatalog',
            name='vehicle_type',
        ),
    ]
