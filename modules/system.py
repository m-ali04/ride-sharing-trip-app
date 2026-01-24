from typing import Dict, List, Optional, Tuple
from datetime import datetime
import copy
import time
import threading
import math

from .city import City
from .driver import Driver, DriverStatus
from .rider import Rider
from .trip import Trip, TripStatus
from .dispatch import DispatchEngine
from .rollback import RollbackManager, OperationType

class TripAnimation:
    """Handles animation and progression of a single trip"""
    
    def __init__(self, system, trip_id: int):
        self.system = system
        self.trip_id = trip_id
        self.current_path_index = 0
        self.path: List[int] = []
        self.animation_speed = 1  # locations per second
        self.is_animating = False
        self.current_stage = "requested"
        
    def start_animation(self):
        """Start the trip animation"""
        if self.trip_id not in self.system.trips:
            return
            
        trip = self.system.trips[self.trip_id]
        
        if trip.status == TripStatus.ASSIGNED and trip.driver_id:
            # Animate driver to pickup
            self.current_stage = "to_pickup"
            driver = self.system.drivers[trip.driver_id]
            driver_location = driver.location
            
            # Get path from driver to pickup
            self.path, distance = self.system.city.get_shortest_path(driver_location, trip.pickup)
            
            if self.path:
                self.is_animating = True
                self.animate_to_pickup()
                
        elif trip.status == TripStatus.ONGOING:
            # Animate to dropoff
            self.current_stage = "to_dropoff"
            self.path, distance = self.system.city.get_shortest_path(trip.pickup, trip.dropoff)
            
            if self.path:
                self.is_animating = True
                self.animate_to_dropoff()
    
    def animate_to_pickup(self):
        """Animate driver moving to pickup location"""
        if not self.is_animating or self.trip_id not in self.system.trips:
            return
            
        trip = self.system.trips[self.trip_id]
        if trip.status != TripStatus.ASSIGNED or not trip.driver_id:
            return
        
        if self.current_path_index < len(self.path):
            next_location = self.path[self.current_path_index]
            driver = self.system.drivers[trip.driver_id]
            
            # Update driver location
            driver.location = next_location
            self.current_path_index += 1
            
            # Schedule next movement if not at destination
            if self.current_path_index < len(self.path):
                threading.Timer(1.0 / self.animation_speed, self.animate_to_pickup).start()
            else:
                # Reached pickup - start the trip
                trip.start()
                self.current_stage = "pickup_reached"
                
                # Wait 2 seconds then start dropoff animation
                threading.Timer(2.0, self.start_dropoff_animation).start()
        else:
            self.is_animating = False
    
    def start_dropoff_animation(self):
        """Start animation to dropoff"""
        if self.trip_id not in self.system.trips:
            return
            
        trip = self.system.trips[self.trip_id]
        if trip.status == TripStatus.ONGOING:
            self.current_stage = "to_dropoff"
            self.path, distance = self.system.city.get_shortest_path(trip.pickup, trip.dropoff)
            self.current_path_index = 0
            
            if self.path:
                self.is_animating = True
                self.animate_to_dropoff()
    
    def animate_to_dropoff(self):
        """Animate driver moving to dropoff location"""
        if not self.is_animating or self.trip_id not in self.system.trips:
            return
            
        trip = self.system.trips[self.trip_id]
        if trip.status != TripStatus.ONGOING or not trip.driver_id:
            return
        
        if self.current_path_index < len(self.path):
            next_location = self.path[self.current_path_index]
            driver = self.system.drivers[trip.driver_id]
            
            # Update driver location
            driver.location = next_location
            self.current_path_index += 1
            
            # Schedule next movement if not at destination
            if self.current_path_index < len(self.path):
                threading.Timer(1.0 / self.animation_speed, self.animate_to_dropoff).start()
            else:
                # Reached dropoff - complete the trip
                self.complete_trip()
        else:
            self.is_animating = False
    
    def complete_trip(self):
        """Complete the trip with distance and fare calculation"""
        if self.trip_id not in self.system.trips:
            return
            
        trip = self.system.trips[self.trip_id]
        driver = self.system.drivers.get(trip.driver_id) if trip.driver_id else None
        
        # Calculate total path distance
        total_distance = self.calculate_path_distance()
        
        # Calculate fare
        pickup_zone = self.system.city.get_zone_of_location(trip.pickup)
        dropoff_zone = self.system.city.get_zone_of_location(trip.dropoff)
        is_cross_zone = pickup_zone != dropoff_zone if pickup_zone and dropoff_zone else False
        fare = self.system.dispatch.calculate_fare(total_distance, is_cross_zone)
        
        # Complete trip
        trip.complete(total_distance, fare)
        
        # Update driver
        if driver:
            driver.complete_trip(trip.dropoff)
        
        self.current_stage = "completed"
        self.is_animating = False
    
    def calculate_path_distance(self) -> float:
        """Calculate total distance of the traveled path"""
        total_distance = 0
        
        for i in range(len(self.path) - 1):
            loc1 = self.path[i]
            loc2 = self.path[i + 1]
            
            # Find road distance between these locations
            for (a, b), dist in self.system.city.roads.items():
                if (a == loc1 and b == loc2) or (a == loc2 and b == loc1):
                    total_distance += dist
                    break
        
        return total_distance
    
    def stop(self):
        """Stop animation"""
        self.is_animating = False

