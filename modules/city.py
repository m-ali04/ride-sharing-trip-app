import heapq
from typing import List, Dict, Optional, Tuple

class Location:
    def __init__(self, id: int, x: int, y: int, zone: str):
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

class City:
    def __init__(self):
        self.locations: Dict[int, Location] = {}
        self.roads: Dict[Tuple[int, int], float] = {}
        self.zones: Dict[str, List[int]] = {}
        
    def add_location(self, id: int, x: int, y: int, zone: str):
        """Add a location to the city"""
        self.locations[id] = Location(id, x, y, zone)
        if zone not in self.zones:
            self.zones[zone] = []
        self.zones[zone].append(id)
        
    def add_road(self, loc1_id: int, loc2_id: int, distance: float):
        """Add a road between two locations"""
        key = (min(loc1_id, loc2_id), max(loc1_id, loc2_id))
        self.roads[key] = distance
        
    def get_shortest_path(self, start: int, end: int) -> Tuple[List[int], float]:
        """Find shortest path using Dijkstra's algorithm"""
        if start not in self.locations or end not in self.locations:
            return [], float('inf')
            
        # Build adjacency list
        adj = {loc_id: [] for loc_id in self.locations}
        for (a, b), dist in self.roads.items():
            adj[a].append((b, dist))
            adj[b].append((a, dist))
        
        # Dijkstra's algorithm
        distances = {loc_id: float('inf') for loc_id in self.locations}
        prev = {loc_id: None for loc_id in self.locations}
        distances[start] = 0
        
        pq = [(0, start)]
        
        while pq:
            current_dist, current = heapq.heappop(pq)
            
            if current_dist > distances[current]:
                continue
                
            if current == end:
                break
                
            for neighbor, weight in adj[current]:
                dist = current_dist + weight
                if dist < distances[neighbor]:
                    distances[neighbor] = dist
                    prev[neighbor] = current
                    heapq.heappush(pq, (dist, neighbor))
        
        # Reconstruct path
        if distances[end] == float('inf'):
            return [], float('inf')
            
        path = []
        current = end
        while current is not None:
            path.append(current)
            current = prev[current]
        path.reverse()
        
        return path, distances[end]
    
    def get_zone_of_location(self, loc_id: int) -> Optional[str]:
        """Get zone of a location"""
        if loc_id in self.locations:
            return self.locations[loc_id].zone
        return None
    
    def get_locations_in_zone(self, zone: str) -> List[Location]:
        """Get all locations in a zone"""
        if zone not in self.zones:
            return []
        return [self.locations[loc_id] for loc_id in self.zones[zone]]
    
    def to_dict(self):
        """Convert city to dictionary"""
        return {
            'locations': [loc.to_dict() for loc in self.locations.values()],
            'zones': [
                {'name': zone, 'locations': loc_ids}
                for zone, loc_ids in self.zones.items()
            ],
            'roads': [
                {'from': a, 'to': b, 'distance': dist}
                for (a, b), dist in self.roads.items()
            ]
        }