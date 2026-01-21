import heapq
import math
from typing import List, Dict, Optional, Tuple, Set

class Location:
    def __init__(self, id: int, x: float, y: float, zone: str):
        self.id = id
        self.x = x
        self.y = y
        self.zone = zone
        
    def to_dict(self):
        return {
            'id': self.id,
            'x': self.x,
            'y': self.y,
            'zone': self.zone
        }

class Zone:
    def __init__(self, name: str, zone_id: int, x: float, y: float, width: float, height: float):
        self.name = name
        self.id = zone_id
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.locations: Set[int] = set()
        
    def add_location(self, location_id: int):
        self.locations.add(location_id)
        
    def contains_point(self, x: float, y: float) -> bool:
        return (self.x <= x <= self.x + self.width and 
                self.y <= y <= self.y + self.height)
    
    def get_center(self) -> Tuple[float, float]:
        return (self.x + self.width / 2, self.y + self.height / 2)
    
    def to_dict(self):
        return {
            'name': self.name,
            'id': self.id,
            'x': self.x,
            'y': self.y,
            'width': self.width,
            'height': self.height,
            'center_x': self.x + self.width / 2,
            'center_y': self.y + self.height / 2,
            'location_count': len(self.locations)
        }

class City:
    def __init__(self, width: float = 800, height: float = 600):
        self.width = width
        self.height = height
        self.locations: Dict[int, Location] = {}
        self.zones: Dict[str, Zone] = {}
        self.adjacency_list: Dict[int, List[Tuple[int, float]]] = {}
        self.next_location_id = 0
        
    def create_zones(self, rows: int = 3, cols: int = 3):
        """Create a grid of zones"""
        zone_width = self.width / cols
        zone_height = self.height / rows
        
        zone_id = 0
        for row in range(rows):
            for col in range(cols):
                zone_name = f"Zone {zone_id}"
                zone = Zone(
                    name=zone_name,
                    zone_id=zone_id,
                    x=col * zone_width,
                    y=row * zone_height,
                    width=zone_width,
                    height=zone_height
                )
                self.zones[zone_name] = zone
                zone_id += 1
                
        # Create locations in each zone
        locations_per_zone = 3
        for zone_name, zone in self.zones.items():
            for i in range(locations_per_zone):
                # Place location randomly within zone
                x = zone.x + (zone.width / (locations_per_zone + 1)) * (i + 1)
                y = zone.y + zone.height / 2 + (zone.height / 4) * (i - 1)
                
                location = Location(
                    id=self.next_location_id,
                    x=x,
                    y=y,
                    zone=zone_name
                )
                self.locations[self.next_location_id] = location
                zone.add_location(self.next_location_id)
                self.adjacency_list[self.next_location_id] = []
                self.next_location_id += 1
                
        # Connect locations within zones and between adjacent zones
        self._create_roads()
        
    def _create_roads(self):
        """Create roads between locations"""
        # Connect locations within same zone
        for zone in self.zones.values():
            locations = list(zone.locations)
            for i in range(len(locations)):
                for j in range(i + 1, len(locations)):
                    loc1 = self.locations[locations[i]]
                    loc2 = self.locations[locations[j]]
                    distance = self._calculate_distance(loc1.x, loc1.y, loc2.x, loc2.y)
                    self.add_road(loc1.id, loc2.id, distance)
        
        # Connect locations between adjacent zones
        zone_list = list(self.zones.values())
        for i in range(len(zone_list)):
            for j in range(i + 1, len(zone_list)):
                zone1 = zone_list[i]
                zone2 = zone_list[j]
                
                # Check if zones are adjacent (touching or very close)
                x_overlap = (zone1.x < zone2.x + zone2.width and 
                           zone1.x + zone1.width > zone2.x)
                y_overlap = (zone1.y < zone2.y + zone2.height and 
                           zone1.y + zone1.height > zone2.y)
                
                if x_overlap or y_overlap:
                    # Connect nearest locations between zones
                    loc1 = min(zone1.locations, 
                              key=lambda lid: self._distance_to_zone_center(lid, zone2))
                    loc2 = min(zone2.locations, 
                              key=lambda lid: self._distance_to_zone_center(lid, zone1))
                    
                    distance = self._calculate_distance(
                        self.locations[loc1].x, self.locations[loc1].y,
                        self.locations[loc2].x, self.locations[loc2].y
                    )
                    self.add_road(loc1, loc2, distance)
    
    def _distance_to_zone_center(self, location_id: int, zone: Zone) -> float:
        """Calculate distance from location to zone center"""
        loc = self.locations[location_id]
        center_x, center_y = zone.get_center()
        return self._calculate_distance(loc.x, loc.y, center_x, center_y)
    
    def _calculate_distance(self, x1: float, y1: float, x2: float, y2: float) -> float:
        """Calculate Euclidean distance between two points"""
        return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    
    def add_location(self, id: int, x: float, y: float, zone: str):
        """Add a location to the city"""
        if zone not in self.zones:
            # Create zone if it doesn't exist
            zone_obj = Zone(zone, len(self.zones), x - 50, y - 50, 100, 100)
            self.zones[zone] = zone_obj
        
        self.locations[id] = Location(id, x, y, zone)
        self.zones[zone].add_location(id)
        self.adjacency_list[id] = []
        
    def add_road(self, loc1_id: int, loc2_id: int, distance: float):
        """Add a road between two locations"""
        if loc1_id in self.adjacency_list and loc2_id in self.adjacency_list:
            self.adjacency_list[loc1_id].append((loc2_id, distance))
            self.adjacency_list[loc2_id].append((loc1_id, distance))
            
    def get_shortest_path(self, start: int, end: int) -> Tuple[List[int], float]:
        """Find shortest path using Dijkstra's algorithm"""
        if start not in self.locations or end not in self.locations:
            return [], float('inf')
            
        distances = {loc: float('inf') for loc in self.locations}
        predecessors = {loc: None for loc in self.locations}
        distances[start] = 0
        
        pq = [(0, start)]
        
        while pq:
            current_dist, current = heapq.heappop(pq)
            
            if current_dist > distances[current]:
                continue
                
            if current == end:
                break
                
            for neighbor, weight in self.adjacency_list[current]:
                distance = current_dist + weight
                if distance < distances[neighbor]:
                    distances[neighbor] = distance
                    predecessors[neighbor] = current
                    heapq.heappush(pq, (distance, neighbor))
        
        if distances[end] == float('inf'):
            return [], float('inf')
            
        path = []
        current = end
        while current is not None:
            path.append(current)
            current = predecessors[current]
        path.reverse()
        
        return path, distances[end]
    
    def get_locations_in_zone(self, zone: str) -> List[Location]:
        """Get all locations in a specific zone"""
        if zone not in self.zones:
            return []
        return [self.locations[loc_id] for loc_id in self.zones[zone].locations]
    
    def get_zone_of_location(self, loc_id: int) -> Optional[str]:
        """Get the zone of a specific location"""
        if loc_id in self.locations:
            return self.locations[loc_id].zone
        return None
    
    def get_location_by_point(self, x: float, y: float) -> Optional[int]:
        """Find location nearest to given point"""
        nearest = None
        min_distance = float('inf')
        
        for loc_id, location in self.locations.items():
            distance = self._calculate_distance(x, y, location.x, location.y)
            if distance < min_distance:
                min_distance = distance
                nearest = loc_id
                
        return nearest if min_distance < 50 else None  # 50 pixel threshold
    
    def to_dict(self):
        """Convert city data to dictionary for JSON serialization"""
        return {
            'width': self.width,
            'height': self.height,
            'locations': [loc.to_dict() for loc in self.locations.values()],
            'zones': [zone.to_dict() for zone in self.zones.values()],
            'roads': self._get_roads_data()
        }
    
    def _get_roads_data(self):
        """Get road data for visualization"""
        roads = []
        visited = set()
        
        for loc1_id, neighbors in self.adjacency_list.items():
            for loc2_id, distance in neighbors:
                if (loc2_id, loc1_id) not in visited:
                    loc1 = self.locations[loc1_id]
                    loc2 = self.locations[loc2_id]
                    roads.append({
                        'from': loc1_id,
                        'to': loc2_id,
                        'from_x': loc1.x,
                        'from_y': loc1.y,
                        'to_x': loc2.x,
                        'to_y': loc2.y,
                        'distance': distance
                    })
                    visited.add((loc1_id, loc2_id))
        
        return roads