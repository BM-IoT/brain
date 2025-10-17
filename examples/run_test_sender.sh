#!/bin/bash

# MQTT Test Sender Launch Script
# This script makes it easy to run the MQTT test sender with different options

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_SENDER="${SCRIPT_DIR}/mqtt_test_sender.py"

echo "🚀 IoT Brain MQTT Test Sender"
echo "=============================="

# Check if paho-mqtt is installed
if ! python3 -c "import paho.mqtt.client" 2>/dev/null; then
    echo "❌ paho-mqtt not found. Installing..."
    pip3 install paho-mqtt
fi

# Function to show usage
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help                    Show this help message"
    echo "  --interval [INTERVAL]   Start continuous data stream immediately"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Auto-discover broker and run test sequence"
    echo "  $0 --interval 5                    # Continuous data every 5 seconds"
    echo ""
}

# Parse command line arguments
INTERACTIVE=false
BROKER_IP=""
BROKER_PORT=""
CONTINUOUS=false
INTERVAL=2

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_usage
            exit 0
            ;;
        --interval|-i)
            CONTINUOUS=true
            if [[ -n "$2" && ! "$2" =~ ^-- ]]; then
                INTERVAL="$2"
                shift
            fi
            shift
            ;;
        *)
            echo "❌ Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Build python command
PYTHON_CMD="python3 ${TEST_SENDER}"

echo "Command: ${PYTHON_CMD}"
echo ""

echo "🔍 Checking if IoT Brain is running..."
if pgrep -f "python.*main.py" > /dev/null; then
    echo "✅ IoT Brain appears to be running"
else
    echo "⚠️  IoT Brain doesn't appear to be running"
    echo "   Make sure to start the brain first: cd src && python3 main.py"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "🔄 Starting in continuous mode (${INTERVAL}s intervals)"
echo "   This will register devices and start sending data immediately"
echo "   Press Ctrl+C to stop"
echo ""
    
python3 -c "
import sys
sys.path.append('${SCRIPT_DIR}')
from mqtt_test_sender import MQTTTestSender

sender = MQTTTestSender('${BROKER_IP}' if '${BROKER_IP}' else None, 
                       int('${BROKER_PORT}') if '${BROKER_PORT}' else None)
if sender.connect():
    try:
        sender.register_all_devices()
        import time
        time.sleep(2)
        sender.start_continuous_data(${INTERVAL})
    except KeyboardInterrupt:
        print('\n\n🛑 Stopping...')
    finally:
        sender.remove_all_devices() 
        sender.disconnect()
        print('✅ Done')
"