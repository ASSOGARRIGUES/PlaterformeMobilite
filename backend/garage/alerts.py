def get_vehicle_alert_level(vehicle) -> dict:
    raise NotImplementedError

def get_fleet_alerts(vehicles) -> list:
    raise NotImplementedError

def get_blocking_conditions(vehicle) -> list:
    raise NotImplementedError

def can_set_available(vehicle) -> bool:
    raise NotImplementedError
