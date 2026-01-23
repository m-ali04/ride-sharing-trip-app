# Create a new file: modules/simple_system.py
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

class SimpleRideShareSystem:
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
        
        # Initialize
        self._initialize_city()
        self.initialize_sample_data()
        
    def _initialize_city(self):
        """Initialize city with proper zone layout"""
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
        
        self.next_driver_id = 1
        self.next_rider_id = 1
        self.next_trip_id = 1
        
        # Add 3 drivers
        drivers_data = [
            ("John", 0, "Toyota", "JHN001"),
            ("Sarah", 4, "Honda", "SRH002"),
            ("Mike", 8, "Tesla", "MIK003")
        ]
        
        for name, location, vehicle, plate in drivers_data:
            driver = self.add_driver(name, location, vehicle, plate)
            print(f"Added driver: {driver.name} at location {driver.location}")
        
        # Add 3 riders
        riders_data = [
            ("Alice", "alice@email.com"),
            ("Bob", "bob@email.com"),
            ("Charlie", "charlie@email.com")
        ]
        
        for name, email in riders_data:
            self.add_rider(name, email)
            print(f"Added rider: {name}")
    
    def add_driver(self, name: str, location: int = 0, vehicle: str = "Car", license_plate: str = "") -> Driver:
        """Add a new driver"""
        driver_id = self.next_driver_id
        self.next_driver_id += 1
        
        driver = Driver(driver_id, name, location)
        driver.vehicle = vehicle
        driver.license_plate = license_plate
        driver.status = DriverStatus.AVAILABLE
        
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
        """Request a new trip - SIMPLE WORKING VERSION"""
        print(f"\n=== REQUESTING TRIP ===")
        print(f"Rider: {rider_id}, Pickup: {pickup}, Dropoff: {dropoff}")
        
        # Create trip
        trip_id = self.next_trip_id
        self.next_trip_id += 1
        
        trip = Trip(trip_id, rider_id, pickup, dropoff)
        self.trips[trip_id] = trip
        print(f"Created trip {trip_id} with status: {trip.status}")
        
        # Find available drivers
        available_drivers = [d for d in self.drivers.values() if d.is_available()]
        print(f"Available drivers: {len(available_drivers)}")
        
        if available_drivers:
            # SIMPLE: Just pick the first available driver
            driver = available_drivers[0]
            print(f"Selected driver: {driver.name} (ID: {driver.id}) at location {driver.location}")
            
            # Assign driver
            if trip.assign_driver(driver.id):
                driver.assign_trip(trip_id)
                print(f"Driver assigned! Trip status: {trip.status}")
                
                # Start animation thread
                threading.Thread(target=self._animate_trip, args=(trip_id,), daemon=True).start()
            else:
                print("Failed to assign driver")
        else:
            print("No drivers available")
            trip.cancel()
        
        return trip
    
    def _animate_trip(self, trip_id: int):
        """Animate a trip through all stages"""
        print(f"\n=== STARTING ANIMATION FOR TRIP {trip_id} ===")
        
        if trip_id not in self.trips:
            return
        
        trip = self.trips[trip_id]
        driver = self.drivers.get(trip.driver_id) if trip.driver_id else None
        
        if not driver:
            print(f"No driver for trip {trip_id}")
            return
        
        print(f"Trip {trip_id}: {trip.pickup} -> {trip.dropoff}")
        print(f"Driver {driver.name} starting at location {driver.location}")
        
        # Stage 1: Move to pickup
        print(f"\nStage 1: Moving to pickup location {trip.pickup}")
        path, distance = self.city.get_shortest_path(driver.location, trip.pickup)
        
        if path:
            print(f"Path to pickup: {path}")
            for i, location in enumerate(path[1:], 1):  # Skip first (current location)
                time.sleep(1)  # 1 second per location
                driver.location = location
                print(f"Driver moved to location {location} ({i}/{len(path)-1})")
            
            # Reached pickup
            print(f"Reached pickup location {trip.pickup}")
            trip.start()
            print(f"Trip status: {trip.status}")
            
            # Wait 2 seconds at pickup
            time.sleep(2)
            
            # Stage 2: Move to dropoff
            print(f"\nStage 2: Moving to dropoff location {trip.dropoff}")
            path, distance = self.city.get_shortest_path(trip.pickup, trip.dropoff)
            
            if path:
                print(f"Path to dropoff: {path}")
                for i, location in enumerate(path[1:], 1):  # Skip first (pickup location)
                    time.sleep(1)  # 1 second per location
                    driver.location = location
                    print(f"Driver moved to location {location} ({i}/{len(path)-1})")
                
                # Reached dropoff
                print(f"Reached dropoff location {trip.dropoff}")
                
                # Calculate fare
                pickup_zone = self.city.get_zone_of_location(trip.pickup)
                dropoff_zone = self.city.get_zone_of_location(trip.dropoff)
                is_cross_zone = pickup_zone != dropoff_zone if pickup_zone and dropoff_zone else False
                fare = self.dispatch.calculate_fare(distance, is_cross_zone)
                
                # Complete trip
                trip.complete(distance, fare)
                driver.complete_trip(trip.dropoff)
                print(f"Trip completed! Distance: {distance}km, Fare: ${fare}")
                print(f"Trip status: {trip.status}")
                print(f"Driver {driver.name} now at location {driver.location}")
            else:
                print(f"No path from {trip.pickup} to {trip.dropoff}")
                trip.cancel()
        else:
            print(f"No path from driver location {driver.location} to pickup {trip.pickup}")
            trip.cancel()
        
        print(f"=== ANIMATION COMPLETE FOR TRIP {trip_id} ===\n")
    
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