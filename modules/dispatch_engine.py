from typing import List, Optional, Dict
import heapq
from .city import City
from .driver import Driver
from .trip import Trip

class DispatchEngine:
    def __init__(self, city: City):
        self.city = city
        self.zone_crossing_penalty = 1.5  # Penalty factor for cross-zone assignments
        
    def find_nearest_driver(self, pickup_location: int, available_drivers: List[Driver]) -> Optional[Driver]:
        """Find the nearest available driver to pickup location"""
        if not available_drivers:
            return None
            
        nearest_driver = None
        min_distance = float('inf')
        
        for driver in available_drivers:
            path, distance = self.city.get_shortest_path(driver.location, pickup_location)
            
            # Apply zone crossing penalty
            driver_zone = self.city.get_zone_of_location(driver.location)
            pickup_zone = self.city.get_zone_of_location(pickup_location)
            
            if driver_zone and pickup_zone and driver_zone != pickup_zone:
                distance *= self.zone_crossing_penalty
            
            if distance < min_distance:
                min_distance = distance
                nearest_driver = driver
                
        return nearest_driver
    
    def calculate_estimated_fare(self, distance: float, is_cross_zone: bool = False) -> float:
        """Calculate estimated fare based on distance"""
        base_fare = 2.5
        per_km_rate = 1.5
        
        if is_cross_zone:
            per_km_rate *= 1.2  # 20% extra for cross-zone trips
            
        return base_fare + (distance * per_km_rate)
    
    def get_route_distance(self, start: int, end: int) -> float:
        """Get distance between two locations"""
        path, distance = self.city.get_shortest_path(start, end)
        return distance