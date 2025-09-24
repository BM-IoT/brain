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
    echo "  --interactive             Run in interactive mode"
    echo "  --auto                    Run automatic test sequence (default)"
    echo "  --broker IP [PORT]        Specify MQTT broker (default: auto-discover)"
    echo "  --continuous [INTERVAL]   Start continuous data stream immediately"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Auto-discover broker and run test sequence"
    echo "  $0 --interactive                     # Interactive mode with menu"
    echo "  $0 --broker 192.168.1.100 1883      # Use specific broker"
    echo "  $0 --continuous 5                    # Continuous data every 5 seconds"
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
        --interactive|-i)
            INTERACTIVE=true
            shift
            ;;
        --auto|-a)
            INTERACTIVE=false
            shift
            ;;
        --broker|-b)
            BROKER_IP="$2"
            if [[ -n "$3" && ! "$3" =~ ^-- ]]; then
                BROKER_PORT="$3"
                shift
            fi
            shift 2
            ;;
        --continuous|-c)
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

if [[ -n "$BROKER_IP" ]]; then
    PYTHON_CMD="${PYTHON_CMD} ${BROKER_IP}"
    if [[ -n "$BROKER_PORT" ]]; then
        PYTHON_CMD="${PYTHON_CMD} ${BROKER_PORT}"
    fi
fi

if [[ "$INTERACTIVE" == "true" ]]; then
    PYTHON_CMD="${PYTHON_CMD} --interactive"
fi

echo "Command: ${PYTHON_CMD}"
echo ""

# Check if IoT Brain is running
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

# Special case for continuous mode
if [[ "$CONTINUOUS" == "true" && "$INTERACTIVE" == "false" ]]; then
    echo "🔄 Starting in continuous mode (${INTERVAL}s intervals)"
    echo "   This will register devices and start sending data immediately"
    echo "   Press Ctrl+C to stop"
    echo ""
    
    # Create a modified test sender call for continuous mode
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
else
    # Run normal command
    exec $PYTHON_CMD
fi