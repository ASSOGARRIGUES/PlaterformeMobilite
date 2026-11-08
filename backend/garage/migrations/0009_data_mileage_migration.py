from django.db import migrations
from django.utils import timezone


def migrate_mileage_from_contracts(apps, schema_editor):
    Vehicle = apps.get_model('api', 'Vehicle')
    Contract = apps.get_model('api', 'Contract')
    MileageEntry = apps.get_model('garage', 'MileageEntry')
    User = apps.get_model('core', 'User')

    system_user = User.objects.filter(is_superuser=True).first()
    if not system_user:
        system_user = User.objects.first()
    if not system_user:
        return

    today = timezone.now().date()

    contracts_by_vehicle = {}
    for contract in Contract.objects.order_by('start_date').select_related('vehicle'):
        contracts_by_vehicle.setdefault(contract.vehicle_id, []).append(contract)

    for vehicle in Vehicle.objects.all():
        entries_created = 0
        contracts = contracts_by_vehicle.get(vehicle.pk, [])

        for contract in contracts:
            if contract.start_kilometer is not None and contract.start_date is not None:
                MileageEntry.objects.create(
                    vehicle=vehicle,
                    value=contract.start_kilometer,
                    date=contract.start_date,
                    source='contract',
                    author=system_user,
                )
                entries_created += 1

            if contract.end_kilometer is not None and contract.end_date is not None:
                MileageEntry.objects.create(
                    vehicle=vehicle,
                    value=contract.end_kilometer,
                    date=contract.end_date,
                    source='contract',
                    author=system_user,
                )
                entries_created += 1

        if entries_created == 0:
            MileageEntry.objects.create(
                vehicle=vehicle,
                value=vehicle.kilometer,
                date=today,
                source='migration',
                author=system_user,
            )


def reverse_mileage_migration(apps, schema_editor):
    MileageEntry = apps.get_model('garage', 'MileageEntry')
    MileageEntry.objects.filter(source__in=['contract', 'migration']).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('garage', '0008_mileageentry'),
    ]

    operations = [
        migrations.RunPython(migrate_mileage_from_contracts, reverse_mileage_migration),
    ]
