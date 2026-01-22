from typing import Dict, List, Optional
import time
import copy
from .city import City
from .driver import Driver
from .rider import Rider
from .trip import Trip, TripStatus
from .dispatch import DispatchEngine
from .rollback import RollbackManager, OperationType
from .driver import Driver, DriverStatus  # Add DriverStatus import
from .rider import Rider
from .trip import Trip, TripStatus

class RideShareSystem:
    def __init__(self):
        self.city = City()
        self.drivers: Dict[int, Driver] = {}
        self.riders: Dict[int, Rider] = {}
        self.trips: Dict[int, Trip] = {}
        self.dispatch = DispatchEngine(self.city)
        self.rollback_manager = RollbackManager()
        
        self.next_driver_id = 1
        self.next_rider_id = 1
        self.next_trip_id = 1
        
        # Initialize sample city
        self._initialize_city()
        
    def _initialize_city(self):
        """Initialize city with zones and locations"""

        # Clear existing data
        self.city = City()

        # Create 5 zones with proper spacing
        zone_width = 150
        zone_height = 250
        zone_spacing = 20

        for zone in range(5):
            # Add locations for each zone
            for i in range(3):
                loc_id = zone * 3 + i
                # Calculate positions with proper spacing
                x = zone * (zone_width + zone_spacing) + 50 + (i * 40)
                y = 150 + (i % 2) * 80
                
                self.city.add_location(loc_id, x, y, f"Zone {zone}")
        
        # Connect locations within zones
        for zone in range(5):
            base = zone * 3
            # Connect locations in same zone
            self.city.add_road(base, base + 1, 10)
            self.city.add_road(base + 1, base + 2, 10)
            
            # Connect to next zone (only connect last location of current zone to first of next)
            if zone < 4:
                self.city.add_road(base + 2, (zone + 1) * 3, 20)
    
    def initialize_sample_data(self):
        """Initialize system with sample data"""
        # Clear existing data
        self.drivers.clear()
        self.riders.clear()
        self.trips.clear()
        self.next_driver_id = 1
        self.next_rider_id = 1
        self.next_trip_id = 1
        
        # Add sample drivers
        drivers_data = [
            ("John Doe", 0, "Toyota Camry", "ABC123"),
            ("Jane Smith", 4, "Honda Civic", "DEF456"),
            ("Mike Johnson", 8, "Tesla Model 3", "GHI789"),
            ("Sarah Williams", 12, "Ford Focus", "JKL012")
        ]
        
        for name, location, vehicle, plate in drivers_data:
            driver = self.add_driver(name, location, vehicle, plate)
            # All drivers start as AVAILABLE by default
            # Mike will be BUSY for demo
            if name == "Mike Johnson":
                driver.status = DriverStatus.BUSY
            
        # Add sample riders
        riders_data = [
            ("Alice Brown", "alice@email.com"),
            ("Bob Wilson", "bob@email.com"),
            ("Charlie Davis", "charlie@email.com")
        ]
        
        for name, email in riders_data:
            self.add_rider(name, email)
            
                
        # Make some drivers available
        for driver_id in [1, 2, 4]:
            self.drivers[driver_id].status = DriverStatus.AVAILABLE
    
    def add_driver(self, name: str, location: int = 0, vehicle: str = "Car", license_plate: str = "") -> Driver:
        """Add a new driver"""
        driver_id = self.next_driver_id
        self.next_driver_id += 1
        
        driver = Driver(driver_id, name, location)
        driver.vehicle = vehicle
        driver.license_plate = license_plate
        driver.status = DriverStatus.AVAILABLE
        
        self.drivers[driver_id] = driver
        
        # Record for rollback
        self.rollback_manager.add_operation(
            OperationType.ADD_DRIVER,
            {'driver_id': driver_id},
            {'driver_id': driver_id}
        )
        
        return driver
    
    def add_rider(self, name: str, email: str = "") -> Rider:
        """Add a new rider"""
        rider_id = self.next_rider_id
        self.next_rider_id += 1
        
        rider = Rider(rider_id, name, email)
        self.riders[rider_id] = rider
        
        # Record for rollback
        self.rollback_manager.add_operation(
            OperationType.ADD_RIDER,
            {'rider_id': rider_id},
            {'rider_id': rider_id}
        )
        
        return rider
    
    def create_trip(self, rider_id: int, pickup: int, dropoff: int) -> Trip:
        """Create a new trip"""
        if rider_id not in self.riders:
            raise ValueError(f"Rider {rider_id} not found")
            
        trip_id = self.next_trip_id
        self.next_trip_id += 1
        
        trip = Trip(trip_id, rider_id, pickup, dropoff)
        self.trips[trip_id] = trip
        
        # Add to rider's history
        self.riders[rider_id].add_trip(trip_id)
        
        # Record for rollback
        self.rollback_manager.add_operation(
            OperationType.CREATE_TRIP,
            {'trip_id': trip_id},
            {'trip_id': trip_id}
        )
        
        return trip
    
    def assign_driver_to_trip(self, trip_id: int) -> bool:
        """Assign a driver to a trip"""
        if trip_id not in self.trips:
            return False
            
        trip = self.trips[trip_id]
        if trip.status != TripStatus.REQUESTED:
            return False
        
        # Find nearest driver
        drivers_list = list(self.drivers.values())
        driver = self.dispatch.find_nearest_driver(trip.pickup, drivers_list)
        
        if driver:
            # Assign driver
            trip.assign_driver(driver.id)
            driver.assign_trip(trip_id)
            
            # Record for rollback
            self.rollback_manager.add_operation(
                OperationType.ASSIGN_DRIVER,
                {
                    'trip_id': trip_id,
                    'driver_id': driver.id,
                    'previous_status': TripStatus.REQUESTED.value
                },
                {
                    'trip_id': trip_id,
                    'driver_id': driver.id
                }
            )
            
            # Calculate fare estimate
            distance = self.dispatch.calculate_trip_distance(trip.pickup, trip.dropoff)
            pickup_zone = self.city.get_zone_of_location(trip.pickup)
            dropoff_zone = self.city.get_zone_of_location(trip.dropoff)
            is_cross_zone = pickup_zone != dropoff_zone
            trip.fare = self.dispatch.calculate_fare(distance, is_cross_zone)
            
            return True
        return False
    
    def start_trip(self, trip_id: int) -> bool:
        """Start a trip"""
        if trip_id not in self.trips:
            return False
            
        trip = self.trips[trip_id]
        if trip.status != TripStatus.ASSIGNED:
            return False
            
        # Record previous state for rollback
        previous_state = copy.deepcopy(trip.to_dict())
        
        # Start trip
        success = trip.start()
        if success:
            self.rollback_manager.add_operation(
                OperationType.START_TRIP,
                {'trip_id': trip_id},
                {'previous_state': previous_state}
            )
            
        return success
    
    def complete_trip(self, trip_id: int) -> bool:
        """Complete a trip"""
        if trip_id not in self.trips:
            return False
            
        trip = self.trips[trip_id]
        if trip.status != TripStatus.ONGOING:
            return False
            
        # Calculate actual distance and fare
        distance = self.dispatch.calculate_trip_distance(trip.pickup, trip.dropoff)
        pickup_zone = self.city.get_zone_of_location(trip.pickup)
        dropoff_zone = self.city.get_zone_of_location(trip.dropoff)
        is_cross_zone = pickup_zone != dropoff_zone
        fare = self.dispatch.calculate_fare(distance, is_cross_zone)
        
        # Record previous state for rollback
        previous_state = copy.deepcopy(trip.to_dict())
        
        # Complete trip
        success = trip.complete(distance, fare)
        
        if success:
            # Update driver
            if trip.driver_id in self.drivers:
                self.drivers[trip.driver_id].complete_trip(trip.dropoff)
            
            self.rollback_manager.add_operation(
                OperationType.COMPLETE_TRIP,
                {'trip_id': trip_id, 'distance': distance, 'fare': fare},
                {'previous_state': previous_state}
            )
            
        return success
    
    def cancel_trip(self, trip_id: int) -> bool:
        """Cancel a trip"""
        if trip_id not in self.trips:
            return False
            
        trip = self.trips[trip_id]
        if not trip.is_active():
            return False
            
        # Record previous state for rollback
        previous_state = copy.deepcopy(trip.to_dict())
        
        # Cancel trip
        success = trip.cancel()
        
        if success:
            # Update driver if assigned
            if trip.driver_id and trip.driver_id in self.drivers:
                self.drivers[trip.driver_id].cancel_trip()
            
            self.rollback_manager.add_operation(
                OperationType.CANCEL_TRIP,
                {'trip_id': trip_id},
                {'previous_state': previous_state}
            )
            
        return success
    
    def get_available_drivers(self) -> List[Driver]:
        """Get list of available drivers"""
        return [d for d in self.drivers.values() if d.is_available()]
    
    def get_active_trips(self) -> List[Trip]:
        """Get list of active trips"""
        return [t for t in self.trips.values() if t.is_active()]
    
    def get_analytics(self) -> Dict:
        """Get system analytics"""
        total_trips = len(self.trips)
        completed = len([t for t in self.trips.values() if t.status == TripStatus.COMPLETED])
        cancelled = len([t for t in self.trips.values() if t.status == TripStatus.CANCELLED])
        active = len(self.get_active_trips())
        
        total_distance = sum(t.distance for t in self.trips.values())
        total_fare = sum(t.fare for t in self.trips.values())
        
        avg_distance = total_distance / completed if completed > 0 else 0
        avg_fare = total_fare / completed if completed > 0 else 0
        
        available_drivers = len(self.get_available_drivers())
        total_drivers = len(self.drivers)
        driver_utilization = (total_drivers - available_drivers) / total_drivers if total_drivers > 0 else 0
        
        return {
            'total_trips': total_trips,
            'completed_trips': completed,
            'cancelled_trips': cancelled,
            'active_trips': active,
            'total_distance': round(total_distance, 2),
            'total_fare': round(total_fare, 2),
            'average_distance': round(avg_distance, 2),
            'average_fare': round(avg_fare, 2),
            'available_drivers': available_drivers,
            'total_drivers': total_drivers,
            'driver_utilization': round(driver_utilization, 2),
            'total_riders': len(self.riders)
        }
    
    def get_state(self) -> Dict:
        """Get complete system state"""
        return {
            'city': self.city.to_dict(),
            'drivers': [d.to_dict() for d in self.drivers.values()],
            'riders': [r.to_dict() for r in self.riders.values()],
            'trips': [t.to_dict() for t in self.trips.values()],
            'analytics': self.get_analytics()
        }
    
    def rollback(self, k: int = 1) -> bool:
        """Rollback last k operations"""
        rolled_back = self.rollback_manager.rollback(k)
        
        # Simple rollback implementation
        # In a real system, you would restore the actual state from reverse_data
        return len(rolled_back) > 0