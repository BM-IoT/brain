# MQTT Test Data Sender

A comprehensive MQTT test data sender for the IoT Brain system that simulates various IoT devices and sensors.

## Features

### 🌡️ Simulated Devices
- **Moisture Sensor** - Garden moisture monitoring (10-80%)
- **Strain Sensor** - Bridge structural monitoring (-500 to 2000 µε) 
- **Vibration Sensor** - Machine vibration monitoring (0-10g)
- **Temperature Sensor** - Environmental temperature (-10 to 50°C)
- **Humidity Sensor** - Humidity monitoring (20-95%)

### 📡 MQTT Topics Covered
- `network/hello` - Device registration with full metadata
- `network/byebye` - Device removal notifications  
- `network/alive` - Device keepalive/heartbeat messages
- `sensors/*` - Real-time sensor data with threshold testing

### 🎛️ Test Features
- **Auto-discovery** - Finds MQTT broker via UDP multicast
- **Realistic data** - Sensor values with natural variation
- **Threshold testing** - Generates warning/critical alerts
- **Device lifecycle** - Full registration → data → cleanup cycle
- **Interactive mode** - Menu-driven testing interface
- **Continuous streaming** - Configurable data intervals

## Quick Start

### Start the IoT Brain
```bash
cd src
python3 main.py
```

## Usage Options

### Command Line Scripts

```bash
# Auto-discover broker and run test sequence
./run_test_sender.sh

# Start continuous data stream immediately
./run_test_sender.sh --continuous 5   # 5 second intervals

# Show help
./run_test_sender.sh --help
```

### Direct Python Usage

```bash
# Auto-discover and run test sequence
python3 mqtt_test_sender.py
```
## Expected Output

### Device Registration
```
📡 Registered device: Garden Moisture Sensor (moisture_sensor_001)
📡 Registered device: Bridge Strain Sensor (strain_sensor_002)
📡 Registered device: Machine Vibration Monitor (vibration_sensor_003)
```

### Sensor Data Stream
```
📊 moisture_sensor_001: 45.23% 🟢 NORMAL
📊 strain_sensor_002: 156.78µε 🟢 NORMAL
📊 vibration_sensor_003: 0.87g 🟢 NORMAL
📊 temp_sensor_004: 23.45°C 🟢 NORMAL
📊 humidity_sensor_005: 62.11% 🟢 NORMAL
```

### Threshold Breaches
```
📊 moisture_sensor_001: 72.15% 🟡 WARNING
📊 strain_sensor_002: 1850.23µε 🔴 CRITICAL
```

## Integration with IoT Brain

The test sender integrates with all major IoT Brain components:

### 📊 Dashboard Integration
- **Sensors Page** - Real-time sensor data and threshold status
- **Devices Page** - Device registration, battery, signal strength
- **History Page** - Historical sensor data charts
- **Alarms Page** - Threshold breach notifications

### ⚙️ Control Logic Integration
- **Threshold Monitoring** - Triggers actuator messages on breaches
- **Device Management** - TTL-based device lifecycle tracking
- **WebSocket Notifications** - Real-time updates to dashboard

### 🔔 Expected Responses
When thresholds are breached, the brain should publish:
- `actuators/warn` - Warning level responses
- `actuators/evac` - Critical level responses

## Dependencies

```bash
# Required Python packages
pip3 install paho-mqtt

# Or install from requirements.txt
pip3 install -r requirements.txt
```

## Troubleshooting

### Connection Issues
- Ensure IoT Brain is running (`cd src && python3 main.py`)
- Check that MQTT broker port is accessible
- Verify firewall settings if using remote broker

### No Data in Dashboard
1. Check WebSocket connection (should show "Connected" in dashboard)
2. Verify MQTT messages are being published (check terminal output)
3. Ensure device registration completed successfully

### Threshold Alarms Not Triggering
1. Confirm devices registered with thresholds (`network/hello` sent)
2. Check that sensor data includes `device_id`, `type`, and `value`
3. Verify ControlLogic is monitoring the correct sensor types

## Advanced Usage

### Custom Device Configuration
Edit `mqtt_test_sender.py` to modify device configurations:

```python
{
    "device_id": "custom_sensor_001",
    "name": "My Custom Sensor", 
    "type": "moisture_sensor",  # Must match ControlLogic.sensor_types
    "unit": "%",
    "thresholds": {"warn": 60, "evac": 80},
    # ... other properties
}
```

### Testing Specific Scenarios
- **Device Timeout**: Stop sender without cleanup to test TTL expiry
- **Network Issues**: Use `--broker` with unreachable IP to test reconnection
- **High Frequency**: Use very short intervals to test performance
- **Threshold Tuning**: Modify threshold values to test alarm sensitivity

## Integration Testing

For complete system testing:

1. **Start IoT Brain**: `cd src && python3 main.py`
2. **Open Dashboard**: Navigate to displayed frontend URL
3. **Run Test Sender**: `./run_test_sender.sh`
4. **Verify Components**:
   - Sensors page shows registered devices
   - Real-time data updates
   - Threshold breaches trigger alarms
   - Device management shows online status
   - History charts populate with data

This test sender provides comprehensive coverage of all IoT Brain functionality and helps ensure the system works correctly end-to-end.