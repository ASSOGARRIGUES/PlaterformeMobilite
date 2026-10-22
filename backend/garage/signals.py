from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='garage.MileageEntry')
def update_vehicle_kilometer_on_mileage_entry(sender, instance, created, **kwargs):
    if not created:
        return

    from api.models import Vehicle
    from garage.models import MileageEntry

    with transaction.atomic():
        # Verrouille la ligne Vehicle pour sérialiser les créations concurrentes
        # de MileageEntry sur le même véhicule — évite qu'une entrée plus ancienne
        # écrase la valeur posée par une entrée plus récente créée en parallèle.
        Vehicle.objects.select_for_update().filter(pk=instance.vehicle_id).first()
        latest = (
            MileageEntry.objects
            .filter(vehicle=instance.vehicle)
            .order_by('-date', '-id')
            .first()
        )
        if latest and latest.pk == instance.pk:
            Vehicle.objects.filter(pk=instance.vehicle_id).update(kilometer=instance.value)
