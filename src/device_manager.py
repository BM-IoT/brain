import threading
import time
import json

class DeviceManager:
    def __init__(self, ttl_check_interval=2):
        self.devices = {}  # device_id -> device_info dict
        self.lock = threading.Lock()
        self.ttl_check_interval = ttl_check_interval
        self.running = False
        self.thread = None
        self.topics = ["network/hello", "network/byebye", "network/alive"]
        self.ttl_expire_callback = None  # Optional callback on TTL expiry

    def handle_mqtt_message(self, topic, payload):
        if topic == "network/hello":
            self.handle_hello(payload)
        elif topic == "network/byebye":
            self.handle_byebye(payload)
        elif topic == "network/alive":
            self.handle_alive(payload)

    def handle_hello(self, payload):
        try:
            data = json.loads(payload)
            device_id = data["device_id"]
            with self.lock:
                data["_last_seen"] = time.time()
                self.devices[device_id] = data
            print(f"Device registered: {device_id} ({data.get('name')})")
        except Exception as e:
            print(f"Error handling hello: {e}")

    def handle_byebye(self, payload):
        try:
            data = json.loads(payload)
            device_id = data["device_id"]
            with self.lock:
                if device_id in self.devices:
                    del self.devices[device_id]
                    print(f"Device removed: {device_id}")
        except Exception as e:
            print(f"Error handling byebye: {e}")

    def handle_alive(self, payload):
        try:
            data = json.loads(payload)
            device_id = data["device_id"]
            with self.lock:
                if device_id in self.devices:
                    self.devices[device_id]["_last_seen"] = time.time()
                    print(f"Device alive: {device_id}")
        except Exception as e:
            print(f"Error handling alive: {e}")

    def get_devices(self):
        with self.lock:
            return list(self.devices.values())

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._ttl_checker, daemon=True)
            self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()

    def _ttl_checker(self):
        while self.running:
            now = time.time()
            with self.lock:
                to_remove = []
                for device_id, info in self.devices.items():
                    ttl = info.get("TTL", 10)
                    last_seen = info.get("_last_seen", now)
                    if now - last_seen > ttl:
                        to_remove.append(device_id)
                for device_id in to_remove:
                    print(f"Device TTL expired: {device_id}")
                    del self.devices[device_id]
                    if self.ttl_expire_callback:
                        self.ttl_expire_callback(device_id)
            time.sleep(self.ttl_check_interval)
