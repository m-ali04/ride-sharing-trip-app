from typing import List

class Rider:
    def __init__(self, id: int, name: str, email: str = ""):
        self.id = id
        self.name = name
        self.email = email
        self.trip_history: List[int] = []
        
    def add_trip(self, trip_id: int):
        """Add trip to rider's history"""
        self.trip_history.append(trip_id)
        
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'trip_count': len(self.trip_history)
        }