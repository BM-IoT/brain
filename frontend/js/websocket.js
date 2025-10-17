class WebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectInterval = 5000;
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.listeners = {};
        this.connect();
    }

    connect() {
        if (this.isConnecting) return;
        
        this.isConnecting = true;
        const wsUrl = `ws://${window.location.hostname}:8765`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            this.setupEventListeners();
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.handleDisconnection();
        }
    }

    setupEventListeners() {
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('connected');
            this.emit('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.handleDisconnection();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.handleDisconnection();
        };
    }

    handleMessage(data) {
        const { type, data: payload } = data;
        
        switch (type) {
            case 'mqtt':
                this.emit('mqtt', payload);
                break;
            case 'set_threshold':
                this.emit('threshold_response', payload);
                break;
            case 'device_removed':
                this.emit('device_removed', payload);
                break;
            case 'echo':
                this.emit('echo', payload);
                break;
            case 'error':
                this.emit('error', payload);
                break;
            default:
                console.log('Unknown message type:', type, payload);
        }
    }

    handleDisconnection() {
        this.isConnecting = false;
        this.updateConnectionStatus('disconnected');
        this.emit('disconnected');
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.updateConnectionStatus('connecting');
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectInterval);
        } else {
            console.error('Max reconnection attempts reached');
            this.updateConnectionStatus('failed');
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.className = `connection-status ${status}`;
        
        switch (status) {
            case 'connected':
                statusElement.textContent = 'Connected';
                break;
            case 'connecting':
                statusElement.textContent = 'Connecting...';
                break;
            case 'disconnected':
                statusElement.textContent = 'Disconnected';
                break;
            case 'failed':
                statusElement.textContent = 'Connection Failed';
                break;
        }
    }

    send(type, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ type, data });
            this.ws.send(message);
            return true;
        } else {
            console.error('WebSocket is not open');
            return false;
        }
    }

    setThreshold(deviceId, warn, evac) {
        return this.send('set_threshold', {
            device_id: deviceId,
            warn: parseFloat(warn),
            evac: parseFloat(evac)
        });
    }

    publishMqtt(topic, payload) {
        return this.send('publish', {
            topic: topic,
            payload: payload
        });
    }

    // Event system
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (this.listeners[event]) {
            const index = this.listeners[event].indexOf(callback);
            if (index > -1) {
                this.listeners[event].splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in event listener:', error);
                }
            });
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Global WebSocket instance
window.wsManager = new WebSocketManager();