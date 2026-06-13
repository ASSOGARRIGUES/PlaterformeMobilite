from django.db import migrations

INITIAL_TASKS = [
    # (name, vehicle_type, km_periodicity, month_periodicity, is_critical)
    ('Vidange',             'les_deux', 15000,  12,   False),
    ('Filtre à huile',      'voiture',  15000,  12,   False),
    ('Filtre à air',        'voiture',  30000,  24,   False),
    ('Distribution',        'voiture',  120000, 60,   True),
    ('Plaquettes de frein', 'les_deux', 30000,  None, False),
    ('Disques de frein',    'voiture',  60000,  None, False),
    ('Freins arrière',      'les_deux', 40000,  None, False),
    ('Pneus',               'les_deux', 40000,  None, False),
    ('Bougies',             'voiture',  30000,  None, False),
    ('Bobines',             'voiture',  None,   None, False),
    ('Roulements',          'voiture',  None,   None, False),
    ('Biellettes',          'voiture',  None,   None, False),
]


def create_initial_tasks(apps, schema_editor):
    TaskCatalog = apps.get_model('garage', 'TaskCatalog')
    for name, vehicle_type, km_p, month_p, critical in INITIAL_TASKS:
        TaskCatalog.objects.create(
            name=name,
            vehicle_type=vehicle_type,
            km_periodicity=km_p,
            month_periodicity=month_p,
            is_critical=critical,
        )


def delete_initial_tasks(apps, schema_editor):
    TaskCatalog = apps.get_model('garage', 'TaskCatalog')
    TaskCatalog.objects.filter(name__in=[name for name, *_ in INITIAL_TASKS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('garage', '0002_initial'),
    ]
    operations = [
        migrations.RunPython(create_initial_tasks, delete_initial_tasks),
    ]
