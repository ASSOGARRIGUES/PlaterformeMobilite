from django.db import migrations


def ensure_default_parking_data(apps, schema_editor):
    # Corrective data migration for already-deployed history:
    # - ensure one default Parking exists
    # - ensure it is linked to all Actions
    # - backfill Vehicles that still have NULL parking
    Parking = apps.get_model('api', 'Parking')
    Vehicle = apps.get_model('api', 'Vehicle')
    Action = apps.get_model('core', 'Action')

    default_parking = Parking.objects.order_by('id').first()
    if default_parking is None:
        default_parking = Parking.objects.create(name='Défaut')

    # Mirror runtime behavior so old environments converge to the same state.
    default_parking.actions.set(Action.objects.all())

    Vehicle.objects.filter(parking__isnull=True).update(parking=default_parking)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_alter_vehicle_options'),
        ('core', '0004_rename_actions_action'),
    ]

    operations = [
        migrations.RunPython(ensure_default_parking_data, migrations.RunPython.noop),
    ]
