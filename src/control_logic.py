import time
import threading
import json

class ControlLogic:
    def __init__(self, mqtt_client=None, device_manager=None):
        self.mqtt_client = mqtt_client
        self.device_manager = device_manager
        # List of MQTT topic prefixes this logic cares about
        self.topics = ["sensors/moisture", "sensors/vibration", "sensors/strain", "network/hello", "network/byebye"]
        # List of sensor types to track thresholds for
        self.sensor_types = [
            "moisture_sensor",
            "strain_sensor",
            "vibration_sensor"
        ]
        self.thresholds = {}

    def handle_mqtt_message(self, topic, payload):
        # print(f"ControlLogic received MQTT: {topic} {payload}")
        try:
            if topic == "network/hello":
                self._handle_network_hello(payload)
            elif topic == "network/byebye":
                self._handle_network_byebye(payload)
            else:
                self._handle_sensor_message(topic, payload)
        except Exception as e:
            print(f"General error in handle_mqtt_message: {e}")

    def _handle_network_hello(self, payload):
        # print("Handling network/hello message")
        self._add_threshold_from_payload(payload)

    def _handle_network_byebye(self, payload):
        # print("Handling network/byebye message")
        self._remove_threshold_from_payload(payload)

    def _handle_sensor_message(self, topic, payload):
        try:
            data = json.loads(payload)
            device_id = data.get("device_id")
            dev_type = data.get("type")
            value = data.get("value")
            device_exists = False
            if self.device_manager:
                try:
                    devices = self.device_manager.get_devices()
                    device_exists = any(d.get("device_id") == device_id for d in devices)
                except Exception as e:
                    print(f"Error accessing device_manager: {e}")
      
            if dev_type and dev_type in self.sensor_types and device_id in self.thresholds and device_exists:
                self._check_thresholds_and_act(device_id, value)
            else:
                if not device_exists:
                    print(f"Device {device_id} not found in device manager.")
                if dev_type not in self.sensor_types:
                    print(f"Device type {dev_type} not tracked for thresholds.")
                if device_id not in self.thresholds:
                    print(f"No thresholds set for device {device_id}.")
        except json.JSONDecodeError as e:
            print(f"JSON decode error in _handle_sensor_message: {e}")
        except Exception as e:
            print(f"Unexpected error in _handle_sensor_message: {e}")

    def _check_thresholds_and_act(self, device_id, value):
        try:
            thresholds = self.thresholds[device_id]
            val = float(value)
            if val > thresholds["evac"]:
                self.publish_mqtt("actuators/evac", f"{device_id} {val}")
            elif val > thresholds["warn"]:
                self.publish_mqtt("actuators/warn", f"{device_id} {val}")
        except Exception as e:
            print(f"Error in threshold check or MQTT publish: {e}")

    def _add_threshold_from_payload(self, payload):
        try:
            data = json.loads(payload)
            device_id = data.get("device_id")
            dev_type = data.get("type")
            if dev_type and dev_type in self.sensor_types:
                if device_id not in self.thresholds:
                    thresholds = data.get("thresholds", {})
                    warn_threshold = thresholds.get("warn", float('inf'))
                    evac_threshold = thresholds.get("evac", float('inf'))
                    self.thresholds[device_id] = {"warn": warn_threshold, "evac": evac_threshold}
                    print(f"Thresholds initialized for {device_id}")
        except json.JSONDecodeError as e:
            print(f"JSON decode error in _add_threshold_from_payload: {e}")
        except Exception as e:
            print(f"Error handling network/hello in ControlLogic: {e}")

    def _remove_threshold_from_payload(self, payload):
        try:
            data = json.loads(payload)
            device_id = data.get("device_id")
            if device_id in self.thresholds:
                del self.thresholds[device_id]
                print(f"Thresholds removed for {device_id}")
        except json.JSONDecodeError as e:
            print(f"JSON decode error in _remove_threshold_from_payload: {e}")
        except Exception as e:
            print(f"Error handling network/byebye in ControlLogic: {e}")

    def publish_mqtt(self, topic, payload):
        try:
            if self.mqtt_client:
                self.mqtt_client.publish(topic, payload)
            else:
                print("MQTT client not set in ControlLogic.")
        except Exception as e:
            print(f"Error publishing MQTT message: {e}")

    def update_threshold(self, device_id, warn=None, evac=None):
        try:
            if device_id in self.thresholds:
                if warn is not None:
                    self.thresholds[device_id]["warn"] = warn
                if evac is not None:
                    self.thresholds[device_id]["evac"] = evac
                print(f"Thresholds updated for {device_id}: {self.thresholds[device_id]}")
                return True
            else:
                print(f"Device {device_id} not found in thresholds.")
                print(self.thresholds)
                return False
        except Exception as e:
            print(f"Error updating threshold for {device_id}: {e}")
            return False

    def remove_threshold(self, device_id):
        try:
            if device_id in self.thresholds:
                del self.thresholds[device_id]
                print(f"Thresholds removed for {device_id}")
                return True
            else:
                print(f"Device {device_id} not found in thresholds.")
                return False
        except Exception as e:
            print(f"Error removing threshold for {device_id}: {e}")
            return False