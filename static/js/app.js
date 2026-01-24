class RideSharingApp {
    constructor() {
        this.systemState = null;
        this.activeAnimations = new Map();
        this.driverPaths = new Map();
        this.driverPositions = new Map();
        this.locationSequence = new Map(); // Track location sequences for each driver
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

            // Store driver animation path
            if (progress.trip && progress.trip.driver_id) {
                this.setupDriverAnimation(progress.trip.driver_id, progress);
            }
        } else if (progress.stage === 'completed') {
            this.activeAnimations.delete(tripId);
            this.driverPaths.delete(progress.trip.driver_id);
            this.driverPositions.delete(progress.trip.driver_id);
            this.locationSequence.delete(progress.trip.driver_id);
        }
    }

    setupDriverAnimation(driverId, progress) {
        const trip = progress.trip;
        if (!trip || !this.systemState) return;

        const locations = this.systemState.city.locations;
        const startLocId = progress.stage === 'to_pickup' ? trip.driver_location : trip.pickup;
        const endLocId = progress.stage === 'to_pickup' ? trip.pickup : trip.dropoff;

        // Find start and end locations
        const startLoc = locations.find(l => l.id === startLocId);
        const endLoc = locations.find(l => l.id === endLocId);

        if (!startLoc || !endLoc) return;

        // Calculate sequence of locations to pass through
        let locationSequence = [];
        
        if (startLocId < endLocId) {
            // Ascending sequence: 4, 5, 6, 7, 8, 9, 10
            for (let i = startLocId; i <= endLocId; i++) {
                const loc = locations.find(l => l.id === i);
                if (loc) locationSequence.push(loc);
            }
        } else {
            // Descending sequence: 7, 6, 5, 4, 3, 2, 1
            for (let i = startLocId; i >= endLocId; i--) {
                const loc = locations.find(l => l.id === i);
                if (loc) locationSequence.push(loc);
            }
        }

        // Store the complete sequence
        this.locationSequence.set(driverId, {
            sequence: locationSequence,
            currentIndex: 0,
            stage: progress.stage,
            progress: progress.progress_percentage || 0
        });

        // Calculate current position based on progress
        const progressPercent = progress.progress_percentage || 0;
        const segmentIndex = this.getCurrentSegment(locationSequence.length, progressPercent);
        
        if (segmentIndex < locationSequence.length - 1) {
            const currentLoc = locationSequence[segmentIndex];
            const nextLoc = locationSequence[segmentIndex + 1];
            const segmentProgress = this.getSegmentProgress(locationSequence.length, progressPercent, segmentIndex);

            const currentX = currentLoc.x + (nextLoc.x - currentLoc.x) * segmentProgress;
            const currentY = currentLoc.y + (nextLoc.y - currentLoc.y) * segmentProgress;

            // Store animation data
            this.driverPositions.set(driverId, {
                x: currentX,
                y: currentY,
                currentLoc: currentLoc.id,
                nextLoc: nextLoc.id,
                progress: progressPercent,
                stage: progress.stage,
                isMoving: true
            });

            // Store path for reference
            this.driverPaths.set(driverId, {
                sequence: locationSequence,
                progress: progressPercent,
                color: progress.stage === 'to_pickup' ? '#3b82f6' : '#10b981'
            });
        }
    }

    getCurrentSegment(totalSegments, progressPercent) {
        // Convert progress percentage to segment index
        const segments = totalSegments - 1;
        const segmentProgress = (progressPercent / 100) * segments;
        return Math.floor(segmentProgress);
    }

    getSegmentProgress(totalSegments, progressPercent, segmentIndex) {
        const segments = totalSegments - 1;
        const segmentProgress = (progressPercent / 100) * segments;
        return segmentProgress - segmentIndex; // Returns 0-1 for current segment
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

        // Update drivers list with current location info
        const driversList = document.getElementById('drivers-list');
        driversList.innerHTML = this.systemState.drivers.map(driver => {
            const isBusy = !driver.available;
            const activeTrip = isBusy ?
                Array.from(this.activeAnimations.entries()).find(([id, progress]) =>
                    progress.trip && progress.trip.driver_id === driver.id
                ) : null;

            const animData = this.driverPositions.get(driver.id);
            let locationInfo = `Location: ${driver.location}`;
            
            if (animData) {
                if (animData.stage === 'to_pickup') {
                    locationInfo = `Moving to pickup: ${animData.currentLoc} → ${animData.nextLoc}`;
                } else if (animData.stage === 'to_dropoff') {
                    locationInfo = `Moving to dropoff: ${animData.currentLoc} → ${animData.nextLoc}`;
                }
            }

            return `
                <div class="list-item">
                    <div>
                        <strong>${driver.name}</strong><br>
                        <small>${driver.vehicle} • ${driver.license_plate || 'No plate'}</small><br>
                        <small>${locationInfo}</small>
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

            // Get current location info if available
            const animData = this.driverPositions.get(trip.driver_id);
            let locationInfo = '';
            if (animData && (stage === 'to_pickup' || stage === 'to_dropoff')) {
                locationInfo = `<br><small>Current: Location ${animData.currentLoc} → Next: Location ${animData.nextLoc}</small>`;
            }

            return `
                <div class="list-item" data-trip-id="${trip.id}">
                    <div>
                        <strong>Trip #${trip.id}</strong><br>
                        <small>From: Location ${trip.pickup} → To: Location ${trip.dropoff}</small>
                        ${locationInfo}
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

        // Draw roads connecting consecutive locations
        locations.forEach((location, index) => {
            if (index < locations.length - 1) {
                const nextLocation = locations[index + 1];
                
                // Draw a road from current location to next
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', location.x);
                line.setAttribute('y1', location.y);
                line.setAttribute('x2', nextLocation.x);
                line.setAttribute('y2', nextLocation.y);
                line.setAttribute('stroke', 'rgba(100, 100, 100, 0.3)');
                line.setAttribute('stroke-width', '2');
                svg.appendChild(line);
            }
        });

        // Draw locations
        locations.forEach(location => {
            // Location circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', location.x);
            circle.setAttribute('cy', location.y);
            circle.setAttribute('r', '8');
            circle.setAttribute('fill', '#f59e0b');
            circle.setAttribute('stroke', 'white');
            circle.setAttribute('stroke-width', '2');
            circle.setAttribute('data-location-id', location.id);
            circle.setAttribute('title', `Location ${location.id} (Zone ${location.zone})`);
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

        // Draw drivers with animation
        drivers.forEach(driver => {
            let driverX, driverY;
            let driverColor = '#10b981'; // Default for available
            let isMoving = false;
            let showTrail = false;
            let trailText = '';

            // Check if this driver has an animation position
            const animPosition = this.driverPositions.get(driver.id);
            
            if (animPosition) {
                // Use animated position
                driverX = animPosition.x;
                driverY = animPosition.y;
                driverColor = animPosition.stage === 'to_pickup' ? '#3b82f6' : '#10b981';
                isMoving = true;
                showTrail = true;
                trailText = `${animPosition.currentLoc}→${animPosition.nextLoc}`;
            } else {
                // Use static position from location
                const driverLocation = locations.find(l => l.id === driver.location);
                if (!driverLocation) return;
                
                driverX = driverLocation.x;
                driverY = driverLocation.y;
                driverColor = driver.available ? '#10b981' : '#ef4444';
            }

            // Create driver group
            const driverGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            
            if (showTrail) {
                // Draw trail from current location to next location
                const currentLoc = locations.find(l => l.id === animPosition.currentLoc);
                const nextLoc = locations.find(l => l.id === animPosition.nextLoc);
                
                if (currentLoc && nextLoc) {
                    const trailLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    trailLine.setAttribute('x1', currentLoc.x);
                    trailLine.setAttribute('y1', currentLoc.y);
                    trailLine.setAttribute('x2', nextLoc.x);
                    trailLine.setAttribute('y2', nextLoc.y);
                    trailLine.setAttribute('stroke', driverColor);
                    trailLine.setAttribute('stroke-width', '2');
                    trailLine.setAttribute('opacity', '0.3');
                    trailLine.setAttribute('stroke-dasharray', '5,5');
                    driverGroup.appendChild(trailLine);

                    // Trail text
                    const trailTextEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    trailTextEl.setAttribute('x', (currentLoc.x + nextLoc.x) / 2);
                    trailTextEl.setAttribute('y', (currentLoc.y + nextLoc.y) / 2 - 5);
                    trailTextEl.setAttribute('text-anchor', 'middle');
                    trailTextEl.setAttribute('fill', driverColor);
                    trailTextEl.setAttribute('font-size', '9');
                    trailTextEl.setAttribute('font-weight', 'bold');
                    trailTextEl.textContent = trailText;
                    driverGroup.appendChild(trailTextEl);
                }
            }

            // Driver circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', driverX);
            circle.setAttribute('cy', driverY);
            circle.setAttribute('r', '12');
            circle.setAttribute('fill', driverColor);
            circle.setAttribute('stroke', 'white');
            circle.setAttribute('stroke-width', '3');
            
            if (isMoving) {
                // Add moving animation
                circle.style.animation = 'moveDriver 2s linear infinite';
                
                // Create a small trail effect
                const trail = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                trail.setAttribute('cx', driverX);
                trail.setAttribute('cy', driverY);
                trail.setAttribute('r', '6');
                trail.setAttribute('fill', driverColor);
                trail.setAttribute('opacity', '0.5');
                trail.style.animation = 'pulseTrail 1s ease-out infinite';
                driverGroup.appendChild(trail);
            } else if (!driver.available) {
                circle.style.animation = 'pulse 1.5s infinite';
            }

            driverGroup.appendChild(circle);

            // Driver initial
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', driverX);
            text.setAttribute('y', driverY + 4);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'white');
            text.setAttribute('font-size', '10');
            text.setAttribute('font-weight', 'bold');
            text.textContent = driver.name.charAt(0);
            driverGroup.appendChild(text);

            svg.appendChild(driverGroup);
        });

        // Add CSS animations
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.8; }
                100% { transform: scale(1); opacity: 1; }
            }
            
            
            @keyframes pulseTrail {
                0% { transform: scale(0.8); opacity: 0.5; }
                50% { transform: scale(1.2); opacity: 0.2; }
                100% { transform: scale(0.8); opacity: 0.5; }
            }
        `;
        svg.appendChild(style);

        mapContainer.appendChild(svg);
    }

    selectLocation(locationId) {
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
                        <strong>Moving Drivers:</strong> ${this.driverPositions.size}
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
