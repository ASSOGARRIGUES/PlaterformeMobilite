from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='garage.MileageEntry')
def update_vehicle_kilometer_on_mileage_entry(sender, instance, created, **kwargs):
    if not created:
        return

    from garage.models import MileageEntry
    latest = (
        MileageEntry.objects
        .filter(vehicle=instance.vehicle)
        .order_by('-date', '-id')
        .first()
    )
    if latest and latest.pk == instance.pk:
        from api.models import Vehicle
        Vehicle.objects.filter(pk=instance.vehicle_id).update(kilometer=instance.value)
