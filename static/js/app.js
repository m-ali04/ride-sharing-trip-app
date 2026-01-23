class RideSharingApp {
    constructor() {
        this.systemState = null;
        this.activeAnimations = new Map();
        this.driverPaths = new Map();
        this.init();
    }

    init() {
        this.bindEvents();
        this.connectWebSocket();
        this.loadSystemState();
        this.startAnimationLoop();
    }

    connectWebSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to live server');
            this.showNotification('Connected to RideShare Live System', 'success');
        });

        this.socket.on('system_update', (data) => {
            this.handleSystemUpdate(data);
        });

        this.socket.on('trip_update', (data) => {
            this.handleTripUpdate(data);
        });

        this.socket.on('disconnect', () => {
            this.showNotification('Disconnected from server', 'error');
        });
    }

    handleSystemUpdate(data) {
        this.systemState = data.data;
        this.updateDashboard();
        this.renderCityMap();
    }

    handleTripUpdate(data) {
        console.log(`Trip update: ${data.trip_id} - ${data.status} - ${data.stage}`);

        // Show notification for important updates
        if (data.status === 'CANCELLED') {
            this.showNotification(`Trip #${data.trip_id} cancelled`, 'warning');
        } else if (data.status === 'COMPLETED') {
            this.showNotification(`Trip #${data.trip_id} completed successfully!`, 'success');
        } else if (data.stage === 'to_pickup') {
            this.showNotification(`Trip #${data.trip_id}: Driver heading to pickup`, 'info');
        } else if (data.stage === 'to_dropoff') {
            this.showNotification(`Trip #${data.trip_id}: Heading to destination`, 'info');
        }

        // Update animation
        if (data.progress) {
            this.updateTripAnimation(data.trip_id, data.progress);
        }

        // Refresh dashboard
        setTimeout(() => this.loadSystemState(), 500);
    }

    updateTripAnimation(tripId, progress) {
        if (progress.stage === 'to_pickup' || progress.stage === 'to_dropoff') {
            this.activeAnimations.set(tripId, progress);

            // Draw path for this trip
            if (progress.trip && progress.trip.driver_id) {
                this.drawDriverPath(progress.trip.driver_id, progress);
            }
        } else if (progress.stage === 'completed') {
            this.activeAnimations.delete(tripId);
            this.driverPaths.delete(progress.trip.driver_id);
        }
    }

    drawDriverPath(driverId, progress) {
        const trip = progress.trip;
        if (!trip) return;

        // Calculate path points
        let pathPoints = [];

        if (this.systemState && this.systemState.city) {
            const locations = this.systemState.city.locations;

            if (progress.stage === 'to_pickup' && trip.driver_id) {
                const driver = this.systemState.drivers.find(d => d.id === driverId);
                if (driver) {
                    // Simulate path from driver to pickup
                    const startLoc = locations.find(l => l.id === driver.location);
                    const endLoc = locations.find(l => l.id === trip.pickup);

                    if (startLoc && endLoc) {
                        pathPoints = this.interpolatePath(startLoc, endLoc, 10);
                    }
                }
            } else if (progress.stage === 'to_dropoff') {
                const startLoc = locations.find(l => l.id === trip.pickup);
                const endLoc = locations.find(l => l.id === trip.dropoff);

                if (startLoc && endLoc) {
                    pathPoints = this.interpolatePath(startLoc, endLoc, 10);
                }
            }
        }

        if (pathPoints.length > 0) {
            this.driverPaths.set(driverId, {
                path: pathPoints,
                progress: progress.progress_percentage || 0,
                color: progress.stage === 'to_pickup' ? '#3b82f6' : '#10b981'
            });
        }
    }

    interpolatePath(startLoc, endLoc, steps) {
        const points = [];
        for (let i = 0; i <= steps; i++) {
            const ratio = i / steps;
            const x = startLoc.x + (endLoc.x - startLoc.x) * ratio;
            const y = startLoc.y + (endLoc.y - startLoc.y) * ratio;
            points.push({ x, y });
        }
        return points;
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.target.getAttribute('onclick').match(/showPage\('(\w+)'\)/)[1];
                this.showPage(page);
            });
        });

        // Bind trip action buttons
        document.addEventListener('click', (e) => {
            const tripActionBtn = e.target.closest('.trip-action-btn');
            if (tripActionBtn) {
                const tripId = parseInt(tripActionBtn.getAttribute('data-trip-id'));
                const action = tripActionBtn.getAttribute('data-action');
                this.updateTripStatus(tripId, action);
            }
        });
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(`${pageId}-page`).classList.add('active');

        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.nav-btn[onclick="showPage('${pageId}')"]`).classList.add('active');

        if (pageId === 'dashboard') {
            this.loadSystemState();
        } else if (pageId === 'analytics') {
            this.loadAnalytics();
        }
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    showNotification(message, type = 'info') {
        const notificationArea = document.getElementById('notification-area');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div>${message}</div>
            <button class="close-btn" onclick="this.parentElement.remove()">&times;</button>
        `;
        notificationArea.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 5000);
    }

    async loadSystemState() {
        try {
            const response = await fetch('/api/system/state');
            const data = await response.json();

            if (data.success) {
                this.systemState = data.system;
                this.updateDashboard();
                this.renderCityMap();
            }
        } catch (error) {
            console.error('Error loading system state:', error);
        }
    }

    updateDashboard() {
        if (!this.systemState) return;

        const analytics = this.systemState.analytics;

        // Update stats
        document.getElementById('total-trips').textContent = analytics.total_trips;
        document.getElementById('active-trips').textContent = analytics.active_trips;
        document.getElementById('available-drivers').textContent = analytics.available_drivers;
        document.getElementById('total-riders').textContent = analytics.total_riders;

        // Update drivers list
        const driversList = document.getElementById('drivers-list');
        driversList.innerHTML = this.systemState.drivers.map(driver => {
            const isBusy = !driver.available;
            const activeTrip = isBusy ?
                Array.from(this.activeAnimations.entries()).find(([id, progress]) =>
                    progress.trip && progress.trip.driver_id === driver.id
                ) : null;

            return `
                <div class="list-item">
                    <div>
                        <strong>${driver.name}</strong><br>
                        <small>${driver.vehicle} • ${driver.license_plate || 'No plate'}</small><br>
                        <small>Location: ${driver.location}</small>
                        ${isBusy && activeTrip ?
                    `<br><small style="color: var(--warning);">On Trip #${activeTrip[0]}</small>` : ''}
                    </div>
                    <div>
                        <span class="status-badge ${driver.available ? 'status-ongoing' : 'status-cancelled'}">
                            ${driver.available ? 'Available' : 'Busy'}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        // Update riders list
        const ridersList = document.getElementById('riders-list');
        ridersList.innerHTML = this.systemState.riders.map(rider => `
            <div class="list-item">
                <div>
                    <strong>${rider.name}</strong><br>
                    <small>${rider.email || 'No email'}</small><br>
                    <small>ID: ${rider.id} • Trips: ${rider.trip_count}</small>
                </div>
            </div>
        `).join('');

        // Update active trips with progress
        const tripsList = document.getElementById('trips-list');
        const activeTrips = this.systemState.trips.filter(trip => trip.is_active);

        tripsList.innerHTML = activeTrips.map(trip => {
            const progress = this.activeAnimations.get(trip.id) || {};
            const stage = progress.stage || 'waiting';
            const progressPercent = progress.progress_percentage || 0;

            let stageText = '';
            let progressBar = '';

            if (stage === 'to_pickup') {
                stageText = `Driver heading to pickup (${progressPercent}%)`;
                progressBar = this.createProgressBar(progressPercent, 'blue');
            } else if (stage === 'to_dropoff') {
                stageText = `Heading to destination (${progressPercent}%)`;
                progressBar = this.createProgressBar(progressPercent, 'green');
            } else if (trip.status === 'ASSIGNED') {
                stageText = 'Driver assigned, preparing to move';
            } else if (trip.status === 'ONGOING') {
                stageText = 'Trip in progress';
            } else if (trip.status === 'REQUESTED') {
                stageText = 'Looking for available driver...';
            }

            return `
                <div class="list-item" data-trip-id="${trip.id}">
                    <div>
                        <strong>Trip #${trip.id}</strong><br>
                        <small>From: Location ${trip.pickup} → To: Location ${trip.dropoff}</small><br>
                        <small>Rider: ${trip.rider_id} • Driver: ${trip.driver_id || 'Finding...'}</small>
                        ${stageText ? `<br><small style="color: #666;">${stageText}</small>` : ''}
                        ${progressBar}
                    </div>
                    <div>
                        <span class="status-badge status-${trip.status.toLowerCase()}">
                            ${trip.status}
                        </span>
                        <div style="margin-top: 5px; display: flex; gap: 5px;">
                            <button class="btn btn-small btn-danger trip-action-btn" 
                                    data-trip-id="${trip.id}" 
                                    data-action="cancel"
                                    ${!trip.is_active ? 'disabled' : ''}>
                                <i class="fas fa-times"></i> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Update history
        const historyList = document.getElementById('history-list');
        const recentTrips = [...this.systemState.trips]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);

        historyList.innerHTML = recentTrips.map(trip => `
            <div class="list-item">
                <div>
                    <strong>Trip #${trip.id}</strong><br>
                    <small>${trip.status} • $${trip.fare.toFixed(2)}</small>
                </div>
                <span class="status-badge status-${trip.status.toLowerCase()}">
                    ${trip.status}
                </span>
            </div>
        `).join('');
    }

    createProgressBar(percent, color) {
        const colorMap = { blue: '#3b82f6', green: '#10b981' };
        return `
            <div style="margin-top: 8px; width: 100%;">
                <div style="height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${percent}%; background: ${colorMap[color] || '#8a2be2'}; 
                         border-radius: 3px; transition: width 0.3s;"></div>
                </div>
                <div style="font-size: 0.8rem; color: #666; margin-top: 2px; text-align: right;">
                    ${percent}%
                </div>
            </div>
        `;
    }

    renderCityMap() {
        if (!this.systemState) return;

        const mapContainer = document.getElementById('city-map');
        mapContainer.innerHTML = '';

        const city = this.systemState.city;
        const locations = city.locations;
        const drivers = this.systemState.drivers;

        // Create SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', '0 0 1000 400');

        // Draw zones
        const zoneColors = [
            'rgba(138, 43, 226, 0.05)', 'rgba(59, 130, 246, 0.05)',
            'rgba(16, 185, 129, 0.05)', 'rgba(245, 158, 11, 0.05)',
            'rgba(239, 68, 68, 0.05)'
        ];

        const zoneWidth = 180;
        const zoneHeight = 300;
        const zoneSpacing = 10;

        for (let zone = 0; zone < 5; zone++) {
            const x = zone * (zoneWidth + zoneSpacing) + 20;
            const y = 50;

            // Zone background
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', zoneWidth);
            rect.setAttribute('height', zoneHeight);
            rect.setAttribute('fill', zoneColors[zone % zoneColors.length]);
            rect.setAttribute('stroke', 'rgba(138, 43, 226, 0.3)');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('rx', '10');
            svg.appendChild(rect);

            // Zone label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x + zoneWidth / 2);
            text.setAttribute('y', y - 10);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'var(--primary-color)');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('font-size', '14');
            text.textContent = `Zone ${zone}`;
            svg.appendChild(text);
        }

        // Draw roads
        city.roads.forEach(road => {
            const fromLoc = locations.find(l => l.id === road.from);
            const toLoc = locations.find(l => l.id === road.to);

            if (fromLoc && toLoc) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', fromLoc.x);
                line.setAttribute('y1', fromLoc.y);
                line.setAttribute('x2', toLoc.x);
                line.setAttribute('y2', toLoc.y);
                line.setAttribute('stroke', 'rgba(100, 100, 100, 0.3)');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('stroke-dasharray', '5,5');
                svg.appendChild(line);
            }
        });

        // Draw driver paths (animations)
        this.driverPaths.forEach((pathData, driverId) => {
            if (pathData.path.length > 1) {
                // Draw completed portion
                const completedIndex = Math.floor(pathData.path.length * (pathData.progress / 100));
                const completedPath = pathData.path.slice(0, completedIndex + 1);

                if (completedPath.length > 1) {
                    const pathLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                    let points = completedPath.map(p => `${p.x},${p.y}`).join(' ');
                    pathLine.setAttribute('points', points);
                    pathLine.setAttribute('fill', 'none');
                    pathLine.setAttribute('stroke', pathData.color);
                    pathLine.setAttribute('stroke-width', '4');
                    pathLine.setAttribute('stroke-linecap', 'round');
                    pathLine.style.opacity = '0.7';
                    svg.appendChild(pathLine);
                }
            }
        });

        // Draw locations
        locations.forEach(location => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', location.x);
            circle.setAttribute('cy', location.y);
            circle.setAttribute('r', '8');
            circle.setAttribute('fill', '#f59e0b');
            circle.setAttribute('stroke', 'white');
            circle.setAttribute('stroke-width', '2');
            circle.setAttribute('data-location-id', location.id);
            circle.setAttribute('title', `Location ${location.id} (${location.zone})`);
            circle.style.cursor = 'pointer';

            circle.addEventListener('click', () => this.selectLocation(location.id));
            svg.appendChild(circle);

            // Location label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', location.x);
            text.setAttribute('y', location.y - 15);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#666');
            text.setAttribute('font-size', '10');
            text.textContent = location.id;
            svg.appendChild(text);
        });

        // Draw drivers
        drivers.forEach(driver => {
            const driverLocation = locations.find(l => l.id === driver.location);
            if (driverLocation) {
                const driverColor = driver.available ? '#10b981' : '#ef4444';

                // Driver circle
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', driverLocation.x);
                circle.setAttribute('cy', driverLocation.y);
                circle.setAttribute('r', '12');
                circle.setAttribute('fill', driverColor);
                circle.setAttribute('stroke', 'white');
                circle.setAttribute('stroke-width', '3');

                if (!driver.available) {
                    circle.style.animation = 'pulse 1.5s infinite';
                }

                svg.appendChild(circle);

                // Driver initial
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', driverLocation.x);
                text.setAttribute('y', driverLocation.y + 4);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', 'white');
                text.setAttribute('font-size', '10');
                text.setAttribute('font-weight', 'bold');
                text.textContent = driver.name.charAt(0);
                svg.appendChild(text);
            }
        });

        // Add CSS animations
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.8; }
                100% { transform: scale(1); opacity: 1; }
            }
        `;
        svg.appendChild(style);

        mapContainer.appendChild(svg);
    }

    selectLocation(locationId) {
        // Auto-fill form fields
        const pickupField = document.getElementById('pickup-location');
        const dropoffField = document.getElementById('dropoff-location');

        if (pickupField && document.getElementById('request-ride-modal').classList.contains('active')) {
            if (!pickupField.value) {
                pickupField.value = locationId;
                this.showNotification(`Set pickup location to ${locationId}`, 'success');
            } else if (!dropoffField.value && pickupField.value != locationId) {
                dropoffField.value = locationId;
                this.showNotification(`Set dropoff location to ${locationId}`, 'success');
            }
        }
    }

    startAnimationLoop() {
        setInterval(() => {
            if (this.systemState) {
                this.renderCityMap();
            }
        }, 1000);
    }

    async initSystem() {
        try {
            const response = await fetch('/api/init', { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                this.showNotification('System initialized successfully!', 'success');
                this.loadSystemState();
                this.socket.emit('request_update');
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error initializing system', 'error');
        }
    }

    showRequestRideModal() {
        document.getElementById('pickup-location').value = '';
        document.getElementById('dropoff-location').value = '';
        this.showModal('request-ride-modal');
    }

    showAddDriverModal() {
        this.showModal('add-driver-modal');
    }

    showAddRiderModal() {
        this.showModal('add-rider-modal');
    }

    showRollbackModal() {
        this.showModal('rollback-modal');
    }

    async requestRide() {
        console.log("\n=== FRONTEND: Requesting ride ===");

        const riderId = document.getElementById('rider-id').value;
        const pickup = document.getElementById('pickup-location').value;
        const dropoff = document.getElementById('dropoff-location').value;

        console.log(`Rider ID: ${riderId}, Pickup: ${pickup}, Dropoff: ${dropoff}`);

        if (!riderId || !pickup || !dropoff) {
            this.showNotification('Please fill all fields', 'warning');
            return;
        }

        if (pickup === dropoff) {
            this.showNotification('Pickup and dropoff cannot be the same', 'error');
            return;
        }

        try {
            console.log("Sending request to /api/trip/request...");
            const response = await fetch('/api/trip/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rider_id: parseInt(riderId),
                    pickup: parseInt(pickup),
                    dropoff: parseInt(dropoff)
                })
            });

            console.log("Response received");
            const data = await response.json();
            console.log("Response data:", data);

            if (data.success) {
                console.log("✓ Trip requested successfully!");
                this.showNotification(`Trip #${data.trip.id} requested!`, 'success');
                this.hideModal('request-ride-modal');

                // Clear form
                document.getElementById('rider-id').value = '';
                document.getElementById('pickup-location').value = '';
                document.getElementById('dropoff-location').value = '';

                // The system will automatically update via WebSocket
            } else {
                console.log("✗ Error:", data.error);
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            console.error("✗ Request error:", error);
            this.showNotification('Error requesting ride', 'error');
        }
    }

    async updateTripStatus(tripId, action) {
        try {
            const response = await fetch(`/api/trip/${tripId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`Trip #${tripId} cancelled`, 'success');
                this.loadSystemState();
                this.socket.emit('request_update');
            } else {
                this.showNotification(data.error || `Failed to ${action} trip`, 'error');
            }
        } catch (error) {
            this.showNotification('Error cancelling trip', 'error');
        }
    }

    async addDriver() {
        const name = document.getElementById('driver-name').value;
        const location = document.getElementById('driver-location').value;
        const vehicle = document.getElementById('driver-vehicle').value;
        const license = document.getElementById('driver-license').value;

        if (!name) {
            this.showNotification('Please enter driver name', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/driver/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    location: parseInt(location) || 0,
                    vehicle: vehicle,
                    license_plate: license
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`Driver ${name} added!`, 'success');
                this.hideModal('add-driver-modal');
                document.getElementById('driver-name').value = '';
                document.getElementById('driver-license').value = '';
                this.loadSystemState();
                this.socket.emit('request_update');
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error adding driver', 'error');
        }
    }

    async addRider() {
        const name = document.getElementById('rider-name').value;
        const email = document.getElementById('rider-email').value;

        if (!name) {
            this.showNotification('Please enter rider name', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/rider/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    email: email
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`Rider ${name} added!`, 'success');
                this.hideModal('add-rider-modal');
                document.getElementById('rider-name').value = '';
                document.getElementById('rider-email').value = '';
                this.loadSystemState();
                this.socket.emit('request_update');
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error adding rider', 'error');
        }
    }

    async cancelLastTrip() {
        const activeTrips = this.systemState?.trips.filter(t => t.is_active);
        if (!activeTrips || activeTrips.length === 0) {
            this.showNotification('No active trips to cancel', 'warning');
            return;
        }

        const lastTrip = activeTrips[activeTrips.length - 1];
        if (confirm(`Cancel trip #${lastTrip.id}?`)) {
            await this.updateTripStatus(lastTrip.id, 'cancel');
        }
    }

    async performRollback() {
        const k = document.getElementById('rollback-count').value;

        try {
            const response = await fetch('/api/rollback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ k: parseInt(k) })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`Rolled back ${k} operations`, 'success');
                this.hideModal('rollback-modal');
                this.loadSystemState();
                this.socket.emit('request_update');
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error performing rollback', 'error');
        }
    }

    async loadAnalytics() {
        try {
            const response = await fetch('/api/analytics');
            const data = await response.json();

            if (data.success) {
                this.displayAnalytics(data.analytics);
            }
        } catch (error) {
            this.showNotification('Error loading analytics', 'error');
        }
    }

    displayAnalytics(analytics) {
        const container = document.getElementById('analytics-content');

        const html = `
            <div class="stats-grid" style="margin-bottom: 20px;">
                <div class="stat-card">
                    <div class="stat-value">${analytics.total_trips}</div>
                    <div class="stat-label">Total Trips</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analytics.completed_trips}</div>
                    <div class="stat-label">Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analytics.cancelled_trips}</div>
                    <div class="stat-label">Cancelled</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analytics.active_trips}</div>
                    <div class="stat-label">Active</div>
                </div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">$${analytics.total_fare}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analytics.average_distance}km</div>
                    <div class="stat-label">Avg Distance</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${analytics.average_fare}</div>
                    <div class="stat-label">Avg Fare</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Math.round(analytics.driver_utilization * 100)}%</div>
                    <div class="stat-label">Driver Utilization</div>
                </div>
            </div>
            
            <div style="margin-top: 30px; background: var(--secondary-color); padding: 20px; border-radius: 15px;">
                <h3 style="margin-bottom: 15px; color: var(--primary-color);">System Summary</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <strong>Total Drivers:</strong> ${analytics.total_drivers}
                    </div>
                    <div>
                        <strong>Available Drivers:</strong> ${analytics.available_drivers}
                    </div>
                    <div>
                        <strong>Total Riders:</strong> ${analytics.total_riders}
                    </div>
                    <div>
                        <strong>Active Animations:</strong> ${analytics.active_animations || 0}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    refreshMap() {
        this.renderCityMap();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RideSharingApp();
});

// Global functions for button onclick handlers
function showPage(page) {
    if (window.app) window.app.showPage(page);
}

function initSystem() {
    if (window.app) window.app.initSystem();
}

function showRequestRideModal() {
    if (window.app) window.app.showRequestRideModal();
}

function showAddDriverModal() {
    if (window.app) window.app.showAddDriverModal();
}

function showAddRiderModal() {
    if (window.app) window.app.showAddRiderModal();
}

function showRollbackModal() {
    if (window.app) window.app.showRollbackModal();
}

function hideModal(modalId) {
    if (window.app) window.app.hideModal(modalId);
}

function requestRide() {
    if (window.app) window.app.requestRide();
}

function addDriver() {
    if (window.app) window.app.addDriver();
}

function addRider() {
    if (window.app) window.app.addRider();
}

function cancelLastTrip() {
    if (window.app) window.app.cancelLastTrip();
}

function performRollback() {
    if (window.app) window.app.performRollback();
}

function loadAnalytics() {
    if (window.app) window.app.loadAnalytics();
}

function refreshMap() {
    if (window.app) window.app.refreshMap();
}

// Zoom functions
let currentZoom = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;

function zoomIn() {
    const mapContainer = document.getElementById('city-map');
    const svg = mapContainer?.querySelector('svg');

    if (svg && currentZoom < MAX_ZOOM) {
        currentZoom += ZOOM_STEP;
        updateZoom();
    }
}

function zoomOut() {
    const mapContainer = document.getElementById('city-map');
    const svg = mapContainer?.querySelector('svg');

    if (svg && currentZoom > MIN_ZOOM) {
        currentZoom -= ZOOM_STEP;
        updateZoom();
    }
}

function updateZoom() {
    const mapContainer = document.getElementById('city-map');
    const svg = mapContainer?.querySelector('svg');

    if (svg) {
        svg.style.transform = `scale(${currentZoom})`;
        svg.style.transformOrigin = 'center center';

        let zoomIndicator = document.getElementById('zoom-indicator');
        if (!zoomIndicator) {
            zoomIndicator = document.createElement('div');
            zoomIndicator.id = 'zoom-indicator';
            zoomIndicator.style.position = 'absolute';
            zoomIndicator.style.bottom = '10px';
            zoomIndicator.style.right = '10px';
            zoomIndicator.style.background = 'rgba(0,0,0,0.7)';
            zoomIndicator.style.color = 'white';
            zoomIndicator.style.padding = '5px 10px';
            zoomIndicator.style.borderRadius = '5px';
            zoomIndicator.style.fontSize = '12px';
            zoomIndicator.style.zIndex = '100';
            mapContainer.appendChild(zoomIndicator);
        }

        zoomIndicator.textContent = `Zoom: ${Math.round(currentZoom * 100)}%`;
    }
}