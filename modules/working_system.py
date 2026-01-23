from typing import Dict, List, Optional
from datetime import datetime
import time
import threading

from .city import City
from .driver import Driver, DriverStatus
from .rider import Rider
from .trip import Trip, TripStatus
from .dispatch import DispatchEngine
from .rollback import RollbackManager, OperationType

class WorkingRideShareSystem:
    """SIMPLIFIED GUARANTEED WORKING SYSTEM"""
    
    def __init__(self):
        self.city = City()
        self.drivers: Dict[int, Driver] = {}
        self.riders: Dict[int, Rider] = {}
        self.trips: Dict[int, Trip] = {}
        self.dispatch = DispatchEngine(self.city)
        self.rollback_manager = RollbackManager()
        
        self.next_driver_id = 101
        self.next_rider_id = 101
        self.next_trip_id = 1
        
        # Initialize
        self._initialize_city()
    
    def _initialize_city(self):
        """Initialize city"""
        self.city = City()
        
        # Create 5 zones with 3 locations each
        for zone in range(5):
            for i in range(3):
                loc_id = zone * 3 + i
                x = zone * 180 + 50 + (i * 40)
                y = 150 + (i % 2) * 80
                self.city.add_location(loc_id, x, y, f"Zone {zone}")
        
        # Connect locations
        for zone in range(5):
            base = zone * 3
            self.city.add_road(base, base + 1, 10)
            self.city.add_road(base + 1, base + 2, 10)
            if zone < 4:
                self.city.add_road(base + 2, (zone + 1) * 3, 15)
    
    def initialize_sample_data(self):
        """Initialize system with sample data"""
        # Clear data
        self.drivers.clear()
        self.riders.clear()
        self.trips.clear()
        
        self.next_driver_id = 101
        self.next_rider_id = 101
        self.next_trip_id = 1
        
        print("=== INITIALIZING SAMPLE DATA ===")
        
        # Add 3 drivers (make sure they're available)
        drivers_data = [
            ("John", 0, "Toyota", "ABC123"),
            ("Sarah", 4, "Honda", "DEF456"),
            ("Mike", 8, "Tesla", "GHI789")
        ]
        
        for name, location, vehicle, plate in drivers_data:
            driver = self.add_driver(name, location, vehicle, plate)
            # Force status to AVAILABLE
            driver.status = DriverStatus.AVAILABLE
            print(f"✓ Added driver: {driver.name} at location {driver.location} (status: {driver.status})")
        
        # Add 3 riders
        riders_data = [
            ("Alice", "alice@email.com"),
            ("Bob", "bob@email.com"),
            ("Charlie", "charlie@email.com")
        ]
        
        for name, email in riders_data:
            rider = self.add_rider(name, email)
            print(f"✓ Added rider: {name} (ID: {rider.id})")
        
        print("=== SAMPLE DATA INITIALIZED ===")
    
    def add_driver(self, name: str, location: int = 0, vehicle: str = "Car", license_plate: str = "") -> Driver:
        """Add a new driver"""
        driver_id = self.next_driver_id
        self.next_driver_id += 1
        
        driver = Driver(driver_id, name, location)
        driver.vehicle = vehicle
        driver.license_plate = license_plate
        driver.status = DriverStatus.AVAILABLE  # Always available when added
        
        self.drivers[driver_id] = driver
        return driver
    
    def add_rider(self, name: str, email: str = "") -> Rider:
        """Add a new rider"""
        rider_id = self.next_rider_id
        self.next_rider_id += 1
        
        rider = Rider(rider_id, name, email)
        self.riders[rider_id] = rider
        return rider
    
    def request_trip(self, rider_id: int, pickup: int, dropoff: int) -> Optional[Trip]:
        """Request a new trip - SIMPLE GUARANTEED WORKING VERSION"""
        print(f"\n=== REQUESTING TRIP ===")
        print(f"Rider ID: {rider_id}, Pickup: {pickup}, Dropoff: {dropoff}")
        
        # Check rider exists
        if rider_id not in self.riders:
            print(f"✗ ERROR: Rider {rider_id} not found!")
            return None
        
        # Create trip
        trip_id = self.next_trip_id
        self.next_trip_id += 1
        
        trip = Trip(trip_id, rider_id, pickup, dropoff)
        self.trips[trip_id] = trip
        print(f"✓ Created trip {trip_id} with status: {trip.status}")
        
        # Add to rider's history
        self.riders[rider_id].add_trip(trip_id)
        
        # Start processing immediately
        threading.Thread(target=self._process_trip, args=(trip_id,), daemon=True).start()
        
        return trip
    
    def _process_trip(self, trip_id: int):
        """Process a trip - SIMPLE GUARANTEED WORKING"""
        print(f"\n=== PROCESSING TRIP {trip_id} ===")
        
        if trip_id not in self.trips:
            print(f"✗ Trip {trip_id} not found!")
            return
        
        trip = self.trips[trip_id]
        
        # Step 1: Find available driver
        print("Step 1: Finding available driver...")
        available_drivers = [d for d in self.drivers.values() if d.is_available()]
        print(f"Available drivers: {len(available_drivers)}")
        
        if not available_drivers:
            print("✗ No drivers available! Cancelling trip...")
            trip.cancel()
            return
        
        # Pick first available driver (for simplicity)
        driver = available_drivers[0]
        print(f"✓ Selected driver: {driver.name} (ID: {driver.id}) at location {driver.location}")
        
        # Step 2: Assign driver to trip
        print("Step 2: Assigning driver...")
        if trip.assign_driver(driver.id):
            driver.assign_trip(trip_id)
            print(f"✓ Driver assigned! Trip status: {trip.status}")
        else:
            print("✗ Failed to assign driver!")
            trip.cancel()
            return
        
        # Step 3: Move driver to pickup
        print(f"Step 3: Moving driver to pickup location {trip.pickup}...")
        self._animate_driver_to_location(driver, trip.pickup, trip_id, "pickup")
        
        # Check if trip still exists and is active
        if trip_id not in self.trips or not trip.is_active():
            print("✗ Trip cancelled during pickup!")
            return
        
        # Step 4: Start trip
        print("Step 4: Starting trip...")
        trip.start()
        print(f"✓ Trip started! Status: {trip.status}")
        
        # Wait a moment at pickup
        time.sleep(1)
        
        # Step 5: Move to dropoff
        print(f"Step 5: Moving to dropoff location {trip.dropoff}...")
        self._animate_driver_to_location(driver, trip.dropoff, trip_id, "dropoff")
        
        # Check if trip still exists and is active
        if trip_id not in self.trips or not trip.is_active():
            print("✗ Trip cancelled during dropoff!")
            return
        
        # Step 6: Complete trip
        print("Step 6: Completing trip...")
        distance = 10.0  # Simplified distance
        fare = 15.0      # Simplified fare
        trip.complete(distance, fare)
        driver.complete_trip(trip.dropoff)
        print(f"✓ Trip completed! Distance: {distance}km, Fare: ${fare}")
        print(f"Final trip status: {trip.status}")
        print(f"Driver {driver.name} now at location {driver.location}")
    
    def _animate_driver_to_location(self, driver: Driver, target_location: int, trip_id: int, stage: str):
        """Animate driver moving to a location"""
        print(f"Animating driver {driver.name} to {target_location} ({stage})")
        
        # Get current and target positions
        locations = self.city.locations
        current_loc = locations.get(driver.location)
        target_loc = locations.get(target_location)
        
        if not current_loc or not target_loc:
            print(f"✗ Invalid locations!")
            return
        
        # Simple linear animation (move in 5 steps)
        steps = 5
        for step in range(1, steps + 1):
            # Update driver location (simplified - just set to target on last step)
            if step == steps:
                driver.location = target_location
            else:
                # For intermediate steps, we could calculate intermediate positions
                pass
            
            print(f"  Step {step}/{steps}: Driver at location {driver.location}")
            
            # Update trip progress in the main trips dict
            if trip_id in self.trips:
                trip = self.trips[trip_id]
                # You could update some progress field here
            
            time.sleep(1)  # 1 second between steps
        
        print(f"✓ Driver reached {target_location}!")
    
    def cancel_trip(self, trip_id: int) -> bool:
        """Cancel a trip"""
        if trip_id not in self.trips:
            return False
        
        trip = self.trips[trip_id]
        if not trip.is_active():
            return False
        
        success = trip.cancel()
        
        if success and trip.driver_id and trip.driver_id in self.drivers:
            self.drivers[trip.driver_id].cancel_trip()
        
        return success
    
    def get_analytics(self) -> Dict:
        """Get system analytics"""
        total_trips = len(self.trips)
        completed = len([t for t in self.trips.values() if t.status == TripStatus.COMPLETED])
        cancelled = len([t for t in self.trips.values() if t.status == TripStatus.CANCELLED])
        active = len([t for t in self.trips.values() if t.is_active()])
        
        total_distance = sum(t.distance for t in self.trips.values())
        total_fare = sum(t.fare for t in self.trips.values())
        
        avg_distance = total_distance / completed if completed > 0 else 0
        avg_fare = total_fare / completed if completed > 0 else 0
        
        available_drivers = len([d for d in self.drivers.values() if d.is_available()])
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
        return len(rolled_back) > 0