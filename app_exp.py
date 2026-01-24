from flask import Flask, render_template, jsonify, request, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from modules.system import RideShareSystem
import json
import time
import threading

app = Flask(__name__)
app.secret_key = 'ride-sharing-secret-key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Global system instance
system = RideShareSystem()

def broadcast_system_update():
    """Broadcast system update to all connected clients"""
    try:
        system_state = system.get_state()
        socketio.emit('system_update', {
            'type': 'full_update',
            'data': system_state,
            'timestamp': time.time()
        })
        print(f"Broadcast system update at {time.time()}")
    except Exception as e:
        print(f"Error broadcasting update: {e}")

def broadcast_trip_update(trip_id, status, stage=None):
    """Broadcast trip update to all connected clients"""
    try:
        trip_progress = system.get_trip_progress(trip_id)
        socketio.emit('trip_update', {
            'trip_id': trip_id,
            'status': status,
            'stage': stage,
            'progress': trip_progress,
            'timestamp': time.time()
        })
        print(f"Broadcast trip {trip_id} update: {status}")
    except Exception as e:
        print(f"Error broadcasting trip update: {e}")

# Start update broadcast thread
def start_update_thread():
    """Thread to broadcast periodic updates"""
    def update_loop():
        while True:
            try:
                # Check for animation updates
                active_animations = system.get_active_animations()
                for animation in active_animations:
                    broadcast_trip_update(
                        animation['trip_id'],
                        'animating',
                        animation['stage']
                    )
                
                # Broadcast full update every 3 seconds
                broadcast_system_update()
                
            except Exception as e:
                print(f"Update thread error: {e}")
            
            time.sleep(3)  # Update every 3 seconds
    
    thread = threading.Thread(target=update_loop, daemon=True)
    thread.start()

start_update_thread()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/api/init', methods=['POST'])
def init_system():
    """Initialize system with sample data"""
    try:
        system.initialize_sample_data()
        broadcast_system_update()
        return jsonify({
            'success': True,
            'message': 'System initialized successfully',
            'system': system.get_state()
        })
    except Exception as e:
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
        
        print(f"Requesting trip: rider={rider_id}, pickup={pickup}, dropoff={dropoff}")
        
        trip = system.request_trip(rider_id, pickup, dropoff)
        
        # Broadcast initial trip creation
        broadcast_trip_update(trip.id, trip.status.value)
        
        return jsonify({
            'success': True,
            'message': 'Trip requested successfully',
            'trip': trip.to_dict(),
            'system': system.get_state()
        })
    except Exception as e:
        print(f"Error requesting trip: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/trip/<int:trip_id>/progress', methods=['GET'])
def get_trip_progress(trip_id):
    """Get trip progress details"""
    try:
        progress = system.get_trip_progress(trip_id)
        return jsonify({
            'success': True,
            'progress': progress
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/trip/<int:trip_id>/cancel', methods=['POST'])
def cancel_trip(trip_id):
    """Cancel a trip"""
    try:
        success = system.cancel_trip(trip_id)
        
        if success:
            broadcast_trip_update(trip_id, 'CANCELLED')
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
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/rider/add', methods=['POST'])
def add_rider():
    """Add a new rider"""
    try:
        data = request.json
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
    print(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to RideShare Live', 'timestamp': time.time()})
    # Send immediate update
    broadcast_system_update()

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

@socketio.on('request_update')
def handle_request_update():
    """Send immediate update to requesting client"""
    emit('system_update', {
        'type': 'full_update',
        'data': system.get_state(),
        'timestamp': time.time()
    })

if __name__ == '__main__':
    print("Starting RideShare System...")
    print("Open http://localhost:5000 in your browser")
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)