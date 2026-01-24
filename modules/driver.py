from enum import Enum
from typing import Optional

class DriverStatus(Enum):
    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"
    OFFLINE = "OFFLINE"

class Driver:
    def __init__(self, id: int, name: str, location: int = 0):
        self.id = id
        self.name = name
        self.location = location
        self.vehicle = "Car"
        self.license_plate = ""
        self.status = DriverStatus.AVAILABLE  # Use DriverStatus directly
        self.current_trip_id: Optional[int] = None
        
    def assign_trip(self, trip_id: int):
        """Assign a trip to this driver - DEBUG VERSION"""
        print(f"\n=== DEBUG: Driver.assign_trip({trip_id}) called ===")
        print(f"Driver ID: {self.id}")
        print(f"Driver name: {self.name}")
        print(f"Current driver status: {self.status}")
        print(f"Is available? {self.is_available()}")
    
        self.current_trip_id = trip_id
        self.status = DriverStatus.BUSY
    
        print(f"✓ Trip assigned to driver!")
        print(f"New driver status: {self.status}")
        print(f"Current trip ID: {self.current_trip_id}")
        
    def complete_trip(self, new_location: int):
        """Complete current trip"""
        self.current_trip_id = None
        self.status = DriverStatus.AVAILABLE
        self.location = new_location
        
    def cancel_trip(self):
        """Cancel current trip"""
        self.current_trip_id = None
        self.status = DriverStatus.AVAILABLE
        
    def is_available(self) -> bool:
        """Check if driver is available"""
        return self.status == DriverStatus.AVAILABLE
        
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'location': self.location,
            'vehicle': self.vehicle,
            'license_plate': self.license_plate,
            'status': self.status.value,  # Use .value to get string
            'current_trip_id': self.current_trip_id,
            'available': self.is_available()
        }