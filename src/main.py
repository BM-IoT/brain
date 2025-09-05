import paho.mqtt.client as mqtt


# define critical values
# sensor data should be normalized to 1-100
# <NOTE> this is an early build, values are subject to change
STRAIN_WARN = 80
VIBRATION_WARN = 50
MOISTURE_WARN = 70

STRAIN_ALARM = 90
VIBRATION_ALARM = 70
MOISTURE_ALARM = 80

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = float(msg.payload.decode())

    if topic == "sensor/moisture":
        if payload > MOISTURE_ALARM:
            client.publish("actuator/evac", "Moisture evac")
        elif payload > MOISTURE_WARN:
            client.publish("actuator/warn", "Moisture warn")
    
    if topic == "sensor/vibration":
        if payload > VIBRATION_ALARM:
            client.publish("actuator/evac", "Moisture evac")
        elif payload > VIBRATION_WARN:
            client.publish("actuator/warn", "Moisture warn")

    if topic == "sensor/strain":
        if payload > STRAIN_ALARM:
            client.publish("actuator/evac", "Strain evac")
        elif payload > STRAIN_WARN:
            client.publish("actuator/warn", "Strain warn")


    

client = mqtt.Client()
client.on_message = on_message

# <TODO> change arguments to required vaules 
client.connect("localhost", 1883, 60)
client.subscribe("sensors/moisture")
client.subscribe("sensors/vibration")
client.subscribe("sensors/strain")
client.subscribe("actuator/warn")
client.subscribe("actuator/evac")

client.loop_forever()