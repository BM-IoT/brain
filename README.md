# SHIELD Brain - IoT Control and Monitoring System

The SHIELD Brain is a comprehensive IoT control and monitoring system that interprets sensor data and activates alarms for warnings or evacuations when needed. It acts as a central hub for IoT device management, real-time monitoring, threshold-based alerting, and data visualization.

## 🏗️ Architecture Overview

The system consists of several interconnected components:

- **MQTT Broker Integration** - Mosquitto broker for device communication
- **Device Management** - Automatic device discovery, registration, and lifecycle management
- **Control Logic** - Threshold-based alarm system with warning and evacuation alerts
- **WebSocket Server** - Real-time communication with web dashboard
- **UDP Multicast** - Automatic broker discovery for network clients
- **Web Dashboard** - Real-time monitoring interface (frontend)

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [System Architecture](#system-architecture)
3. [MQTT API Documentation](#mqtt-api-documentation)
4. [Device Management](#device-management)
5. [Control Logic & Thresholds](#control-logic--thresholds)
6. [Installation & Dependencies](#installation--dependencies)
7. [Configuration](#configuration)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Mosquitto MQTT broker installed on system
- Network connectivity

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd brain

# Install Python dependencies
pip install -r requirements.txt

# Make sure mosquitto is installed (Linux/Ubuntu)
sudo apt-get install mosquitto mosquitto-clients
```

### Running the System
```bash
# Start the main brain system
cd src
python3 main.py
```

The system will automatically:
- Start a Mosquitto MQTT broker on a free port
- Launch the web dashboard server
- Begin UDP multicast for broker discovery
- Start WebSocket server for real-time communication

### Testing with Example Data
```bash
# In a separate terminal, run the test sender
cd examples
python3 mqtt_test_sender.py

# Or use the interactive mode
python3 mqtt_test_sender.py --interactive

# Or use the shell script
./run_test_sender.sh
```

## 🏛️ System Architecture

### Core Components

#### 1. Main Controller (`main.py`)
- **Purpose**: Central orchestrator that manages all system components
- **Functions**: 
  - Starts and coordinates all services
  - Handles MQTT message routing
  - Manages WebSocket communication
  - Provides system status monitoring

#### 2. Device Manager (`device_manager.py`)
- **Purpose**: Manages IoT device lifecycle and health monitoring
- **Functions**:
  - Device registration and discovery
  - TTL (Time-To-Live) monitoring
  - Device status tracking
  - Automatic cleanup of stale devices

#### 3. Control Logic (`control_logic.py`)
- **Purpose**: Implements threshold-based monitoring and alerting
- **Functions**:
  - Sensor data analysis
  - Threshold violation detection
  - Alarm activation (warning/evacuation)
  - Dynamic threshold management

#### 4. UDP Multicast Server (`server_data_multicast.py`)
- **Purpose**: Enables automatic MQTT broker discovery
- **Functions**:
  - Broadcasts broker IP and port
  - Allows clients to find the broker automatically
  - Network service discovery

#### 5. WebSocket Server (`websocket_server.py`)
- **Purpose**: Real-time communication with web clients
- **Functions**:
  - Bidirectional client communication
  - Real-time data streaming
  - Command handling from dashboard

### Network Services

When the system starts, it provides these network services:

| Service | Purpose | Default Port | Protocol |
|---------|---------|--------------|----------|
| MQTT Broker | Device communication | Dynamic | TCP |
| WebSocket Server | Dashboard communication | 8765 | WebSocket |
| Web Dashboard | User interface | 8080 | HTTP |
| UDP Multicast | Broker discovery | 5007 | UDP |

## 📡 MQTT API Documentation

The SHIELD Brain system uses MQTT for all IoT device communication. Below are the detailed message formats and examples.

### Network Management Topics

#### Device Registration: `network/hello`
Sent when a device first connects to register itself with the system.

**Message Format:**
```json
{
  "device_id": "unique_device_identifier",
  "name": "Human readable device name",
  "type": "device_type",
  "unit": "measurement_unit",
  "thresholds": {
    "warn": 70.0,
    "evac": 85.0
  },
  "capabilities": ["capability1", "capability2"],
  "battery_level": 85,
  "signal_strength": -45,
  "ip": "192.168.1.100",
  "mac": "00:11:22:33:44:55",
  "version": "1.2.3",
  "TTL": 30,
  "timestamp": 1704067200
}
```

**Example:**
```json
{
  "device_id": "moisture_sensor_001",
  "name": "Garden Moisture Sensor",
  "type": "moisture_sensor",
  "unit": "%",
  "thresholds": {
    "warn": 70,
    "evac": 85
  },
  "capabilities": ["moisture_sensing", "wireless"],
  "battery_level": 85,
  "signal_strength": -45,
  "ip": "192.168.1.100",
  "mac": "00:11:22:33:44:55",
  "version": "1.2.3",
  "TTL": 30,
  "timestamp": 1704067200
}
```

#### Device Removal: `network/byebye`
Sent when a device is gracefully disconnecting from the system.

**Message Format:**
```json
{
  "device_id": "unique_device_identifier",
  "timestamp": 1704067200
}
```

**Example:**
```json
{
  "device_id": "moisture_sensor_001",
  "timestamp": 1704067200
}
```

#### Device Keepalive: `network/alive`
Periodic heartbeat message to indicate device is still active.

**Message Format:**
```json
{
  "device_id": "unique_device_identifier",
  "timestamp": 1704067200
}
```

**Example:**
```json
{
  "device_id": "moisture_sensor_001",
  "timestamp": 1704067200
}
```

### Sensor Data Topics

Sensor data is published to topic patterns: `sensors/{sensor_type}`

#### Supported Sensor Types:
- `sensors/moisture` - Soil/environmental moisture
- `sensors/vibration` - Mechanical vibration monitoring
- `sensors/strain` - Structural strain measurement
- `sensors/temperature` - Temperature monitoring
- `sensors/humidity` - Humidity monitoring

#### Sensor Data Format:
```json
{
  "device_id": "unique_device_identifier",
  "type": "sensor_type",
  "value": 45.7,
  "unit": "measurement_unit",
  "timestamp": 1704067200
}
```

#### Examples:

**Moisture Sensor Data:**
```json
{
  "device_id": "moisture_sensor_001",
  "type": "moisture_sensor",
  "value": 65.5,
  "unit": "%",
  "timestamp": 1704067200
}
```

**Vibration Sensor Data:**
```json
{
  "device_id": "vibration_sensor_003",
  "type": "vibration_sensor",
  "value": 2.3,
  "unit": "g",
  "timestamp": 1704067200
}
```

**Strain Sensor Data:**
```json
{
  "device_id": "strain_sensor_002",
  "type": "strain_sensor",
  "value": 1450.0,
  "unit": "µε",
  "timestamp": 1704067200
}
```

### Actuator/Alert Topics

The system publishes alerts to actuator topics when thresholds are exceeded.

#### Warning Alert: `actuators/warn`
Published when sensor value exceeds warning threshold.

**Message Format:**
```
"device_id sensor_value"
```

**Example:**
```
"moisture_sensor_001 72.5"
```

#### Evacuation Alert: `actuators/evac`
Published when sensor value exceeds evacuation threshold.

**Message Format:**
```
"device_id sensor_value"
```

**Example:**
```
"strain_sensor_002 1850.0"
```

### MQTT Client Implementation Example

Here's how to implement a basic MQTT client for the SHIELD Brain system:

```python
import paho.mqtt.client as mqtt
import json
import time

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    # Subscribe to actuator topics to receive alerts
    client.subscribe("actuators/warn")
    client.subscribe("actuators/evac")

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode()
    print(f"Received: {topic} -> {payload}")

# Create MQTT client
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

# Connect to SHIELD Brain MQTT broker
client.connect("localhost", 1883, 60)

# Register a device
hello_message = {
    "device_id": "my_sensor_001",
    "name": "My Temperature Sensor",
    "type": "temperature_sensor",
    "unit": "°C",
    "thresholds": {"warn": 35, "evac": 45},
    "capabilities": ["temperature_sensing"],
    "battery_level": 95,
    "signal_strength": -40,
    "version": "1.0.0",
    "TTL": 60,
    "timestamp": int(time.time())
}

client.publish("network/hello", json.dumps(hello_message))

# Send sensor data
sensor_data = {
    "device_id": "my_sensor_001",
    "type": "temperature_sensor", 
    "value": 23.5,
    "unit": "°C",
    "timestamp": int(time.time())
}

client.publish("sensors/temperature", json.dumps(sensor_data))

# Keep connection alive
client.loop_forever()
```

## 🔧 Device Management

### Device Lifecycle

1. **Registration Phase (`network/hello`)**
   - Device announces itself to the system
   - Provides capabilities, thresholds, and metadata
   - System adds device to active device list
   - Control logic initializes threshold monitoring

2. **Active Phase**
   - Device sends periodic sensor data
   - Device sends keepalive messages (`network/alive`)
   - System monitors device health via TTL

3. **Removal Phase**
   - Graceful: Device sends `network/byebye`
   - Automatic: TTL expiry triggers cleanup
   - System removes device and associated thresholds

### TTL (Time-To-Live) Management

Each device specifies a TTL value during registration. The system monitors device activity:

- **TTL Check Interval**: 2 seconds (configurable)
- **Expiry Action**: Automatic device removal and threshold cleanup
- **Keepalive**: Devices should send `network/alive` messages periodically

### Device Status Monitoring

The system tracks these device parameters:
- Last seen timestamp
- Battery level
- Signal strength
- Connection status
- Threshold configurations

## ⚡ Control Logic & Thresholds

### Threshold-Based Monitoring

The control logic monitors sensor data against configured thresholds:

#### Threshold Types:
- **Warning Threshold**: Triggers `actuators/warn` message
- **Evacuation Threshold**: Triggers `actuators/evac` message

#### Monitored Sensor Types:
- `moisture_sensor`
- `strain_sensor` 
- `vibration_sensor`

### Threshold Configuration

Thresholds can be configured in three ways:

1. **During Device Registration** (via `network/hello`)
2. **WebSocket API** (dynamic updates)
3. **Direct API calls** (programmatic updates)

#### WebSocket Threshold Update:
```json
{
  "type": "set_threshold",
  "data": {
    "device_id": "sensor_001",
    "warn": 75.0,
    "evac": 90.0
  }
}
```

### Alert Processing Flow

```
Sensor Data → Threshold Check → Alert Generation → MQTT Publish
     ↓              ↓               ↓              ↓
JSON Message → Value Compare → actuators/warn → Connected Clients
               ↓               or              
           Float Value → actuators/evac → Alert Systems
```

## 📦 Installation & Dependencies

### System Requirements
- **OS**: Linux (Ubuntu 18.04+), macOS, Windows
- **Python**: 3.8 or higher
- **RAM**: 512MB minimum, 1GB recommended
- **Network**: TCP/UDP connectivity required

### Dependencies

**Python Packages** (`requirements.txt`):
```
websockets>=11.0
paho-mqtt>=1.6.1
```

**System Dependencies**:
```bash
# Ubuntu/Debian
sudo apt-get install mosquitto mosquitto-clients

# macOS (with Homebrew)
brew install mosquitto

# CentOS/RHEL
sudo yum install mosquitto mosquitto-clients
```

### Installation Steps

1. **Clone Repository**:
```bash
git clone <repository-url>
cd brain
```

2. **Install Python Dependencies**:
```bash
pip install -r requirements.txt
# or using virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **Install System Dependencies**:
```bash
# Verify mosquitto installation
mosquitto -h
mosquitto_pub --help
```

4. **Verify Installation**:
```bash
cd src
python main.py
# Should start without errors and show service table
```

## ⚙️ Configuration

### Network Configuration

The system automatically configures network settings:

- **Auto IP Detection**: Uses `utils.get_local_ip()` to find local IP
- **Dynamic Port Allocation**: Uses `utils.find_free_port()` for MQTT broker
- **Multicast Settings**: 
  - Group: `224.1.1.1`
  - Port: `5007`
  - Interval: 2 seconds

### Customizable Settings

Edit these files to customize behavior:

**`src/main.py`**:
```python
APP_SERVE_PORT = 8080  # Web dashboard port
```

**`src/server_data_multicast.py`**:
```python
MULTICAST_GROUP = '224.1.1.1'  # Multicast group
MULTICAST_PORT = 5007           # Multicast port  
BROADCAST_INTERVAL = 2          # Broadcast interval (seconds)
```

**`src/device_manager.py`**:
```python
ttl_check_interval=2  # TTL check frequency (seconds)
```

### Environment Variables

Set these environment variables for custom configuration:

```bash
export MQTT_HOST="192.168.1.100"    # Override auto-detected IP
export MQTT_PORT="1883"             # Override dynamic port
export WS_PORT="8765"               # Override WebSocket port
export WEB_PORT="8080"              # Override web server port
```

## 🧪 Testing

### Using the MQTT Test Sender

The included test sender (`examples/mqtt_test_sender.py`) provides comprehensive testing:

#### Test Device Types:
1. **Moisture Sensor** (10-80%, warn: 70, evac: 85)
2. **Strain Sensor** (-500-2000 µε, warn: 1500, evac: 1800)  
3. **Vibration Sensor** (0-10g, warn: 5.0, evac: 8.0)
4. **Temperature Sensor** (-10-50°C, warn: 35, evac: 45)
5. **Humidity Sensor** (20-95%, warn: 80, evac: 90)

#### Running Tests:

**Automatic Test Sequence**:
```bash
cd examples
python3 mqtt_test_sender.py
# Runs: device registration → sensor data → continuous stream → cleanup
```

**Interactive Testing**:
```bash
python3 mqtt_test_sender.py --interactive
# Provides menu-driven testing interface
```

**Threshold Breach Testing**:
```bash
# In interactive mode, select option 7
# Generates warning and critical level sensor data
```

#### Manual MQTT Testing:

**Device Registration**:
```bash
mosquitto_pub -h localhost -p 1883 -t "network/hello" -m '{
  "device_id": "test_sensor_001",
  "name": "Test Sensor",
  "type": "moisture_sensor", 
  "unit": "%",
  "thresholds": {"warn": 70, "evac": 85},
  "capabilities": ["sensing"],
  "battery_level": 95,
  "signal_strength": -40,
  "version": "1.0.0",
  "TTL": 60,
  "timestamp": 1704067200
}'
```

**Sensor Data**:
```bash
mosquitto_pub -h localhost -p 1883 -t "sensors/moisture" -m '{
  "device_id": "test_sensor_001",
  "type": "moisture_sensor",
  "value": 75.0,
  "unit": "%", 
  "timestamp": 1704067200
}'
```

**Monitor Alerts**:
```bash
mosquitto_sub -h localhost -p 1883 -t "actuators/#"
```

### WebSocket Testing

Test WebSocket functionality using a browser console or WebSocket client:

```javascript
// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:8765');

// Set threshold
ws.send(JSON.stringify({
  type: "set_threshold",
  data: {
    device_id: "test_sensor_001",
    warn: 80.0,
    evac: 95.0
  }
}));

// Publish MQTT message
ws.send(JSON.stringify({
  type: "publish", 
  data: {
    topic: "sensors/moisture",
    payload: '{"device_id":"test_001","type":"moisture_sensor","value":85.0,"unit":"%","timestamp":1704067200}'
  }
}));
```

## 🔍 Troubleshooting

### Common Issues

#### 1. MQTT Broker Connection Failed
**Symptoms**: `Connection failed: [Errno 111] Connection refused`

**Solutions**:
- Verify mosquitto is installed: `mosquitto -h`
- Check if port is available: `netstat -ln | grep :1883`
- Try manual broker start: `mosquitto -p 1883 -v`

#### 2. No Devices Appearing
**Symptoms**: Test sender shows connected but no devices in dashboard

**Solutions**:
- Check MQTT topic subscriptions in logs
- Verify JSON format in `network/hello` messages
- Ensure device TTL hasn't expired
- Check device manager logs for errors

#### 3. Thresholds Not Working
**Symptoms**: Sensor data received but no alerts generated

**Solutions**:
- Verify device is registered with thresholds
- Check sensor type matches monitored types
- Ensure sensor values exceed threshold levels
- Monitor `actuators/#` topics for alert messages

#### 4. WebSocket Connection Issues
**Symptoms**: Dashboard not updating in real-time

**Solutions**:
- Check browser console for WebSocket errors
- Verify WebSocket server port (default 8765)
- Test WebSocket connection manually
- Check firewall settings

### Debugging Commands

**Check System Status**:
```bash
# View all processes
ps aux | grep python
ps aux | grep mosquitto

# Check network ports
netstat -tlnp | grep :1883  # MQTT
netstat -tlnp | grep :8765  # WebSocket
netstat -tlnp | grep :8080  # Web server

# Monitor MQTT traffic
mosquitto_sub -h localhost -p 1883 -t "#" -v
```

**Log Analysis**:
```bash
# Start with verbose output
cd src
python3 main.py 2>&1 | tee system.log

# Monitor specific component
python3 -c "
from device_manager import DeviceManager
dm = DeviceManager()
dm.start()
# Check device manager behavior
"
```

### Performance Monitoring

**System Resources**:
```bash
# Monitor CPU and memory usage
top -p $(pgrep -f "python.*main.py")

# Monitor network connections
ss -tuln | grep -E "(8080|8765|1883)"

# Check disk usage for logs
du -sh logs/ __pycache__/ 
```

**MQTT Performance**:
```bash
# Message rate monitoring
mosquitto_sub -h localhost -p 1883 -t "#" | while read line; do
  echo "$(date): $line"
done | pv -l > /dev/null
```

---