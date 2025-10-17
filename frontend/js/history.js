class HistoryManager {
    constructor() {
        this.sensorHistory = new Map(); // sensorType -> array of data points
        this.charts = new Map(); // sensorType -> Chart instance
        this.colors = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#16a085'
        ];
        this.colorIndex = 0;
        this.maxDataPoints = 100;
        this.timeRange = '24h';
        
        console.log('HistoryManager initialized');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Listen for sensor data
        window.wsManager.on('mqtt', (data) => {
            this.handleMqttMessage(data);
        });

        // Time range selector
        const timeRange = document.getElementById('timeRange');
        if (timeRange) {
            timeRange.addEventListener('change', (e) => {
                this.timeRange = e.target.value;
                this.updateAllCharts();
            });
        }
    }

    handleMqttMessage(data) {
        const { topic, payload } = data;
        
        if (topic.startsWith('sensors/')) {
            try {
                const sensorData = JSON.parse(payload);
                this.addDataPoint(sensorData);
            } catch (error) {
                // Not JSON data, ignore
            }
        }
    }

    addDataPoint(sensorData) {
        let { type, value, device_id } = sensorData;
        
        // If type is missing, try to infer it from device_id
        if (!type && device_id) {
            type = this.inferSensorType(device_id);
        }
        
        if (!type || value === undefined) {
            console.log('Invalid sensor data:', sensorData);
            return;
        }
        
        console.log(`Adding data point: ${type} = ${value} from ${device_id}`);
        
        // Handle timestamp - use provided timestamp or current time
        let timestamp;
        if (sensorData.timestamp) {
            // If timestamp is a Unix timestamp (seconds), convert to milliseconds
            const ts = typeof sensorData.timestamp === 'number' ? sensorData.timestamp : parseInt(sensorData.timestamp);
            timestamp = new Date(ts < 10000000000 ? ts * 1000 : ts);
        } else {
            timestamp = new Date();
        }
        const dataPoint = {
            timestamp: timestamp,
            value: parseFloat(value),
            deviceId: device_id,
            x: timestamp.getTime(),
            y: parseFloat(value)
        };
        
        // Initialize sensor history if it doesn't exist
        if (!this.sensorHistory.has(type)) {
            this.sensorHistory.set(type, []);
        }
        
        const history = this.sensorHistory.get(type);
        history.push(dataPoint);
        
        // Limit data points to prevent memory issues
        if (history.length > this.maxDataPoints) {
            history.shift();
        }
        
        this.sensorHistory.set(type, history);
        
        // Update or create chart for this sensor type
        this.updateChart(type);
    }

    updateChart(sensorType) {
        const chartId = `chart-${sensorType}`;
        let canvas = document.getElementById(chartId);
        
        if (!canvas) {
            // Create new chart
            this.createChart(sensorType);
            return;
        }
        
        const chart = this.charts.get(sensorType);
        if (!chart) return;
        
        const filteredData = this.getFilteredData(sensorType);
        chart.data.datasets[0].data = filteredData;
        chart.update('none'); // No animation for real-time updates
    }

    createChart(sensorType) {
        const chartsContainer = document.getElementById('charts-container');
        if (!chartsContainer) {
            console.error('Charts container not found');
            return;
        }
        
        console.log(`Creating chart for sensor type: ${sensorType}`);
        
        // Create chart card
        const chartCard = document.createElement('div');
        chartCard.className = 'chart-card';
        chartCard.innerHTML = `
            <h3 class="chart-title">${this.formatSensorTypeName(sensorType)}</h3>
            <div class="chart-container">
                <canvas id="chart-${sensorType}"></canvas>
            </div>
        `;
        
        chartsContainer.appendChild(chartCard);
        
        // Initialize Chart.js
        const canvas = document.getElementById(`chart-${sensorType}`);
        if (!canvas) {
            console.error(`Canvas not found for sensor type: ${sensorType}`);
            return;
        }
        
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const color = this.getNextColor();
        const filteredData = this.getFilteredData(sensorType);
        
        console.log(`Creating chart with ${filteredData.length} data points for ${sensorType}`);
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: this.formatSensorTypeName(sensorType),
                    data: filteredData,
                    borderColor: color,
                    backgroundColor: this.hexToRgba(color, 0.1),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                minute: 'HH:mm',
                                hour: 'HH:mm',
                                day: 'MMM DD'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: `${this.formatSensorTypeName(sensorType)} (${this.getUnit(sensorType)})`
                        },
                        beginAtZero: false
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return new Date(context[0].parsed.x).toLocaleString();
                            },
                            label: function(context) {
                                const point = context.raw;
                                return `${context.dataset.label}: ${point.y.toFixed(2)} ${this.getUnit(sensorType)} (Device: ${point.deviceId || 'Unknown'})`;
                            }.bind(this)
                        }
                    }
                },
                animation: {
                    duration: 0 // Disable animations for better performance
                }
            }
        });
        
        this.charts.set(sensorType, chart);
    }

    getFilteredData(sensorType) {
        const history = this.sensorHistory.get(sensorType) || [];
        const now = Date.now();
        const timeRangeMs = this.getTimeRangeMs();
        
        return history
            .filter(point => (now - point.timestamp.getTime()) <= timeRangeMs)
            .map(point => ({
                x: point.timestamp.getTime(),
                y: point.value,
                deviceId: point.deviceId
            }));
    }

    getTimeRangeMs() {
        const ranges = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        };
        return ranges[this.timeRange] || ranges['24h'];
    }

    updateAllCharts() {
        this.charts.forEach((chart, sensorType) => {
            const filteredData = this.getFilteredData(sensorType);
            chart.data.datasets[0].data = filteredData;
            chart.update();
        });
    }

    formatSensorTypeName(sensorType) {
        return sensorType
            .replace(/_/g, ' ')
            .replace(/sensor/g, '')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    getUnit(sensorType) {
        const units = {
            moisture_sensor: '%',
            strain_sensor: 'µε',
            vibration_sensor: 'g',
            temperature_sensor: '°C',
            humidity_sensor: '%',
            pressure_sensor: 'hPa',
            generic_sensor: 'units'
        };
        return units[sensorType] || '';
    }

    inferSensorType(deviceId) {
        // Try to infer sensor type from device ID
        const deviceIdLower = deviceId.toLowerCase();
        
        if (deviceIdLower.includes('moisture')) return 'moisture_sensor';
        if (deviceIdLower.includes('strain')) return 'strain_sensor';
        if (deviceIdLower.includes('vibration') || deviceIdLower.includes('vib')) return 'vibration_sensor';
        if (deviceIdLower.includes('temperature') || deviceIdLower.includes('temp')) return 'temperature_sensor';
        if (deviceIdLower.includes('humidity') || deviceIdLower.includes('hum')) return 'humidity_sensor';
        if (deviceIdLower.includes('pressure') || deviceIdLower.includes('press')) return 'pressure_sensor';
        
        // Default fallback - treat as generic sensor
        return 'generic_sensor';
    }

    getNextColor() {
        const color = this.colors[this.colorIndex % this.colors.length];
        this.colorIndex++;
        return color;
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Generate sample data for testing (remove in production)
    generateSampleData() {
        const sensorTypes = ['moisture_sensor', 'strain_sensor', 'vibration_sensor'];
        const now = Date.now();
        
        sensorTypes.forEach((type, typeIndex) => {
            const data = [];
            
            // Generate 50 data points over the last 24 hours
            for (let i = 0; i < 50; i++) {
                const timestamp = new Date(now - (49 - i) * 30 * 60 * 1000); // Every 30 minutes
                const baseValue = 10 + typeIndex * 20;
                const value = baseValue + Math.sin(i * 0.2) * 15 + Math.random() * 10;
                
                data.push({
                    timestamp: timestamp,
                    value: Math.max(0, value),
                    deviceId: `device_${typeIndex + 1}`,
                    x: timestamp.getTime(),
                    y: Math.max(0, value)
                });
            }
            
            this.sensorHistory.set(type, data);
            this.createChart(type);
        });
    }

    // Clear all charts and data
    clearAll() {
        this.sensorHistory.clear();
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
        
        const chartsContainer = document.getElementById('charts-container');
        if (chartsContainer) {
            chartsContainer.innerHTML = '';
        }
        
        this.colorIndex = 0;
    }

    // Export data as CSV
    exportData(sensorType) {
        const history = this.sensorHistory.get(sensorType);
        if (!history || history.length === 0) {
            alert('No data available to export');
            return;
        }
        
        const csv = ['Timestamp,Value,Device ID']
            .concat(history.map(point => 
                `${point.timestamp.toISOString()},${point.value},${point.deviceId || ''}`
            ))
            .join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sensorType}_data.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }
}

// Initialize history manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.historyManager = new HistoryManager();
    
    // Uncomment the next line to generate sample data for testing
    // setTimeout(() => window.historyManager.generateSampleData(), 1000);
});