from enum import Enum
from datetime import datetime
from typing import Optional

class TripStatus(Enum):
    REQUESTED = "REQUESTED"
    ASSIGNED = "ASSIGNED"
    ONGOING = "ONGOING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class Trip:
    def __init__(self, id: int, rider_id: int, pickup: int, dropoff: int):
        self.id = id
        self.rider_id = rider_id
        self.pickup = pickup
        self.dropoff = dropoff
        self.driver_id: Optional[int] = None
        self.status = TripStatus.REQUESTED
        self.distance: float = 0.0
        self.fare: float = 0.0
        self.created_at = datetime.now()
        self.assigned_at: Optional[datetime] = None
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.cancelled_at: Optional[datetime] = None
        
    def assign_driver(self, driver_id: int):
        """Assign a driver to this trip"""
        if self.status == TripStatus.REQUESTED:
            self.driver_id = driver_id
            self.status = TripStatus.ASSIGNED
            self.assigned_at = datetime.now()
            return True
        return False
    
    def start(self):
        """Start the trip"""
        if self.status == TripStatus.ASSIGNED:
            self.status = TripStatus.ONGOING
            self.started_at = datetime.now()
            return True
        return False
    
    def complete(self, distance: float, fare: float):
        """Complete the trip"""
        if self.status == TripStatus.ONGOING:
            self.status = TripStatus.COMPLETED
            self.distance = distance
            self.fare = fare
            self.completed_at = datetime.now()
            return True
        return False
    
    def cancel(self):
        """Cancel the trip"""
        if self.status in [TripStatus.REQUESTED, TripStatus.ASSIGNED]:
            self.status = TripStatus.CANCELLED
            self.cancelled_at = datetime.now()
            return True
        return False
    
    def is_active(self) -> bool:
        """Check if trip is active"""
        return self.status not in [TripStatus.COMPLETED, TripStatus.CANCELLED]
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'rider_id': self.rider_id,
            'driver_id': self.driver_id,
            'pickup': self.pickup,
            'dropoff': self.dropoff,
            'status': self.status.value,
            'distance': self.distance,
            'fare': self.fare,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active()
        }