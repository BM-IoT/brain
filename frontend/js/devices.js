class DeviceManager {
    constructor() {
        this.devices = new Map();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Listen for MQTT messages related to devices
        window.wsManager.on('mqtt', (data) => {
            this.handleMqttMessage(data);
        });

        // Listen for device removal notifications
        window.wsManager.on('device_removed', (data) => {
            this.handleDeviceRemoved(data);
        });

        // Setup device modal functionality
        this.setupModalHandlers();
    }

    handleMqttMessage(data) {
        const { topic, payload } = data;
        
        try {
            const deviceData = JSON.parse(payload);
            
            if (topic === 'network/hello') {
                this.registerDevice(deviceData);
            } else if (topic === 'network/byebye') {
                this.removeDevice(deviceData.device_id);
            } else if (topic === 'network/alive') {
                this.updateDeviceAlive(deviceData.device_id);
            } else if (topic.startsWith('sensors/')) {
                this.updateDeviceData(deviceData);
            }
        } catch (error) {
            // Not JSON data, ignore for device management
        }
    }

    registerDevice(deviceData) {
        const deviceId = deviceData.device_id;
        
        this.devices.set(deviceId, {
            ...deviceData,
            status: 'online',
            lastSeen: new Date(),
            sensorData: {},
            batteryLevel: deviceData.battery_level || null,
            signalStrength: deviceData.signal_strength || null
        });
        
        this.renderDeviceList();
    }

    removeDevice(deviceId) {
        if (this.devices.has(deviceId)) {
            const device = this.devices.get(deviceId);
            device.status = 'offline';
            device.lastSeen = new Date();
            this.devices.set(deviceId, device);
            this.renderDeviceList();
        }
    }

    handleDeviceRemoved(data) {
        const { device_id } = data;
        console.log(`Device ${device_id} removed due to TTL expiry`);
        
        if (this.devices.has(device_id)) {
            // Actually remove the device from the map
            this.devices.delete(device_id);
            this.renderDeviceList();
            
            // Close modal if it was showing this device
            const modal = document.getElementById('device-modal');
            if (modal && modal.style.display === 'block') {
                const modalContent = document.getElementById('device-details');
                if (modalContent && modalContent.innerHTML.includes(device_id)) {
                    this.closeDeviceModal();
                }
            }
            
            // Show a notification to the user
            this.showNotification(`Device ${device_id} has been removed due to inactivity`, 'warning');
        }
    }

    updateDeviceAlive(deviceId) {
        if (this.devices.has(deviceId)) {
            const device = this.devices.get(deviceId);
            device.status = 'online';
            device.lastSeen = new Date();
            this.devices.set(deviceId, device);
            this.renderDeviceList();
        }
    }

    updateDeviceData(sensorData) {
        const deviceId = sensorData.device_id;
        
        if (this.devices.has(deviceId)) {
            const device = this.devices.get(deviceId);
            device.sensorData[sensorData.type] = {
                value: sensorData.value,
                timestamp: new Date(),
                unit: this.getUnit(sensorData.type)
            };
            device.lastSeen = new Date();
            device.status = 'online';
            
            this.devices.set(deviceId, device);
            this.renderDeviceList();
        }
    }

    getUnit(type) {
        const units = {
            moisture_sensor: '%',
            strain_sensor: 'µε',
            vibration_sensor: 'g',
            temperature_sensor: '°C',
            humidity_sensor: '%',
            pressure_sensor: 'hPa'
        };
        return units[type] || '';
    }

    getDeviceTypeIcon(type) {
        const icons = {
            moisture_sensor: '💧',
            strain_sensor: '📏',
            vibration_sensor: '📳',
            temperature_sensor: '🌡️',
            humidity_sensor: '💨',
            pressure_sensor: '🗜️',
            gateway: '📡',
            repeater: '🔄'
        };
        return icons[type] || '📟';
    }

    renderDeviceList() {
        const container = document.getElementById('device-list');
        container.innerHTML = '';
        
        if (this.devices.size === 0) {
            container.innerHTML = '<div class="no-data">No devices available</div>';
            return;
        }
        
        // Sort devices by name/ID
        const sortedDevices = Array.from(this.devices.entries())
            .sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0]));
        
        sortedDevices.forEach(([deviceId, device]) => {
            const deviceCard = this.createDeviceCard(deviceId, device);
            container.appendChild(deviceCard);
        });
    }

    createDeviceCard(deviceId, device) {
        const card = document.createElement('div');
        card.className = 'device-card';
        
        const mostRecentSensorData = this.getMostRecentSensorData(device);
        const deviceIcon = this.getDeviceTypeIcon(device.type);
        
        card.innerHTML = `
            <div class="device-header">
                <div class="device-name">
                    ${deviceIcon} ${device.name || deviceId}
                </div>
                <div class="device-status ${device.status}">${device.status.toUpperCase()}</div>
            </div>
            <div class="device-info">
                <div><strong>Type:</strong> ${device.type}</div>
                <div><strong>Device ID:</strong> ${deviceId}</div>
                <div><strong>Last Seen:</strong> ${device.lastSeen.toLocaleString()}</div>
                ${device.batteryLevel ? `<div><strong>Battery:</strong> ${device.batteryLevel}%</div>` : ''}
                ${device.signalStrength ? `<div><strong>Signal:</strong> ${device.signalStrength} dBm</div>` : ''}
                ${mostRecentSensorData ? `<div><strong>Latest Reading:</strong> ${mostRecentSensorData}</div>` : ''}
            </div>
            <div class="device-actions">
                <button class="btn btn-primary" onclick="deviceManager.openDeviceModal('${deviceId}')">
                    View Details
                </button>
            </div>
        `;
        
        return card;
    }

    getMostRecentSensorData(device) {
        const sensorData = device.sensorData;
        const sensorTypes = Object.keys(sensorData);
        
        if (sensorTypes.length === 0) return null;
        
        // Find the most recent sensor reading
        let mostRecent = null;
        let latestTime = 0;
        
        sensorTypes.forEach(type => {
            const data = sensorData[type];
            if (data.timestamp.getTime() > latestTime) {
                latestTime = data.timestamp.getTime();
                mostRecent = `${parseFloat(data.value).toFixed(2)}${data.unit} (${type.replace('_sensor', '')})`;
            }
        });
        
        return mostRecent;
    }

    setupModalHandlers() {
        const modal = document.getElementById('device-modal');
        const closeBtn = modal.querySelector('.close');
        
        closeBtn.onclick = () => this.closeDeviceModal();
        
        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                this.closeDeviceModal();
            }
        };
    }

    openDeviceModal(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;
        
        const detailsContainer = document.getElementById('device-details');
        detailsContainer.innerHTML = this.generateDeviceDetails(deviceId, device);
        
        document.getElementById('device-modal').style.display = 'block';
    }

    closeDeviceModal() {
        document.getElementById('device-modal').style.display = 'none';
    }

    generateDeviceDetails(deviceId, device) {
        const sensorDataHtml = this.generateSensorDataTable(device.sensorData);
        
        return `
            <div class="device-details">
                <h3>${this.getDeviceTypeIcon(device.type)} ${device.name || deviceId}</h3>
                
                <div class="detail-section">
                    <h4>Basic Information</h4>
                    <table class="detail-table">
                        <tr><td><strong>Device ID:</strong></td><td>${deviceId}</td></tr>
                        <tr><td><strong>Type:</strong></td><td>${device.type}</td></tr>
                        <tr><td><strong>Status:</strong></td><td class="device-status ${device.status}">${device.status.toUpperCase()}</td></tr>
                        <tr><td><strong>Last Seen:</strong></td><td>${device.lastSeen.toLocaleString()}</td></tr>
                        ${device.ip ? `<tr><td><strong>IP Address:</strong></td><td>${device.ip}</td></tr>` : ''}
                        ${device.mac ? `<tr><td><strong>MAC Address:</strong></td><td>${device.mac}</td></tr>` : ''}
                        ${device.version ? `<tr><td><strong>Firmware Version:</strong></td><td>${device.version}</td></tr>` : ''}
                        ${device.TTL ? `<tr><td><strong>TTL:</strong></td><td>${device.TTL}s</td></tr>` : ''}
                    </table>
                </div>
                
                ${device.batteryLevel || device.signalStrength ? `
                <div class="detail-section">
                    <h4>Hardware Status</h4>
                    <table class="detail-table">
                        ${device.batteryLevel ? `<tr><td><strong>Battery Level:</strong></td><td>${device.batteryLevel}%</td></tr>` : ''}
                        ${device.signalStrength ? `<tr><td><strong>Signal Strength:</strong></td><td>${device.signalStrength} dBm</td></tr>` : ''}
                        ${device.temperature ? `<tr><td><strong>Internal Temperature:</strong></td><td>${device.temperature}°C</td></tr>` : ''}
                        ${device.uptime ? `<tr><td><strong>Uptime:</strong></td><td>${device.uptime}</td></tr>` : ''}
                    </table>
                </div>
                ` : ''}
                
                ${sensorDataHtml ? `
                <div class="detail-section">
                    <h4>Sensor Readings</h4>
                    ${sensorDataHtml}
                </div>
                ` : ''}
                
                ${device.capabilities ? `
                <div class="detail-section">
                    <h4>Capabilities</h4>
                    <div class="capabilities">
                        ${device.capabilities.map(cap => `<span class="capability-tag">${cap}</span>`).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    generateSensorDataTable(sensorData) {
        const sensorTypes = Object.keys(sensorData);
        
        if (sensorTypes.length === 0) {
            return '<p class="no-data">No sensor data available</p>';
        }
        
        const rows = sensorTypes.map(type => {
            const data = sensorData[type];
            const timeDiff = Date.now() - data.timestamp.getTime();
            const deltaTime = this.formatDeltaTime(timeDiff);
            
            return `
                <tr>
                    <td>${type.replace('_sensor', '').replace('_', ' ')}</td>
                    <td>${parseFloat(data.value).toFixed(2)} ${data.unit}</td>
                    <td>${data.timestamp.toLocaleString()}</td>
                    <td>${deltaTime} ago</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="detail-table">
                <thead>
                    <tr>
                        <th>Sensor Type</th>
                        <th>Value</th>
                        <th>Timestamp</th>
                        <th>Age</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    formatDeltaTime(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
        return `${Math.floor(ms / 3600000)}h`;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add to page (create container if it doesn't exist)
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Check device status periodically
    startStatusCheck() {
        setInterval(() => {
            const now = Date.now();
            
            this.devices.forEach((device, deviceId) => {
                const timeSinceLastSeen = now - device.lastSeen.getTime();
                const ttl = (device.TTL || 30) * 1000; // Convert to milliseconds
                
                if (timeSinceLastSeen > ttl && device.status === 'online') {
                    device.status = 'offline';
                    this.devices.set(deviceId, device);
                }
            });
            
            this.renderDeviceList();
        }, 5000); // Check every 5 seconds
    }
}

// Initialize device manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.deviceManager = new DeviceManager();
    window.deviceManager.startStatusCheck();
});

// Add styles for device details
const deviceStyles = `
.detail-section {
    margin-bottom: 2rem;
}

.detail-section h4 {
    color: #2c3e50;
    margin-bottom: 1rem;
    border-bottom: 2px solid #ecf0f1;
    padding-bottom: 0.5rem;
}

.detail-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
}

.detail-table th,
.detail-table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #ecf0f1;
}

.detail-table th {
    background-color: #f8f9fa;
    font-weight: bold;
    color: #2c3e50;
}

.detail-table tr:hover {
    background-color: #f8f9fa;
}

.capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.capability-tag {
    background-color: #3498db;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
}

#notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    max-width: 400px;
}

.notification {
    margin-bottom: 10px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    animation: slideIn 0.3s ease-out;
}

.notification-info {
    background-color: #d1ecf1;
    border-left: 4px solid #17a2b8;
    color: #0c5460;
}

.notification-warning {
    background-color: #fff3cd;
    border-left: 4px solid #ffc107;
    color: #856404;
}

.notification-error {
    background-color: #f8d7da;
    border-left: 4px solid #dc3545;
    color: #721c24;
}

.notification-success {
    background-color: #d4edda;
    border-left: 4px solid #28a745;
    color: #155724;
}

.notification-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
}

.notification-message {
    flex: 1;
    margin-right: 10px;
}

.notification-close {
    background: none;
    border: none;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.notification-close:hover {
    opacity: 1;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = deviceStyles;
document.head.appendChild(styleSheet);