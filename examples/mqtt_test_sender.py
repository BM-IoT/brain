#!/usr/bin/env python3
"""
MQTT Test Data Sender for IoT Brain System

This script sends test MQTT messages to simulate various IoT devices and sensors.
It covers all the main topics and message types the brain expects:
- Device registration (network/hello)
- Device removal (network/byebye) 
- Device keepalive (network/alive)
- Sensor data (sensors/*)

Usage:
    python3 mqtt_test_sender.py [broker_ip] [broker_port]
    
If no broker_ip/port provided, it will try to discover via UDP multicast.
"""

import paho.mqtt.client as mqtt
import json
import time
import random
import sys
import socket
import threading
from datetime import datetime

def get_local_ip():
    """Get the local IP address of the current machine."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# Default MQTT settings
DEFAULT_BROKER_IP = "localhost"
DEFAULT_BROKER_PORT = 1883

# Multicast settings for broker discovery
MULTICAST_GROUP = '224.1.1.1'
MULTICAST_PORT = 5007

class MQTTTestSender:
    def __init__(self, broker_ip=None, broker_port=None):
        self.broker_ip = broker_ip or DEFAULT_BROKER_IP
        self.broker_port = broker_port or DEFAULT_BROKER_PORT
        
        # Try to discover broker if not provided
        if not broker_ip:
            discovered = self.discover_broker()
            if discovered:
                ip, port = discovered
                # If discovered IP is the same as local IP, use localhost
                local_ip = get_local_ip()
                if ip == local_ip:
                    ip = "localhost"
                self.broker_ip, self.broker_port = ip, port
                print(f"Discovered MQTT broker at {self.broker_ip}:{self.broker_port}")
        
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_publish = self.on_publish
        self.running = False
        
        # Test device configurations
        self.devices = [
            {
                "device_id": "moisture_sensor_001",
                "name": "Garden Moisture Sensor",
                "type": "moisture_sensor",
                "unit": "%",
                "min_value": 10,
                "max_value": 80,
                "base_value": 45,
                "thresholds": {"warn": 70, "evac": 85},
                "capabilities": ["moisture_sensing", "wireless"],
                "battery_level": 85,
                "signal_strength": -45,
                "version": "1.2.3",
                "TTL": 30
            },
            {
                "device_id": "strain_sensor_002", 
                "name": "Bridge Strain Sensor",
                "type": "strain_sensor",
                "unit": "µε",
                "min_value": -500,
                "max_value": 2000,
                "base_value": 150,
                "thresholds": {"warn": 1500, "evac": 1800},
                "capabilities": ["strain_sensing", "high_precision"],
                "battery_level": 92,
                "signal_strength": -38,
                "version": "2.1.0",
                "TTL": 25
            },
            {
                "device_id": "vibration_sensor_003",
                "name": "Machine Vibration Monitor", 
                "type": "vibration_sensor",
                "unit": "g",
                "min_value": 0,
                "max_value": 10,
                "base_value": 0.5,
                "thresholds": {"warn": 5.0, "evac": 8.0},
                "capabilities": ["vibration_sensing", "accelerometer"],
                "battery_level": 78,
                "signal_strength": -52,
                "version": "1.0.8",
                "TTL": 20
            },
            {
                "device_id": "temp_sensor_004",
                "name": "Temperature Monitor",
                "type": "temperature_sensor", 
                "unit": "°C",
                "min_value": -10,
                "max_value": 50,
                "base_value": 22,
                "thresholds": {"warn": 35, "evac": 45},
                "capabilities": ["temperature_sensing"],
                "battery_level": 67,
                "signal_strength": -41,
                "version": "1.5.2",
                "TTL": 35
            },
            {
                "device_id": "humidity_sensor_005",
                "name": "Humidity Sensor",
                "type": "humidity_sensor",
                "unit": "%",
                "min_value": 20,
                "max_value": 95,
                "base_value": 60,
                "thresholds": {"warn": 80, "evac": 90},
                "capabilities": ["humidity_sensing"],
                "battery_level": 88,
                "signal_strength": -35,
                "version": "1.3.1",
                "TTL": 40
            }
        ]
        
    def discover_broker(self, timeout=5):
        """Try to discover MQTT broker via UDP multicast"""
        print("Attempting to discover MQTT broker via multicast...")
        
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(timeout)
            sock.bind(('', MULTICAST_PORT))
            
            # Join multicast group
            mreq = socket.inet_aton(MULTICAST_GROUP) + socket.inet_aton('0.0.0.0')
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
            
            start_time = time.time()
            while time.time() - start_time < timeout:
                try:
                    data, addr = sock.recvfrom(1024)
                    message = data.decode('utf-8')
                    if ':' in message:
                        ip, port = message.split(':')
                        sock.close()
                        return ip, int(port)
                except socket.timeout:
                    continue
                    
            sock.close()
            
        except Exception as e:
            print(f"Broker discovery failed: {e}")
            
        return None
    
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"Connected to MQTT broker at {self.broker_ip}:{self.broker_port}")
        else:
            print(f"Failed to connect to MQTT broker, return code {rc}")
    
    def on_publish(self, client, userdata, mid):
        pass  # Could add debug logging here
    
    def connect(self):
        """Connect to MQTT broker"""
        try:
            print(f"Connecting to MQTT broker at {self.broker_ip}:{self.broker_port}...")
            self.client.connect(self.broker_ip, self.broker_port, 60)
            self.client.loop_start()
            time.sleep(1)  # Give connection time to establish
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from MQTT broker"""
        self.running = False
        self.client.loop_stop()
        self.client.disconnect()
    
    def send_device_hello(self, device):
        """Send device registration message"""
        payload = {
            "device_id": device["device_id"],
            "name": device["name"],
            "type": device["type"],
            "unit": device["unit"],
            "thresholds": device["thresholds"], 
            "capabilities": device["capabilities"],
            "battery_level": device["battery_level"],
            "signal_strength": device["signal_strength"],
            "ip": "192.168.1.100",  # Simulated IP
            "mac": "00:11:22:33:44:55",  # Simulated MAC
            "version": device["version"],
            "TTL": device["TTL"],
            "timestamp": int(time.time())
        }
        
        topic = "network/hello"
        self.client.publish(topic, json.dumps(payload))
        print(f"📡 Registered device: {device['name']} ({device['device_id']})")
    
    def send_device_byebye(self, device):
        """Send device removal message"""
        payload = {
            "device_id": device["device_id"],
            "timestamp": int(time.time())
        }
        
        topic = "network/byebye"
        self.client.publish(topic, json.dumps(payload))
        print(f"👋 Removed device: {device['name']} ({device['device_id']})")
    
    def send_device_alive(self, device):
        """Send device keepalive message"""
        payload = {
            "device_id": device["device_id"],
            "timestamp": int(time.time())
        }
        
        topic = "network/alive"
        self.client.publish(topic, json.dumps(payload))
        print(f"💓 Keepalive: {device['device_id']}")
    
    def send_sensor_data(self, device):
        """Send simulated sensor data"""
        # Generate realistic sensor value with some randomness
        base = device["base_value"]
        variation = (device["max_value"] - device["min_value"]) * 0.1
        value = base + random.uniform(-variation, variation)
        
        # Occasionally generate threshold-exceeding values for testing alarms
        if random.random() < 0.05:  # 5% chance
            if random.random() < 0.5:
                value = device["thresholds"]["warn"] + random.uniform(0, 5)
            else:
                value = device["thresholds"]["evac"] + random.uniform(0, 10)
        
        # Clamp to min/max
        value = max(device["min_value"], min(device["max_value"], value))
        
        payload = {
            "device_id": device["device_id"],
            "type": device["type"],
            "value": round(value, 2),
            "unit": device["unit"],
            "timestamp": int(time.time())
        }
        
        # Use specific sensor topic
        topic = f"sensors/{device['type']}"
        self.client.publish(topic, json.dumps(payload))
        
        # Color code based on thresholds
        if value >= device["thresholds"]["evac"]:
            status = "🔴 CRITICAL"
        elif value >= device["thresholds"]["warn"]:
            status = "🟡 WARNING"
        else:
            status = "🟢 NORMAL"
            
        print(f"📊 {device['device_id']}: {value:.2f}{device['unit']} {status}")
    
    def register_all_devices(self):
        """Register all test devices"""
        print("\n=== Registering Test Devices ===")
        for device in self.devices:
            self.send_device_hello(device)
            time.sleep(0.5)  # Small delay between registrations
    
    def remove_all_devices(self):
        """Remove all test devices"""
        print("\n=== Removing Test Devices ===")
        for device in self.devices:
            self.send_device_byebye(device)
            time.sleep(0.2)
    
    def start_continuous_data(self, interval=2):
        """Start sending continuous sensor data"""
        print(f"\n=== Starting Continuous Data Stream (every {interval}s) ===")
        print("Press Ctrl+C to stop")
        
        self.running = True
        keepalive_counter = 0
        
        try:
            while self.running:
                # Send sensor data for all devices
                for device in self.devices:
                    if self.running:
                        self.send_sensor_data(device)
                        time.sleep(0.1)  # Small delay between devices
                
                # Send keepalive messages every 10 iterations (20 seconds with interval=2)
                keepalive_counter += 1
                if keepalive_counter >= 10:
                    print("\n--- Sending keepalive messages ---")
                    for device in self.devices:
                        if self.running:
                            self.send_device_alive(device)
                            time.sleep(0.1)
                    keepalive_counter = 0
                
                if self.running:
                    time.sleep(interval)
                    
        except KeyboardInterrupt:
            print("\n\n⏹️  Stopping data stream...")
            self.running = False
    
    def run_test_sequence(self):
        """Run a complete test sequence"""
        print("🚀 Starting MQTT Test Sender")
        print(f"Target broker: {self.broker_ip}:{self.broker_port}")
        
        if not self.connect():
            return
        
        try:
            # Register devices
            self.register_all_devices()
            time.sleep(2)
            
            # Send some initial sensor data
            print("\n=== Sending Initial Sensor Data ===")
            for _ in range(3):
                for device in self.devices:
                    self.send_sensor_data(device)
                    time.sleep(0.1)
                time.sleep(1)
            
            # Start continuous data stream
            self.start_continuous_data(interval=3)
            
        except KeyboardInterrupt:
            print("\n\n🛑 Test interrupted by user")
        finally:
            self.remove_all_devices()
            time.sleep(1)
            self.disconnect()
            print("✅ Test completed")
    
    def run_interactive_mode(self):
        """Run in interactive mode with menu"""
        if not self.connect():
            return
        
        while True:
            print("\n" + "="*50)
            print("🎮 MQTT Test Sender - Interactive Mode")
            print("="*50)
            print("1. Register all devices")
            print("2. Send sensor data (single round)")
            print("3. Start continuous data stream")
            print("4. Send keepalive messages")
            print("5. Remove all devices")
            print("6. Show device list")
            print("7. Test threshold breach")
            print("0. Exit")
            
            try:
                choice = input("\nSelect option: ").strip()
                
                if choice == "0":
                    break
                elif choice == "1":
                    self.register_all_devices()
                elif choice == "2":
                    print("\n=== Sending Sensor Data ===")
                    for device in self.devices:
                        self.send_sensor_data(device)
                        time.sleep(0.1)
                elif choice == "3":
                    interval = input("Enter interval in seconds (default 2): ").strip()
                    interval = float(interval) if interval else 2
                    self.start_continuous_data(interval)
                elif choice == "4":
                    print("\n=== Sending Keepalive Messages ===")
                    for device in self.devices:
                        self.send_device_alive(device)
                        time.sleep(0.1)
                elif choice == "5":
                    self.remove_all_devices()
                elif choice == "6":
                    self.show_device_list()
                elif choice == "7":
                    self.test_threshold_breach()
                else:
                    print("❌ Invalid option")
                    
            except KeyboardInterrupt:
                print("\n\n🛑 Interrupted by user")
                break
            except Exception as e:
                print(f"❌ Error: {e}")
        
        self.disconnect()
        print("✅ Disconnected")
    
    def show_device_list(self):
        """Show list of test devices"""
        print("\n=== Test Device List ===")
        for i, device in enumerate(self.devices, 1):
            print(f"{i}. {device['name']} ({device['device_id']})")
            print(f"   Type: {device['type']}")
            print(f"   Range: {device['min_value']}-{device['max_value']} {device['unit']}")
            print(f"   Thresholds: warn={device['thresholds']['warn']}, evac={device['thresholds']['evac']}")
            print()
    
    def test_threshold_breach(self):
        """Send data that will trigger threshold breaches"""
        print("\n=== Testing Threshold Breaches ===")
        
        for device in self.devices:
            # Send warning level value
            warn_value = device["thresholds"]["warn"] + 1
            payload = {
                "device_id": device["device_id"],
                "type": device["type"],
                "value": warn_value,
                "unit": device["unit"],
                "timestamp": int(time.time())
            }
            topic = f"sensors/{device['type']}"
            self.client.publish(topic, json.dumps(payload))
            print(f"🟡 WARNING breach: {device['device_id']} = {warn_value}{device['unit']}")
            time.sleep(1)
            
            # Send critical level value  
            evac_value = device["thresholds"]["evac"] + 1
            payload["value"] = evac_value
            payload["timestamp"] = int(time.time())
            self.client.publish(topic, json.dumps(payload))
            print(f"🔴 CRITICAL breach: {device['device_id']} = {evac_value}{device['unit']}")
            time.sleep(1)


def main():
    broker_ip = None
    broker_port = None
    
    # Parse command line arguments
    if len(sys.argv) >= 2:
        broker_ip = sys.argv[1]
    if len(sys.argv) >= 3:
        broker_port = int(sys.argv[2])
    
    sender = MQTTTestSender(broker_ip, broker_port)
    
    # Check if we want interactive mode
    if len(sys.argv) > 1 and sys.argv[-1] == "--interactive":
        sender.run_interactive_mode()
    else:
        sender.run_test_sequence()


if __name__ == "__main__":
    main()