from server_data_multicast import ServerDataMulticaster
from websocket_server import WebSocketServer
import threading
import paho.mqtt.client as mqtt
from paho.mqtt.client import CallbackAPIVersion
import subprocess
import time
import sys
import socket
import json
from utils import get_local_ip, find_free_port
from control_logic import ControlLogic
from device_manager import DeviceManager

def ws_send(client, msg_type, data):
    """Send a standardized message to websocket client."""
    message = json.dumps({"type": msg_type, "data": data})
    if client is None:
        ws_server.broadcast(message)
    else:
        ws_server.send(client, message)

def ws_echo(client, message):
    ws_send(client, "echo", message)

def ws_publish(client, message):
    """
    Expects message: {"topic": "...", "payload": "..."}
    """
    try:
        # message is already a dict
        topic = message["topic"]
        payload = message["payload"]
        control_logic.publish_mqtt(topic, payload)
        ws_send(client, "publish", {"topic": topic, "payload": payload, "status": "ok"})
    except Exception as e:
        ws_send(client, "publish", {"error": str(e), "status": "error"})

def ws_set_threshold(client, message):
    """
    Expects message: {"device_id": "...", "warn": ..., "evac": ...}
    """
    try:
        # message is already a dict
        device_id = message["device_id"]
        warn = float(message["warn"])
        evac = float(message["evac"])
        success = control_logic.update_threshold(device_id, warn=warn, evac=evac)
        if not success:
            ws_send(client, "set_threshold", {"error": f"Device {device_id} not found", "status": "error"})
        else:
            ws_send(client, "set_threshold", {"device_id": device_id, "warn": warn, "evac": evac, "status": "ok"})
    except Exception as e:
        ws_send(client, "set_threshold", {"error": str(e), "status": "error"})

ws_callbacks = {
    "echo": ws_echo,
    "publish": ws_publish,
    "set_threshold": ws_set_threshold,
    # Add more command handlers here as needed
}

def ttl_expire_handler(device_id):
    print(f"Handling TTL expiry for device: {device_id}")
    # Remove thresholds associated with the expired device
    control_logic.remove_threshold(device_id)
    # Notify all websocket clients about the device removal
    ws_send(None, "device_removed", {"device_id": device_id})

def on_mqtt_message(client, userdata, msg):
    # print(f"MQTT message received: topic={msg.topic}, payload={msg.payload.decode()}")
    ws_send(None, "mqtt", {"topic": msg.topic, "payload": msg.payload.decode()})

    # Forward to device manager if topic matches
    if any(msg.topic.startswith(topic) for topic in device_manager.topics):
        device_manager.handle_mqtt_message(msg.topic, msg.payload.decode())

    # Forward to control logic if topic matches any in control_logic.topics
    if any(msg.topic.startswith(topic) for topic in control_logic.topics):
        control_logic.handle_mqtt_message(msg.topic, msg.payload.decode())

def on_ws_message(client, message):
    print(f"Received from websocket client: {message}")
    try:
        data = json.loads(message)
        command = data.get("type")
        payload = data.get("data", {})
    except Exception:
        ws_send(client, "error", "Invalid JSON format")
        return
    handler = ws_callbacks.get(command)
    if handler:
        handler(client, payload)
    else:
        print(f"Unknown command: {command}")
        ws_send(client, "error", f"Unknown command: {command}")

if __name__ == "__main__":
    print("Starting main program...")

    MQTT_SERVER_IP = get_local_ip()
    print(f"Device IP address: {MQTT_SERVER_IP}")
    MQTT_SERVER_PORT = find_free_port()
    print(f"Starting Mosquitto on port {MQTT_SERVER_PORT}")
    APP_SERVE_PORT = 8080  # This should match the port passed to serve.py

    mosquitto_proc = subprocess.Popen(
        ["/usr/sbin/mosquitto", "-p", str(MQTT_SERVER_PORT)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(1)
    
    # Start serve.py with explicit host and port
    serve_proc = subprocess.Popen(
        [sys.executable, "serve.py", "--host", MQTT_SERVER_IP, "--port", str(APP_SERVE_PORT)],
        cwd="./frontend",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    print("Started serve.py subprocess.")

    # Use explicit protocol version to avoid DeprecationWarning
    mqtt_client = mqtt.Client()
    # Instantiate control_logic before subscribing, pass device_manager
    device_manager = DeviceManager()
    device_manager.ttl_expire_callback = ttl_expire_handler
    device_manager.start()

    control_logic = ControlLogic(mqtt_client=mqtt_client, device_manager=device_manager)

    mqtt_client.on_message = on_mqtt_message
    print(f"Connecting MQTT client to {MQTT_SERVER_IP}:{MQTT_SERVER_PORT}...")
    mqtt_client.connect("0.0.0.0", MQTT_SERVER_PORT, 60)
    mqtt_client.subscribe("#")
    # Subscribe to all topics in control_logic.topics
    for topic in control_logic.topics:
        mqtt_client.subscribe(f"{topic}/#")
    # Subscribe to all topics in device_manager.topics
    for topic in device_manager.topics:
        mqtt_client.subscribe(topic)
    mqtt_thread = threading.Thread(target=mqtt_client.loop_forever, daemon=True, name="MQTT-Client")
    mqtt_thread.start()
    print("MQTT client thread started.")

    multicaster = ServerDataMulticaster(mqtt_ip=MQTT_SERVER_IP, mqtt_port=MQTT_SERVER_PORT)
    thread = threading.Thread(target=multicaster.run, daemon=True, name="UDP-Multicaster")
    thread.start()
    print("UDP multicaster thread started.")

    ws_server = WebSocketServer()
    ws_server.on_message = on_ws_message
    print("WebSocket server handler set.")

    ws_thread = threading.Thread(target=ws_server.run, daemon=True, name="WebSocket-Server")
    ws_thread.start()
    print("WebSocket server thread started.")

    # Print table of IPs at the end of startup
    ws_port = ws_server.port if hasattr(ws_server, 'port') else 'unknown'
    print("\n+---------------------+--------------------------+")
    print("| Service             | Address                  |")
    print("+---------------------+--------------------------+")
    print(f"| Device Local IP     | {MQTT_SERVER_IP:<25}|")
    print(f"| MQTT Broker         | {(MQTT_SERVER_IP + ':' + str(MQTT_SERVER_PORT)):<25}|")
    print(f"| WebSocket Server    | {(MQTT_SERVER_IP + ':' + str(ws_port)):<25}|")
    # Make Frontend Server clickable (if terminal supports it)
    frontend_url = f"http://{MQTT_SERVER_IP}:{APP_SERVE_PORT}"
    clickable = f"\033]8;;{frontend_url}\033\\{frontend_url}\033]8;;\033\\"
    print(f"| Frontend Server     | {clickable:<25}|")
    print("+---------------------+--------------------------+\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down...")
        mosquitto_proc.terminate()
        mosquitto_proc.wait()
        print("Mosquitto broker terminated.")
        serve_proc.terminate()
        serve_proc.wait()
        print("serve.py subprocess terminated.")
        sys.exit(0)