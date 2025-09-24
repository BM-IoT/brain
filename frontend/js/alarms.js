class AlarmManager {
    constructor() {
        this.alarms = [];
        this.maxAlarms = 1000; // Limit stored alarms
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Listen for MQTT messages related to alarms
        window.wsManager.on('mqtt', (data) => {
            this.handleMqttMessage(data);
        });

        // Listen for device removal notifications
        window.wsManager.on('device_removed', (data) => {
            this.handleDeviceRemoved(data);
        });
    }

    handleMqttMessage(data) {
        const { topic, payload } = data;
        
        // Handle actuator messages (alarms)
        if (topic.startsWith('actuators/')) {
            this.handleActuatorMessage(topic, payload);
        }
        
        // Also listen for direct sensor threshold breaches
        if (topic.startsWith('sensors/')) {
            try {
                const sensorData = JSON.parse(payload);
                this.checkSensorThresholds(sensorData);
            } catch (error) {
                // Not JSON data, ignore
            }
        }
    }

    handleActuatorMessage(topic, payload) {
        const severity = topic.includes('evac') ? 'critical' : 
                        topic.includes('warn') ? 'warning' : 'info';
        
        // Parse payload - might be "device_id value" format
        const parts = payload.split(' ');
        const deviceId = parts[0];
        const value = parts.length > 1 ? parseFloat(parts[1]) : null;
        
        this.addAlarm({
            deviceId: deviceId,
            type: 'threshold_breach',
            severity: severity,
            value: value,
            message: `${severity.charAt(0).toUpperCase() + severity.slice(1)} threshold breached`,
            source: topic
        });
    }

    checkSensorThresholds(sensorData) {
        const { device_id, value, type } = sensorData;
        
        // Get thresholds from sensor manager if available
        if (window.sensorManager && window.sensorManager.thresholds.has(device_id)) {
            const thresholds = window.sensorManager.thresholds.get(device_id);
            const sensorValue = parseFloat(value);
            
            if (sensorValue >= thresholds.evac) {
                this.addAlarm({
                    deviceId: device_id,
                    type: type,
                    severity: 'critical',
                    value: sensorValue,
                    threshold: thresholds.evac,
                    message: `Critical threshold exceeded: ${sensorValue} >= ${thresholds.evac}`
                });
            } else if (sensorValue >= thresholds.warn) {
                this.addAlarm({
                    deviceId: device_id,
                    type: type,
                    severity: 'warning',
                    value: sensorValue,
                    threshold: thresholds.warn,
                    message: `Warning threshold exceeded: ${sensorValue} >= ${thresholds.warn}`
                });
            }
        }
    }

    addAlarm(alarmData) {
        const alarm = {
            id: this.generateAlarmId(),
            timestamp: new Date(),
            deviceId: alarmData.deviceId,
            type: alarmData.type,
            severity: alarmData.severity,
            value: alarmData.value,
            threshold: alarmData.threshold,
            message: alarmData.message,
            source: alarmData.source,
            acknowledged: false
        };
        
        // Check if this is a duplicate alarm (same device, type, severity within 1 minute)
        const isDuplicate = this.alarms.some(existingAlarm => 
            existingAlarm.deviceId === alarm.deviceId &&
            existingAlarm.type === alarm.type &&
            existingAlarm.severity === alarm.severity &&
            (alarm.timestamp - existingAlarm.timestamp) < 60000 && // 1 minute
            !existingAlarm.acknowledged
        );
        
        if (!isDuplicate) {
            this.alarms.unshift(alarm); // Add to beginning for newest first
            
            // Limit stored alarms
            if (this.alarms.length > this.maxAlarms) {
                this.alarms = this.alarms.slice(0, this.maxAlarms);
            }
            
            this.updateAlarmDisplay();
            this.showNotification(alarm);
        }
    }

    handleDeviceRemoved(data) {
        const { device_id } = data;
        console.log(`Cleaning up alarms for removed device: ${device_id}`);
        
        // Add a notification alarm about the device removal
        this.addAlarm({
            deviceId: device_id,
            type: 'device_removed',
            severity: 'info',
            value: null,
            message: `Device ${device_id} has been removed due to inactivity`,
            source: 'system'
        });
        
        // Optionally, you could also mark all previous alarms from this device as outdated
        // by adding a flag or changing their display style
        this.alarms.forEach(alarm => {
            if (alarm.deviceId === device_id && !alarm.deviceRemoved) {
                alarm.deviceRemoved = true;
            }
        });
        
        this.updateAlarmDisplay();
    }

    generateAlarmId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    updateAlarmDisplay() {
        this.updateStatistics();
        this.updateAlarmTable();
    }

    updateStatistics() {
        const now = Date.now();
        const last24h = now - (24 * 60 * 60 * 1000);
        
        const totalAlarms = this.alarms.length;
        const warningAlarms = this.alarms.filter(alarm => alarm.severity === 'warning').length;
        const criticalAlarms = this.alarms.filter(alarm => alarm.severity === 'critical').length;
        const recentAlarms = this.alarms.filter(alarm => alarm.timestamp.getTime() > last24h).length;
        
        document.getElementById('totalAlarms').textContent = totalAlarms;
        document.getElementById('warningAlarms').textContent = warningAlarms;
        document.getElementById('criticalAlarms').textContent = criticalAlarms;
        document.getElementById('recentAlarms').textContent = recentAlarms;
    }

    updateAlarmTable() {
        const tbody = document.querySelector('#alarm-table tbody');
        tbody.innerHTML = '';
        
        if (this.alarms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No alarms recorded</td></tr>';
            return;
        }
        
        // Show most recent 50 alarms
        const displayAlarms = this.alarms.slice(0, 50);
        
        displayAlarms.forEach(alarm => {
            const row = document.createElement('tr');
            row.className = alarm.acknowledged ? 'acknowledged' : '';
            
            const deviceName = this.getDeviceName(alarm.deviceId);
            const unit = this.getUnit(alarm.type);
            
            row.innerHTML = `
                <td>${alarm.timestamp.toLocaleString()}</td>
                <td>${deviceName}</td>
                <td>${this.formatAlarmType(alarm.type)}</td>
                <td>${alarm.value !== null ? `${alarm.value.toFixed(2)} ${unit}` : 'N/A'}</td>
                <td>${alarm.threshold !== null ? `${alarm.threshold} ${unit}` : 'N/A'}</td>
                <td>
                    <span class="severity-badge severity-${alarm.severity}">
                        ${alarm.severity.toUpperCase()}
                    </span>
                </td>
            `;
            
            // Add click handler for acknowledgment
            row.onclick = () => this.toggleAcknowledgment(alarm.id);
            
            tbody.appendChild(row);
        });
    }

    getDeviceName(deviceId) {
        // Try to get device name from device manager
        if (window.deviceManager && window.deviceManager.devices.has(deviceId)) {
            const device = window.deviceManager.devices.get(deviceId);
            return device.name || deviceId;
        }
        
        // Try to get device name from sensor manager
        if (window.sensorManager && window.sensorManager.sensors.has(deviceId)) {
            const sensor = window.sensorManager.sensors.get(deviceId);
            return sensor.name || deviceId;
        }
        
        return deviceId;
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

    formatAlarmType(type) {
        if (!type) return 'Unknown';
        
        return type
            .replace(/_/g, ' ')
            .replace(/sensor/g, '')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    toggleAcknowledgment(alarmId) {
        const alarm = this.alarms.find(a => a.id === alarmId);
        if (alarm) {
            alarm.acknowledged = !alarm.acknowledged;
            this.updateAlarmDisplay();
        }
    }

    showNotification(alarm) {
        // Show browser notification if permissions are granted
        if (Notification.permission === 'granted') {
            const deviceName = this.getDeviceName(alarm.deviceId);
            const notification = new Notification(`IoT Alert: ${alarm.severity.toUpperCase()}`, {
                body: `${deviceName}: ${alarm.message}`,
                icon: alarm.severity === 'critical' ? '🚨' : '⚠️',
                requireInteraction: alarm.severity === 'critical'
            });
            
            setTimeout(() => notification.close(), 5000);
        }
        
        // Also show in-app notification
        this.showInAppNotification(alarm);
    }

    showInAppNotification(alarm) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${alarm.severity}`;
        
        const deviceName = this.getDeviceName(alarm.deviceId);
        
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${alarm.severity.toUpperCase()} Alert</div>
                <div class="notification-message">${deviceName}: ${alarm.message}</div>
                <div class="notification-time">${alarm.timestamp.toLocaleTimeString()}</div>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        // Add to body
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds or on click
        const removeNotification = () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        };
        
        notification.querySelector('.notification-close').onclick = removeNotification;
        setTimeout(removeNotification, 10000);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
    }

    // Request notification permission
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // Export alarms as CSV
    exportAlarms() {
        if (this.alarms.length === 0) {
            alert('No alarms to export');
            return;
        }
        
        const csv = ['Timestamp,Device,Type,Value,Threshold,Severity,Message,Acknowledged']
            .concat(this.alarms.map(alarm => 
                `${alarm.timestamp.toISOString()},${alarm.deviceId},"${this.formatAlarmType(alarm.type)}",${alarm.value || ''},${alarm.threshold || ''},${alarm.severity},"${alarm.message}",${alarm.acknowledged}`
            ))
            .join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alarms_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // Clear all alarms
    clearAllAlarms() {
        if (confirm('Are you sure you want to clear all alarms?')) {
            this.alarms = [];
            this.updateAlarmDisplay();
        }
    }

    // Generate sample alarms for testing
    generateSampleAlarms() {
        const sampleDevices = ['device_1', 'device_2', 'device_3'];
        const sampleTypes = ['moisture_sensor', 'strain_sensor', 'vibration_sensor'];
        const sampleSeverities = ['warning', 'critical'];
        
        for (let i = 0; i < 20; i++) {
            const deviceId = sampleDevices[Math.floor(Math.random() * sampleDevices.length)];
            const type = sampleTypes[Math.floor(Math.random() * sampleTypes.length)];
            const severity = sampleSeverities[Math.floor(Math.random() * sampleSeverities.length)];
            const value = Math.random() * 100;
            const threshold = value - Math.random() * 20;
            
            this.addAlarm({
                deviceId: deviceId,
                type: type,
                severity: severity,
                value: value,
                threshold: threshold,
                message: `${severity} threshold breached: ${value.toFixed(2)} >= ${threshold.toFixed(2)}`
            });
            
            // Vary timestamps
            this.alarms[0].timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        }
        
        // Sort by timestamp (newest first)
        this.alarms.sort((a, b) => b.timestamp - a.timestamp);
        this.updateAlarmDisplay();
    }
}

// Initialize alarm manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.alarmManager = new AlarmManager();
    window.alarmManager.requestNotificationPermission();
    
    // Uncomment the next line to generate sample alarms for testing
    // setTimeout(() => window.alarmManager.generateSampleAlarms(), 2000);
});

// Add notification styles
const notificationStyles = `
.notification {
    position: fixed;
    top: 20px;
    right: -400px;
    width: 350px;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    transition: right 0.3s ease;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.notification.show {
    right: 20px;
}

.notification-warning {
    background-color: #f39c12;
    color: white;
}

.notification-critical {
    background-color: #e74c3c;
    color: white;
}

.notification-content {
    flex: 1;
}

.notification-title {
    font-weight: bold;
    margin-bottom: 0.5rem;
}

.notification-message {
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
}

.notification-time {
    font-size: 0.8rem;
    opacity: 0.8;
}

.notification-close {
    background: none;
    border: none;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0;
    margin-left: 1rem;
}

.notification-close:hover {
    opacity: 0.7;
}

.acknowledged {
    opacity: 0.6;
    background-color: #f8f9fa;
}

.alarm-table tr:hover:not(.acknowledged) {
    background-color: #fff5f5;
}

.alarm-table tr.acknowledged:hover {
    background-color: #f0f0f0;
}
`;

// Inject notification styles
const notificationStyleSheet = document.createElement('style');
notificationStyleSheet.textContent = notificationStyles;
document.head.appendChild(notificationStyleSheet);