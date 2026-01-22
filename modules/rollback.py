from typing import List, Dict, Any
from enum import Enum

class OperationType(Enum):
    ADD_DRIVER = "ADD_DRIVER"
    ADD_RIDER = "ADD_RIDER"
    CREATE_TRIP = "CREATE_TRIP"
    ASSIGN_DRIVER = "ASSIGN_DRIVER"
    START_TRIP = "START_TRIP"
    COMPLETE_TRIP = "COMPLETE_TRIP"
    CANCEL_TRIP = "CANCEL_TRIP"

class Operation:
    def __init__(self, op_type: OperationType, data: Dict[str, Any]):
        self.type = op_type
        self.data = data
        self.reverse_data: Dict[str, Any] = {}

class RollbackManager:
    def __init__(self, max_history: int = 50):
        self.history: List[Operation] = []
        self.max_history = max_history
        
    def add_operation(self, op_type: OperationType, data: Dict[str, Any], reverse_data: Dict[str, Any] = None):
        """Add an operation to history"""
        operation = Operation(op_type, data)
        if reverse_data:
            operation.reverse_data = reverse_data
        self.history.append(operation)
        
        # Keep history within limit
        if len(self.history) > self.max_history:
            self.history.pop(0)
    
    def rollback(self, k: int = 1) -> List[Dict[str, Any]]:
        """Rollback last k operations"""
        if k <= 0 or k > len(self.history):
            return []
            
        rolled_back = []
        for _ in range(k):
            if self.history:
                operation = self.history.pop()
                rolled_back.append({
                    'type': operation.type.value,
                    'data': operation.data,
                    'reverse_data': operation.reverse_data
                })
                
        return rolled_back
    
    def clear(self):
        """Clear history"""
        self.history.clear()