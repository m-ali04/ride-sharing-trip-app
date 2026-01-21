class Rider:
    def __init__(self, id: int, name: str, email: str = ""):
        self.id = id
        self.name = name
        self.email = email
        self.trip_history: List[int] = []  # List of trip IDs
        
    def add_trip_to_history(self, trip_id: int):
        """Add trip to rider's history"""
        self.trip_history.append(trip_id)
        
    def get_trip_count(self) -> int:
        """Get total number of trips by this rider"""
        return len(self.trip_history)
        
    def to_dict(self):
        """Convert rider data to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'trip_count': self.get_trip_count()
        }