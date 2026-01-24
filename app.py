from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from modules.working_system import WorkingRideShareSystem
import time
import threading

app = Flask(__name__)
app.secret_key = 'ride-sharing-secret-key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Global system instance
system = WorkingRideShareSystem()

def broadcast_system_update():
    """Broadcast system update to all connected clients"""
    try:
        system_state = system.get_state()
        socketio.emit('system_update', {
            'type': 'full_update',
            'data': system_state,
            'timestamp': time.time()
        })
        print(f"✓ Broadcast system update")
    except Exception as e:
        print(f"✗ Error broadcasting update: {e}")

# Start update broadcast thread
def start_update_thread():
    """Thread to broadcast periodic updates"""
    def update_loop():
        while True:
            try:
                broadcast_system_update()
            except Exception as e:
                print(f"Update thread error: {e}")
            
            time.sleep(2)  # Update every 2 seconds
    
    thread = threading.Thread(target=update_loop, daemon=True)
    thread.start()

start_update_thread()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/init', methods=['POST'])
def init_system():
    """Initialize system with sample data"""
    try:
        print("\n=== API: Initializing system ===")
        system.initialize_sample_data()
        broadcast_system_update()
        return jsonify({
            'success': True,
            'message': 'System initialized successfully',
            'system': system.get_state()
        })
    except Exception as e:
        print(f"✗ Error initializing system: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/system/state', methods=['GET'])
def get_system_state():
    """Get current system state"""
    try:
        return jsonify({
            'success': True,
            'system': system.get_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/trip/request', methods=['POST'])
def request_trip():
    """Request a new trip"""
    try:
        data = request.json
        rider_id = int(data['rider_id'])
        pickup = int(data['pickup'])
        dropoff = int(data['dropoff'])
        
        print(f"\n=== API: Requesting trip ===")
        print(f"Rider: {rider_id}, Pickup: {pickup}, Dropoff: {dropoff}")
        
        trip = system.request_trip(rider_id, pickup, dropoff)
        
        if trip:
            # Send immediate update
            broadcast_system_update()
            
            return jsonify({
                'success': True,
                'message': 'Trip requested successfully',
                'trip': trip.to_dict(),
                'system': system.get_state()
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to create trip'
            })
    except Exception as e:
        print(f"✗ Error requesting trip: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/trip/<int:trip_id>/cancel', methods=['POST'])
def cancel_trip(trip_id):
    """Cancel a trip"""
    try:
        print(f"\n=== API: Cancelling trip {trip_id} ===")
        success = system.cancel_trip(trip_id)
        
        if success:
            broadcast_system_update()
        
        return jsonify({
            'success': success,
            'system': system.get_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/driver/add', methods=['POST'])
def add_driver():
    """Add a new driver"""
    try:
        data = request.json
        print(f"\n=== API: Adding driver ===")
        print(f"Data: {data}")
        
        driver = system.add_driver(
            name=data['name'],
            location=int(data.get('location', 0)),
            vehicle=data.get('vehicle', 'Car'),
            license_plate=data.get('license_plate', '')
        )
        
        broadcast_system_update()
        
        return jsonify({
            'success': True,
            'driver': driver.to_dict()
        })
    except Exception as e:
        print(f"✗ Error adding driver: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/rider/add', methods=['POST'])
def add_rider():
    """Add a new rider"""
    try:
        data = request.json
        print(f"\n=== API: Adding rider ===")
        print(f"Data: {data}")
        
        rider = system.add_rider(
            name=data['name'],
            email=data.get('email', '')
        )
        
        broadcast_system_update()
        
        return jsonify({
            'success': True,
            'rider': rider.to_dict()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    """Get system analytics"""
    try:
        return jsonify({
            'success': True,
            'analytics': system.get_analytics()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/rollback', methods=['POST'])
def rollback():
    """Rollback last k operations"""
    try:
        data = request.json
        k = int(data.get('k', 1))
        success = system.rollback(k)
        
        if success:
            broadcast_system_update()
        
        return jsonify({
            'success': success,
            'system': system.get_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    print("✓ Client connected")
    emit('connected', {'message': 'Connected to RideShare', 'timestamp': time.time()})
    broadcast_system_update()

@socketio.on('disconnect')
def handle_disconnect():
    print("✗ Client disconnected")

if __name__ == '__main__':
    print("\n" + "="*50)
    print("RIDESHARE DISPATCH SYSTEM - GUARANTEED WORKING")
    print("="*50)
    print("Open http://localhost:5000 in your browser")
    print("\nSample data:")
    print("- Rider IDs: 101, 102, 103")
    print("- Location IDs: 0-14")
    print("- First request will use driver at location 0")
    print("="*50 + "\n")
    
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)