class RideShareSystem:
    def __init__(self):
        self.city = City()
        self.drivers: Dict[int, Driver] = {}
        self.riders: Dict[int, Rider] = {}
        self.trips: Dict[int, Trip] = {}
        self.dispatch = DispatchEngine(self.city)
        self.rollback_manager = RollbackManager()
        self.trip_animations: Dict[int, TripAnimation] = {}
        
        self.next_driver_id = 101  # Start from 101 for consistency
        self.next_rider_id = 101   # Start from 101 for consistency
        self.next_trip_id = 1
        
        # Initialize
        self._initialize_city()
        
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
        self.trip_animations.clear()
        
        self.next_driver_id = 101
        self.next_rider_id = 101
        self.next_trip_id = 1
        
        # Add sample drivers in different zones
        drivers_data = [
            ("John", 1, "Toyota Camry", "ABC123"),    # Zone 0
            ("Sarah", 4, "Honda Civic", "DEF456"),    # Zone 1
            ("Mike", 8, "Tesla Model 3", "GHI789"),   # Zone 2
            ("Lisa", 10, "Ford Focus", "JKL012"),     # Zone 3
            ("Alex", 13, "BMW X5", "MNO345")          # Zone 4
        ]
        
        for name, location, vehicle, plate in drivers_data:
            self.add_driver(name, location, vehicle, plate)
        
        # Add sample riders
        riders_data = [
            ("Alice", "alice@email.com"),
            ("Bob", "bob@email.com"),
            ("Charlie", "charlie@email.com"),
            ("Diana", "diana@email.com"),
            ("Ethan", "ethan@email.com")
        ]
        
        for name, email in riders_data:
            self.add_rider(name, email)
    
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
    
    def request_trip(self, rider_id: int, pickup: int, dropoff: int) -> Optional[Trip]:
        """Request a new trip - starts asynchronous processing"""
        if rider_id not in self.riders:
            raise ValueError(f"Rider {rider_id} not found")
        
        if pickup == dropoff:
            raise ValueError("Pickup and dropoff cannot be the same")
        
        # Create trip
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
        
        # Start asynchronous trip processing
        threading.Thread(target=self._process_trip_async, args=(trip_id,), daemon=True).start()
        
        return trip
    
    def _process_trip_async(self, trip_id: int):
        """Asynchronously process a trip through all stages - DEBUG VERSION"""
        print(f"\n=== DEBUG: Starting async processing for trip {trip_id} ===")
    
    try:
        trip = self.trips[trip_id]
        
        # Stage 1: Find and assign driver
        print(f"Stage 1: Assigning driver to trip {trip_id}")
        driver_assigned = self._assign_driver_to_trip(trip_id)
        
        if driver_assigned:
            print(f"✓ Driver assigned successfully!")
            print(f"Trip status after assignment: {trip.status}")
            print(f"Driver ID: {trip.driver_id}")
            
            # Check if driver exists
            if trip.driver_id in self.drivers:
                driver = self.drivers[trip.driver_id]
                print(f"Driver {driver.name} status: {driver.status}")
            
            # Stage 2: Start animation to pickup
            print(f"\nStage 2: Starting animation for trip {trip_id}")
            if trip.status == TripStatus.ASSIGNED:
                animation = TripAnimation(self, trip_id)
                self.trip_animations[trip_id] = animation
                print("Starting animation...")
                animation.start_animation()
                
                # Monitor trip progress
                print("Starting progress monitoring...")
                self._monitor_trip_progress(trip_id)
            else:
                print(f"✗ Trip is not in ASSIGNED state: {trip.status}")
        else:
            print(f"✗ Failed to assign driver to trip {trip_id}")
            # No driver available, cancel after timeout
            print("Waiting 5 seconds then cancelling trip...")
            time.sleep(5)
            if trip.status == TripStatus.REQUESTED:
                print("Cancelling trip due to no drivers...")
                trip.cancel()
                print(f"Trip status after cancellation: {trip.status}")
    
    except Exception as e:
        print(f"✗ ERROR processing trip {trip_id}: {str(e)}")
        import traceback
        traceback.print_exc()

    def _assign_driver_to_trip(self, trip_id: int) -> bool:
        """Assign nearest driver to trip - DEBUG VERSION"""
        trip = self.trips[trip_id]
    
        print(f"\n=== DEBUG: Assigning driver to trip {trip_id} ===")
        print(f"Trip pickup: {trip.pickup}, dropoff: {trip.dropoff}")
        print(f"Trip status: {trip.status}")
    
    if trip.status != TripStatus.REQUESTED:
        print(f"ERROR: Trip is not in REQUESTED state: {trip.status}")
        return False
    
    # Find available drivers
    available_drivers = []
    for driver_id, driver in self.drivers.items():
        print(f"Driver {driver_id} ({driver.name}): location={driver.location}, status={driver.status}, available={driver.is_available()}")
        if driver.is_available():
            available_drivers.append(driver)
    
    print(f"Total available drivers: {len(available_drivers)}")
    
    if not available_drivers:
        print("ERROR: No available drivers!")
        return False
    
    # Find nearest driver
    print(f"\nFinding nearest driver to pickup location {trip.pickup}...")
    driver = self.dispatch.find_nearest_driver(trip.pickup, available_drivers)
    
    if driver:
        print(f"Found driver: {driver.name} (ID: {driver.id}) at location {driver.location}")
        
        # Assign driver
        print(f"Attempting to assign driver {driver.id} to trip {trip_id}...")
        success = trip.assign_driver(driver.id)
        print(f"Trip.assign_driver() returned: {success}")
        
        if success:
            print(f"Calling driver.assign_trip({trip_id})...")
            driver.assign_trip(trip_id)
            print(f"Driver status after assignment: {driver.status}")
            print(f"Trip status after assignment: {trip.status}")
            
            # Calculate estimated fare
            distance = self.dispatch.calculate_trip_distance(trip.pickup, trip.dropoff)
            pickup_zone = self.city.get_zone_of_location(trip.pickup)
            dropoff_zone = self.city.get_zone_of_location(trip.dropoff)
            is_cross_zone = pickup_zone != dropoff_zone if pickup_zone and dropoff_zone else False
            trip.fare = self.dispatch.calculate_fare(distance, is_cross_zone)
            print(f"Calculated fare: ${trip.fare:.2f}")
            
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
            
            print(f"✓ SUCCESS: Driver {driver.name} assigned to trip {trip_id}")
            return True
        else:
            print(f"✗ FAILED: Could not assign driver to trip")
    else:
        print("✗ FAILED: No driver found (find_nearest_driver returned None)")
    
    return False

    def _monitor_trip_progress(self, trip_id: int):
        """Monitor trip progress and update state"""
        max_wait_time = 120  # 2 minutes max
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            if trip_id not in self.trips:
                break
            
            trip = self.trips[trip_id]
            
            if trip.status == TripStatus.COMPLETED or trip.status == TripStatus.CANCELLED:
                break
            
            time.sleep(0.5)
    
    def get_trip_progress(self, trip_id: int) -> Dict:
        """Get detailed progress info for a trip"""
        if trip_id not in self.trips:
            return {}
        
        trip = self.trips[trip_id]
        result = {
            'trip': trip.to_dict(),
            'stage': 'waiting',
            'progress_percentage': 0,
            'current_location': None,
            'next_location': None,
            'eta': None
        }
        
        if trip_id in self.trip_animations:
            animation = self.trip_animations[trip_id]
            result['stage'] = animation.current_stage
            
            if animation.is_animating and animation.path:
                total_steps = len(animation.path)
                current_step = animation.current_path_index
                
                if total_steps > 0:
                    result['progress_percentage'] = min(100, int((current_step / total_steps) * 100))
                    
                    if current_step < len(animation.path):
                        result['current_location'] = animation.path[max(0, current_step - 1)]
                        result['next_location'] = animation.path[current_step]
                        
                        # Calculate ETA
                        remaining_steps = total_steps - current_step
                        result['eta'] = f"{remaining_steps / animation.animation_speed:.1f}s"
        
        return result
    
    def cancel_trip(self, trip_id: int) -> bool:
        """Cancel a trip"""
        if trip_id not in self.trips:
            return False
        
        trip = self.trips[trip_id]
        
        if not trip.is_active():
            return False
        
        # Stop animation if running
        if trip_id in self.trip_animations:
            self.trip_animations[trip_id].stop()
            del self.trip_animations[trip_id]
        
        # Get previous state for rollback
        previous_state = copy.deepcopy(trip.to_dict())
        
        # Cancel trip
        success = trip.cancel()
        
        if success:
            # Free driver if assigned
            if trip.driver_id and trip.driver_id in self.drivers:
                self.drivers[trip.driver_id].cancel_trip()
            
            self.rollback_manager.add_operation(
                OperationType.CANCEL_TRIP,
                {'trip_id': trip_id},
                {'previous_state': previous_state}
            )
            
        return success
    
    def get_active_animations(self) -> List[Dict]:
        """Get all active trip animations"""
        animations = []
        for trip_id, animation in self.trip_animations.items():
            if animation.is_animating and trip_id in self.trips:
                trip = self.trips[trip_id]
                animations.append({
                    'trip_id': trip_id,
                    'stage': animation.current_stage,
                    'driver_id': trip.driver_id,
                    'path': animation.path,
                    'current_index': animation.current_path_index
                })
        return animations
    
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
            'total_riders': len(self.riders),
            'active_animations': len([a for a in self.trip_animations.values() if a.is_animating])
        }
    
    def get_state(self) -> Dict:
        """Get complete system state"""
        return {
            'city': self.city.to_dict(),
            'drivers': [d.to_dict() for d in self.drivers.values()],
            'riders': [r.to_dict() for r in self.riders.values()],
            'trips': [t.to_dict() for t in self.trips.values()],
            'analytics': self.get_analytics(),
            'active_animations': self.get_active_animations()
        }
    
    def rollback(self, k: int = 1) -> bool:
        """Rollback last k operations"""
        rolled_back = self.rollback_manager.rollback(k)
        return len(rolled_back) > 0