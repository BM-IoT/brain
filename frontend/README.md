# IoT Brain Dashboard Frontend

A real-time web dashboard for monitoring IoT sensors, devices, and alarms using WebSocket communication.

## Features

### 🌡️ Sensor Overview (Page 1)
- Real-time sensor data display with color-coded status (green/orange/red)
- Interactive sensor boxes showing current values and thresholds
- Click to edit warning and critical thresholds for each sensor
- Live MQTT topics table with message history and delta times

### 📱 Device Management (Page 2)
- List of all connected devices with online/offline status
- Device details including battery level, signal strength, and sensor readings
- Detailed device information modal with full specifications
- Real-time device status updates

### 📈 Sensor History (Page 3)
- Dynamic charts for each sensor type (automatically generated)
- Configurable time ranges (1h, 6h, 24h, 7d)
- Interactive charts with hover tooltips showing device information
- Random colors for different sensor types

### 🚨 Alarm History (Page 4)
- Real-time alarm statistics and counters
- Comprehensive alarm history table with filtering
- Browser notifications for critical alerts
- Alarm acknowledgment system

## Getting Started

### Prerequisites
- Python 3.6+ (for the development server)
- Modern web browser with WebSocket support
- IoT Brain backend running on WebSocket port 8765

### Quick Start

1. **Start the IoT Brain backend** (from the main project directory):
   ```bash
   cd src
   python3 main.py
   ```

2. **Start the frontend server**:
   ```bash
   cd frontend
   python3 serve.py
   ```

3. **Open your browser** and navigate to:
   ```
   http://localhost:8080
   ```

### Alternative Serving Methods

You can also serve the frontend using:

**Node.js (if you have it installed):**
```bash
npx http-server . -p 8080 --cors
```

**Python's built-in server:**
```bash
python3 -m http.server 8080
```

**Any other web server** that can serve static files.

## Architecture

### WebSocket Communication
The frontend communicates with the backend exclusively via WebSocket on port 8765:

**Outgoing Messages (Frontend → Backend):**
- `set_threshold`: Update sensor thresholds
- `publish`: Publish MQTT messages
- `echo`: Test connection

**Incoming Messages (Backend → Frontend):**
- `mqtt`: Real-time MQTT message data
- `set_threshold`: Threshold update responses
- `error`: Error messages

### Data Flow
1. **Sensors**: MQTT messages from IoT devices are forwarded via WebSocket
2. **Devices**: Device registration/removal through network/hello and network/byebye topics
3. **History**: Real-time sensor data is stored and charted dynamically
4. **Alarms**: Threshold breaches trigger alarms and notifications

## File Structure

```
frontend/
├── index.html              # Main HTML structure
├── serve.py                # Development server
├── css/
│   └── styles.css          # All styling and responsive design
└── js/
    ├── websocket.js        # WebSocket connection management
    ├── sensors.js          # Sensor overview page logic
    ├── devices.js          # Device management page logic
    ├── history.js          # Historical data and charts
    ├── alarms.js           # Alarm management and notifications
    └── main.js             # Navigation and app initialization
```

## Configuration

### WebSocket Connection
The frontend automatically connects to WebSocket server at:
```
ws://[current-hostname]:8765
```

If your backend runs on a different host or port, modify the `wsUrl` in `js/websocket.js`:
```javascript
const wsUrl = 'ws://your-backend-host:8765';
```

### Sensor Types
The dashboard automatically detects and creates charts for these sensor types:
- `moisture_sensor` (%)
- `strain_sensor` (µε)
- `vibration_sensor` (g)
- `temperature_sensor` (°C)
- `humidity_sensor` (%)
- `pressure_sensor` (hPa)

Additional sensor types can be added by updating the sensor type arrays in the respective JavaScript files.

## Browser Support

- **Chrome/Chromium** 60+
- **Firefox** 55+
- **Safari** 11+
- **Edge** 79+

### Required Features
- WebSocket support
- ES6 JavaScript features
- CSS Grid and Flexbox
- Chart.js library (loaded from CDN)

## Keyboard Shortcuts

- `Alt + 1`: Navigate to Sensors page
- `Alt + 2`: Navigate to Devices page
- `Alt + 3`: Navigate to History page
- `Alt + 4`: Navigate to Alarms page
- `Esc`: Close any open modal

## Troubleshooting

### Connection Issues
1. Ensure the IoT Brain backend is running
2. Check that WebSocket port 8765 is accessible
3. Verify firewall settings
4. Check browser console for WebSocket errors

### No Data Appearing
1. Verify MQTT devices are sending data
2. Check that topics match expected format
3. Ensure JSON payloads are properly formatted
4. Check backend logs for MQTT connection issues

### Performance Issues
1. Limit historical data points (currently set to 100 per sensor)
2. Reduce chart update frequency if needed
3. Close unused browser tabs
4. Use Chrome DevTools to profile performance

## Development

### Adding New Features
1. **New sensor types**: Update the sensor type arrays in relevant JS files
2. **New pages**: Add HTML structure, navigation, and corresponding JS file
3. **New WebSocket messages**: Update the message handlers in websocket.js

### Debugging
Open browser DevTools and use these console commands:
- `getSystemStatus()`: Get current system state
- `exportSystemData()`: Export all data as JSON
- `window.wsManager`: Access WebSocket manager
- `window.sensorManager`: Access sensor data
- `window.deviceManager`: Access device data

### Testing
The application includes sample data generators for testing:
- Uncomment sample data generation in history.js for chart testing
- Uncomment sample alarm generation in alarms.js for alarm testing

## Contributing

1. Follow the existing code structure and naming conventions
2. Ensure responsive design compatibility
3. Test on multiple browsers
4. Add appropriate error handling
5. Update this README for new features

## License

This frontend is part of the IoT Brain project and follows the same license terms.