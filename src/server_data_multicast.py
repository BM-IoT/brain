"""
This module provides functionality to multicast MQTT server data (IP and port)
over UDP multicast, so that clients on the local network can discover the MQTT broker.

The multicast message format is: "<ip>:<port>", e.g., "192.168.1.10:1883"
"""

import socket
import time

MULTICAST_GROUP = '224.1.1.1'
MULTICAST_PORT = 5007
BROADCAST_INTERVAL = 2  # seconds

class ServerDataMulticaster:
    """
    Periodically multicasts the MQTT server's IP and port to a multicast group.
    """

    def __init__(self, mqtt_ip, mqtt_port):
        self.mqtt_ip = mqtt_ip
        self.mqtt_port = mqtt_port

    def run(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
        message = f"{self.mqtt_ip}:{self.mqtt_port}".encode('utf-8')
        while True:
            try:
                sock.sendto(message, (MULTICAST_GROUP, MULTICAST_PORT))
            except Exception:
                pass
            time.sleep(BROADCAST_INTERVAL)

    @staticmethod
    def decode_message(message_bytes):
        """
        Decode a multicast message of the form b'<ip>:<port>' into (ip, port).
        Example:
            msg = b'192.168.1.10:1883'
            ip, port = ServerDataMulticaster.decode_message(msg)
        """
        try:
            decoded = message_bytes.decode('utf-8')
            ip, port = decoded.split(':')
            return ip, int(port)
        except Exception:
            return None, None