class RideSharingApp {
    constructor() {
        this.systemState = null;
        this.currentTripId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSystemState();
        this.startAutoRefresh();
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.target.getAttribute('onclick').match(/showPage\('(\w+)'\)/)[1];
                this.showPage(page);
            });
        });

        // Form submissions
        document.getElementById('request-ride-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.requestRide();
        });

        document.getElementById('add-driver-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addDriver();
        });

        document.getElementById('add-rider-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addRider();
        });

        // Bind trip action buttons
        this.bindTripActionButtons();
    }

    bindTripActionButtons() {
        // Use event delegation for dynamically created buttons
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
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Show selected page
        document.getElementById(`${pageId}-page`).classList.add('active');

        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.nav-btn[onclick="showPage('${pageId}')"]`).classList.add('active');

        // Refresh data for the page
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

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
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
            this.showNotification('Error loading system state', 'error');
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
        driversList.innerHTML = this.systemState.drivers.map(driver => `
            <div class="list-item">
                <div>
                    <strong>${driver.name}</strong><br>
                    <small>${driver.vehicle} • ${driver.license_plate || 'No plate'}</small><br>
                    <small>Location: ${driver.location}</small>
                </div>
                <div>
                    <span class="status-badge ${driver.available ? 'status-ongoing' : 'status-cancelled'}">
                        ${driver.available ? 'Available' : 'Busy'}
                    </span>
                </div>
            </div>
        `).join('');

        // Update riders list
        const ridersList = document.getElementById('riders-list');
        ridersList.innerHTML = this.systemState.riders.map(rider => `
            <div class="list-item">
                <div>
                    <strong>${rider.name}</strong><br>
                    <small>${rider.email || 'No email'}</small><br>
                    <small>Trips: ${rider.trip_count}</small>
                </div>
            </div>
        `).join('');

        // Update active trips - FIXED: Proper button event handling
        const tripsList = document.getElementById('trips-list');
        const activeTrips = this.systemState.trips.filter(trip => trip.is_active);
        
        tripsList.innerHTML = activeTrips.map(trip => `
            <div class="list-item" data-trip-id="${trip.id}">
                <div>
                    <strong>Trip #${trip.id}</strong><br>
                    <small>Rider: ${trip.rider_id} → Driver: ${trip.driver_id || 'Not assigned'}</small><br>
                    <small>Pickup: ${trip.pickup} → Dropoff: ${trip.dropoff}</small>
                    ${trip.fare > 0 ? `<br><small>Fare: $${trip.fare.toFixed(2)}</small>` : ''}
                </div>
                <div>
                    <span class="status-badge status-${trip.status.toLowerCase()}">
                        ${trip.status}
                    </span>
                    <div style="margin-top: 5px; display: flex; gap: 5px;">
                        <button class="btn btn-small btn-success trip-action-btn" 
                                data-trip-id="${trip.id}" 
                                data-action="start"
                                ${trip.status !== 'ASSIGNED' ? 'disabled' : ''}>
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="btn btn-small btn-success trip-action-btn" 
                                data-trip-id="${trip.id}" 
                                data-action="complete"
                                ${trip.status !== 'ONGOING' ? 'disabled' : ''}>
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-small btn-danger trip-action-btn" 
                                data-trip-id="${trip.id}" 
                                data-action="cancel"
                                ${!trip.is_active ? 'disabled' : ''}>
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Update history
        const historyList = document.getElementById('history-list');
        const recentTrips = [...this.systemState.trips]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);
        
        historyList.innerHTML = recentTrips.map(trip => `
            <div class="list-item">
                <div>
                    <strong>Trip #${trip.id}</strong><br>
                    <small>Status: ${trip.status}</small><br>
                    <small>Fare: $${trip.fare.toFixed(2)}</small>
                </div>
                <span class="status-badge status-${trip.status.toLowerCase()}">
                    ${trip.status}
                </span>
            </div>
        `).join('');
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
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        // Define zone colors
        const zoneColors = [
            'rgba(138, 43, 226, 0.05)',   // Zone 0 - Light Purple
            'rgba(59, 130, 246, 0.05)',   // Zone 1 - Light Blue
            'rgba(16, 185, 129, 0.05)',   // Zone 2 - Light Green
            'rgba(245, 158, 11, 0.05)',   // Zone 3 - Light Yellow
            'rgba(239, 68, 68, 0.05)'     // Zone 4 - Light Red
        ];

        // Draw zones (5 zones horizontally)
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
                line.setAttribute('stroke', 'rgba(100, 100, 100, 0.4)');
                line.setAttribute('stroke-width', '3');
                line.setAttribute('stroke-dasharray', '5,5');
                svg.appendChild(line);
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
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', driverLocation.x);
                circle.setAttribute('cy', driverLocation.y);
                circle.setAttribute('r', '10');
                circle.setAttribute('fill', driverColor);
                circle.setAttribute('stroke', 'white');
                circle.setAttribute('stroke-width', '3');
                circle.setAttribute('data-driver-id', driver.id);
                circle.setAttribute('title', `${driver.name} - ${driver.available ? 'Available' : 'Busy'}`);
                
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
                text.setAttribute('font-size', '9');
                text.setAttribute('font-weight', 'bold');
                text.textContent = driver.name.charAt(0);
                svg.appendChild(text);
            }
        });

        // Add animation for pulse effect
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

    async initSystem() {
        try {
            const response = await fetch('/api/init', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('System initialized successfully!', 'success');
                this.loadSystemState();
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error initializing system', 'error');
        }
    }

    showRequestRideModal() {
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
        const riderId = document.getElementById('rider-id').value;
        const pickup = document.getElementById('pickup-location').value;
        const dropoff = document.getElementById('dropoff-location').value;

        if (!riderId || !pickup || !dropoff) {
            this.showNotification('Please fill all fields', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/trip/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rider_id: parseInt(riderId),
                    pickup: parseInt(pickup),
                    dropoff: parseInt(dropoff)
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`Trip #${data.trip.id} requested successfully! Status: ${data.trip.status}`, 'success');
                this.hideModal('request-ride-modal');
                this.loadSystemState();
                this.currentTripId = data.trip.id;
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error requesting ride', 'error');
        }
    }

    async updateTripStatus(tripId, action) {
        try {
            // Show loading state
            const button = document.querySelector(`.trip-action-btn[data-trip-id="${tripId}"][data-action="${action}"]`);
            if (button) {
                const originalHTML = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                button.disabled = true;
                
                setTimeout(async () => {
                    const response = await fetch(`/api/trip/${tripId}/update`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ action })
                    });
    
                    const data = await response.json();
                    
                    // Restore button state
                    button.innerHTML = originalHTML;
                    button.disabled = false;
                    
                    if (data.success) {
                        const messages = {
                            'start': `Trip #${tripId} started successfully!`,
                            'complete': `Trip #${tripId} completed successfully!`,
                            'cancel': `Trip #${tripId} cancelled successfully!`
                        };
                        this.showNotification(messages[action], 'success');
                        this.loadSystemState();
                    } else {
                        this.showNotification(data.error || `Failed to ${action} trip`, 'error');
                    }
                }, 500);
            }
        } catch (error) {
            this.showNotification('Error updating trip', 'error');
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    location: parseInt(location) || 0,
                    vehicle: vehicle,
                    license_plate: license
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`Driver ${name} added successfully!`, 'success');
                this.hideModal('add-driver-modal');
                this.loadSystemState();
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    email: email
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`Rider ${name} added successfully!`, 'success');
                this.hideModal('add-rider-modal');
                this.loadSystemState();
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ k: parseInt(k) })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`Rolled back ${k} operations`, 'success');
                this.hideModal('rollback-modal');
                this.loadSystemState();
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
                        <strong>Cancellation Rate:</strong> ${analytics.cancelled_trips > 0 ? 
                            Math.round((analytics.cancelled_trips / analytics.total_trips) * 100) : 0}%
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    refreshMap() {
        this.renderCityMap();
    }

    startAutoRefresh() {
        // Refresh every 10 seconds
        setInterval(() => {
            if (document.querySelector('#dashboard-page.active')) {
                this.loadSystemState();
            }
        }, 10000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RideSharingApp();
});

// Global functions for button onclick handlers
function showPage(page) {
    window.app.showPage(page);
}

function initSystem() {
    window.app.initSystem();
}

function showRequestRideModal() {
    window.app.showRequestRideModal();
}

function showAddDriverModal() {
    window.app.showAddDriverModal();
}

function showAddRiderModal() {
    window.app.showAddRiderModal();
}

function showRollbackModal() {
    window.app.showRollbackModal();
}

function hideModal(modalId) {
    window.app.hideModal(modalId);
}

function requestRide() {
    window.app.requestRide();
}

function addDriver() {
    window.app.addDriver();
}

function addRider() {
    window.app.addRider();
}

function cancelLastTrip() {
    window.app.cancelLastTrip();
}

function performRollback() {
    window.app.performRollback();
}

function loadAnalytics() {
    window.app.loadAnalytics();
}

function refreshMap() {
    window.app.refreshMap();
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
        
        // Show zoom level
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

// Reset zoom when refreshing map
function refreshMap() {
    currentZoom = 1;
    window.app.renderCityMap();
    updateZoom();
}