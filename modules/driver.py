from enum import Enum
from typing import Optional

class DriverStatus(Enum):
    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"
    OFFLINE = "OFFLINE"

class Driver:
    def __init__(self, id: int, location: int, name: str, vehicle: str = "", license_plate: str = ""):
        self.id = id
        self.location = location
        self.name = name
        self.vehicle = vehicle
        self.license_plate = license_plate
        self.status = DriverStatus.AVAILABLE
        self.current_trip_id: Optional[int] = None
        
    def update_location(self, new_location: int):
        """Update driver's location"""
        self.location = new_location
        
    def assign_trip(self, trip_id: int):
        """Assign a trip to driver"""
        self.current_trip_id = trip_id
        self.status = DriverStatus.BUSY
        
    def complete_trip(self):
        """Complete current trip"""
        self.current_trip_id = None
        self.status = DriverStatus.AVAILABLE
        
    def cancel_assignment(self):
        """Cancel current assignment"""
        self.current_trip_id = None
        self.status = DriverStatus.AVAILABLE
        
    def is_available(self) -> bool:
        """Check if driver is available"""
        return self.status == DriverStatus.AVAILABLE
        
    def to_dict(self):
        """Convert driver data to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'location': self.location,
            'vehicle': self.vehicle,
            'license_plate': self.license_plate,
            'status': self.status.value,
            'current_trip_id': self.current_trip_id,
            'available': self.is_available()
        }