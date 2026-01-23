from typing import List, Optional, Tuple
from .city import City
from .driver import Driver
from .trip import Trip

class DispatchEngine:
    def __init__(self, city: City):
        self.city = city
        self.zone_crossing_penalty = 1.5
        
    def find_nearest_driver(self, pickup_location: int, drivers: List[Driver]) -> Optional[Driver]:
        """Find nearest available driver to pickup location - PROPER IMPLEMENTATION"""
        available_drivers = [d for d in drivers if d.is_available()]
        if not available_drivers:
            return None
            
        nearest = None
        min_distance = float('inf')
        
        for driver in available_drivers:
            path, distance = self.city.get_shortest_path(driver.location, pickup_location)
            
            # Apply zone crossing penalty if crossing zones
            driver_zone = self.city.get_zone_of_location(driver.location)
            pickup_zone = self.city.get_zone_of_location(pickup_location)
            
            if driver_zone and pickup_zone and driver_zone != pickup_zone:
                distance *= self.zone_crossing_penalty
                
            if distance < min_distance:
                min_distance = distance
                nearest = driver
                
        return nearest
    
    def calculate_fare(self, distance: float, is_cross_zone: bool = False) -> float:
        """Calculate fare based on distance"""
        base_fare = 2.5
        per_km = 1.5
        
        if is_cross_zone:
            per_km *= 1.2
            
        return base_fare + (distance * per_km)
    
    def calculate_trip_distance(self, pickup: int, dropoff: int) -> float:
        """Calculate distance between pickup and dropoff"""
        path, distance = self.city.get_shortest_path(pickup, dropoff)
        return distance