def get_config():
    from .models import MaintenanceConfig
    config, _ = MaintenanceConfig.objects.get_or_create(pk=1)
    return config


def get_vehicle_alert_level(vehicle) -> dict:
    raise NotImplementedError

def get_fleet_alerts(vehicles) -> list:
    raise NotImplementedError

def get_blocking_conditions(vehicle) -> list:
    raise NotImplementedError

def can_set_available(vehicle) -> bool:
    raise NotImplementedError
