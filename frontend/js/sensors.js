class SensorManager {
    constructor() {
        this.sensors = new Map();
        this.mqttTopics = new Map();
        this.thresholds = new Map();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Listen for MQTT messages
        window.wsManager.on('mqtt', (data) => {
            this.handleMqttMessage(data);
        });

        // Listen for threshold responses
        window.wsManager.on('threshold_response', (data) => {
            this.handleThresholdResponse(data);
        });

        // Listen for device removal notifications
        window.wsManager.on('device_removed', (data) => {
            this.handleDeviceRemoved(data);
        });

        // Setup modal functionality
        this.setupModalHandlers();
    }

    handleMqttMessage(data) {
        const { topic, payload } = data;
        
        // Update MQTT topics table
        this.updateMqttTable(topic, payload);
        
        // Parse sensor data
        try {
            const sensorData = JSON.parse(payload);
            
            // Handle different message types
            if (topic === 'network/hello') {
                this.registerSensor(sensorData);
            } else if (topic === 'network/byebye') {
                this.removeSensor(sensorData.device_id);
            } else if (topic.startsWith('sensors/')) {
                this.updateSensorData(sensorData);
            } else if (topic.startsWith('actuators/')) {
                this.handleAlarm(topic, sensorData);
            }
        } catch (error) {
            // Not JSON data, might be simple string payload
            console.log('Non-JSON MQTT payload:', topic, payload);
        }
    }

    updateMqttTable(topic, payload) {
        const now = new Date();
        this.mqttTopics.set(topic, {
            payload: payload,
            timestamp: now,
            lastUpdate: now
        });
        
        this.renderMqttTable();
    }

    registerSensor(sensorData) {
        const { device_id, type, name, thresholds, unit } = sensorData;
        
        if (this.isSensorType(type)) {
            this.sensors.set(device_id, {
                ...sensorData,
                lastValue: null,
                lastUpdate: new Date(),
                status: 'good'
            });
            
            // Only use thresholds provided by the device
            if (thresholds && thresholds.warn !== undefined && thresholds.evac !== undefined) {
                this.thresholds.set(device_id, {
                    warn: thresholds.warn,
                    evac: thresholds.evac
                });
            }
            
            this.renderSensorGrid();
        }
    }

    removeSensor(deviceId) {
        this.sensors.delete(deviceId);
        this.thresholds.delete(deviceId);
        this.renderSensorGrid();
    }

    handleDeviceRemoved(data) {
        const { device_id } = data;
        console.log(`Removing sensor data for device: ${device_id}`);
        
        // Use the existing removeSensor method
        this.removeSensor(device_id);
        
        // Show notification if the device had sensor data
        if (this.sensors.has(device_id) || this.thresholds.has(device_id)) {
            console.log(`Cleaned up sensor data for removed device: ${device_id}`);
        }
    }

    updateSensorData(sensorData) {
        const { device_id, value, type } = sensorData;
        
        if (this.sensors.has(device_id)) {
            const sensor = this.sensors.get(device_id);
            sensor.lastValue = parseFloat(value);
            sensor.lastUpdate = new Date();
            sensor.status = this.calculateStatus(device_id, sensor.lastValue);
            
            this.sensors.set(device_id, sensor);
            this.renderSensorGrid();
        }
    }

    calculateStatus(deviceId, value) {
        const thresholds = this.thresholds.get(deviceId);
        // If no thresholds are provided by the device, always return 'good'
        if (!thresholds || value === null || value === undefined) return 'good';
        
        if (value >= thresholds.evac) return 'critical';
        if (value >= thresholds.warn) return 'warning';
        return 'good';
    }

    isSensorType(type) {
        return ['moisture_sensor', 'strain_sensor', 'vibration_sensor'].includes(type);
    }

    getUnit(deviceId) {
        const sensor = this.sensors.get(deviceId);
        return sensor && sensor.unit ? sensor.unit : '';
    }

    renderSensorGrid() {
        const grid = document.getElementById('sensor-grid');
        grid.innerHTML = '';
        
        if (this.sensors.size === 0) {
            grid.innerHTML = '<div class="no-data">No sensors available</div>';
            return;
        }
        
        this.sensors.forEach((sensor, deviceId) => {
            const sensorBox = this.createSensorBox(deviceId, sensor);
            grid.appendChild(sensorBox);
        });
    }

    createSensorBox(deviceId, sensor) {
        const box = document.createElement('div');
        box.className = `sensor-box status-${sensor.status}`;
        box.onclick = () => this.openThresholdModal(deviceId);
        
        const thresholds = this.thresholds.get(deviceId);
        const unit = this.getUnit(deviceId);
        
        box.innerHTML = `
            <div class="sensor-header">
                <div class="sensor-name">${sensor.name || deviceId}</div>
                <div class="sensor-status status-${sensor.status}"></div>
            </div>
            <div class="sensor-value">
                ${sensor.lastValue !== null ? sensor.lastValue.toFixed(2) : '--'}
                <span class="sensor-unit">${unit}</span>
            </div>
            <div class="sensor-thresholds">
                ${thresholds ? 
                    `Warning: ${thresholds.warn}${unit} | Critical: ${thresholds.evac}${unit}` :
                    'Thresholds: Not configured'
                }
            </div>
            <div class="sensor-info">
                <small>Type: ${sensor.type}</small><br>
                <small>Last update: ${sensor.lastUpdate.toLocaleTimeString()}</small>
            </div>
        `;
        
        return box;
    }

    renderMqttTable() {
        const tbody = document.querySelector('#mqtt-table tbody');
        tbody.innerHTML = '';
        
        if (this.mqttTopics.size === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="no-data">No MQTT messages received</td></tr>';
            return;
        }
        
        // Sort by topic name alphabetically
        const sortedTopics = Array.from(this.mqttTopics.entries())
            .sort((a, b) => a[0].localeCompare(b[0]));
        
        sortedTopics.forEach(([topic, data]) => {
            const row = document.createElement('tr');
            const deltaTime = this.formatDeltaTime(Date.now() - data.timestamp.getTime());
            
            row.innerHTML = `
                <td>${topic}</td>
                <td title="${data.payload}">${this.truncateText(data.payload, 50)}</td>
                <td>${data.timestamp.toLocaleString()}</td>
                <td>${deltaTime}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    formatDeltaTime(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
        return `${Math.floor(ms / 3600000)}h`;
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    setupModalHandlers() {
        const modal = document.getElementById('threshold-modal');
        const closeBtn = modal.querySelector('.close');
        const cancelBtn = document.getElementById('cancel-btn');
        const form = document.getElementById('threshold-form');
        
        closeBtn.onclick = () => this.closeThresholdModal();
        cancelBtn.onclick = () => this.closeThresholdModal();
        
        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                this.closeThresholdModal();
            }
        };
        
        form.onsubmit = (e) => {
            e.preventDefault();
            this.saveThresholds();
        };
    }

    openThresholdModal(deviceId) {
        const sensor = this.sensors.get(deviceId);
        const thresholds = this.thresholds.get(deviceId);
        
        if (!sensor) return;
        
        document.getElementById('device-name').value = sensor.name || deviceId;
        
        // If thresholds are not configured by the device, show empty fields
        if (thresholds) {
            document.getElementById('warning-threshold').value = thresholds.warn;
            document.getElementById('critical-threshold').value = thresholds.evac;
        } else {
            document.getElementById('warning-threshold').value = '';
            document.getElementById('critical-threshold').value = '';
        }
        
        // Store current device ID for saving
        document.getElementById('threshold-form').dataset.deviceId = deviceId;
        
        document.getElementById('threshold-modal').style.display = 'block';
    }

    closeThresholdModal() {
        document.getElementById('threshold-modal').style.display = 'none';
    }

    saveThresholds() {
        const form = document.getElementById('threshold-form');
        const deviceId = form.dataset.deviceId;
        const warn = parseFloat(document.getElementById('warning-threshold').value);
        const evac = parseFloat(document.getElementById('critical-threshold').value);
        
        if (warn >= evac) {
            alert('Warning threshold must be less than critical threshold');
            return;
        }
        
        // Update local thresholds
        this.thresholds.set(deviceId, { warn, evac });
        
        // Send to backend
        const success = window.wsManager.setThreshold(deviceId, warn, evac);
        
        if (success) {
            this.closeThresholdModal();
            this.renderSensorGrid();
        } else {
            alert('Failed to update thresholds. Please check connection.');
        }
    }

    handleThresholdResponse(data) {
        if (data.status === 'error') {
            alert(`Error updating thresholds: ${data.error}`);
        } else {
            console.log('Thresholds updated successfully:', data);
        }
    }

    handleAlarm(topic, data) {
        // This will be handled by the alarms manager
        if (window.alarmManager) {
            window.alarmManager.addAlarm(topic, data);
        }
    }

    // Update MQTT table periodically to refresh delta times
    startPeriodicUpdate() {
        setInterval(() => {
            this.renderMqttTable();
        }, 1000);
    }
}

// Initialize sensor manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sensorManager = new SensorManager();
    window.sensorManager.startPeriodicUpdate();
});