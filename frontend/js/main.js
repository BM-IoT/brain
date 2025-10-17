class Dashboard {
    constructor() {
        this.currentPage = 'sensors';
        this.initializeNavigation();
        this.initializeApp();
    }

    initializeNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetPage = e.target.dataset.page;
                this.navigateToPage(targetPage);
            });
        });
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.navigateToPage(e.state.page, false);
            }
        });
        
        // Set initial state
        history.replaceState({ page: this.currentPage }, '', `#${this.currentPage}`);
    }

    navigateToPage(pageName, updateHistory = true) {
        // Hide all pages
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));
        
        // Show target page
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageName;
            
            // Update navigation buttons
            const navButtons = document.querySelectorAll('.nav-btn');
            navButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.page === pageName) {
                    btn.classList.add('active');
                }
            });
            
            // Update browser history
            if (updateHistory) {
                history.pushState({ page: pageName }, '', `#${pageName}`);
            }
            
            // Page-specific initialization
            this.onPageChange(pageName);
        }
    }

    onPageChange(pageName) {
        switch (pageName) {
            case 'sensors':
                // Refresh sensor grid
                if (window.sensorManager) {
                    window.sensorManager.renderSensorGrid();
                    window.sensorManager.renderMqttTable();
                }
                break;
                
            case 'devices':
                // Refresh device list
                if (window.deviceManager) {
                    window.deviceManager.renderDeviceList();
                }
                break;
                
            case 'history':
                // Update all charts
                if (window.historyManager) {
                    window.historyManager.updateAllCharts();
                }
                break;
                
            case 'alarms':
                // Update alarm display
                if (window.alarmManager) {
                    window.alarmManager.updateAlarmDisplay();
                }
                break;
        }
    }

    initializeApp() {
        // Initialize keyboard shortcuts
        this.initializeKeyboardShortcuts();
        
        // Check for URL hash on load
        const hash = window.location.hash.substring(1);
        if (hash && ['sensors', 'devices', 'history', 'alarms'].includes(hash)) {
            this.navigateToPage(hash, false);
        }
        
        // Add global error handler
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
            this.showError('An unexpected error occurred. Please refresh the page.');
        });
        
        // Add connection status handlers
        if (window.wsManager) {
            window.wsManager.on('connected', () => {
                this.showSuccess('Connected to IoT Brain');
            });
            
            window.wsManager.on('disconnected', () => {
                this.showError('Connection lost. Attempting to reconnect...');
            });
            
            window.wsManager.on('error', (error) => {
                this.showError(`WebSocket error: ${error}`);
            });
        }
        
        // Initialize tooltips and other UI enhancements
        this.initializeUIEnhancements();
    }

    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            if (e.altKey) {
                switch (e.key) {
                    case '1':
                        e.preventDefault();
                        this.navigateToPage('sensors');
                        break;
                    case '2':
                        e.preventDefault();
                        this.navigateToPage('devices');
                        break;
                    case '3':
                        e.preventDefault();
                        this.navigateToPage('history');
                        break;
                    case '4':
                        e.preventDefault();
                        this.navigateToPage('alarms');
                        break;
                }
            }
            
            // ESC to close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    initializeUIEnhancements() {
        // Add loading states to buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('.btn:not(.nav-btn)')) {
                this.addLoadingState(e.target);
            }
        });
        
        // Add smooth scrolling to page changes
        document.addEventListener('page-change', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        // Add tooltips to status indicators
        this.addTooltips();
    }

    addTooltips() {
        // Simple tooltip implementation
        const elementsWithTooltips = document.querySelectorAll('[title]');
        
        elementsWithTooltips.forEach(element => {
            let tooltip;
            
            element.addEventListener('mouseenter', (e) => {
                const title = e.target.getAttribute('title');
                if (!title) return;
                
                // Create tooltip
                tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                tooltip.textContent = title;
                document.body.appendChild(tooltip);
                
                // Position tooltip
                const rect = e.target.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;
                
                // Remove title to prevent browser tooltip
                e.target.setAttribute('data-title', title);
                e.target.removeAttribute('title');
            });
            
            element.addEventListener('mouseleave', (e) => {
                if (tooltip) {
                    tooltip.remove();
                    tooltip = null;
                }
                
                // Restore title
                const title = e.target.getAttribute('data-title');
                if (title) {
                    e.target.setAttribute('title', title);
                    e.target.removeAttribute('data-title');
                }
            });
        });
    }

    addLoadingState(button) {
        const originalText = button.textContent;
        button.textContent = 'Loading...';
        button.disabled = true;
        
        // Remove loading state after 2 seconds (adjust as needed)
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // Utility methods for debugging and testing
    getSystemStatus() {
        return {
            currentPage: this.currentPage,
            websocketConnected: window.wsManager?.ws?.readyState === WebSocket.OPEN,
            sensorsCount: window.sensorManager?.sensors?.size || 0,
            devicesCount: window.deviceManager?.devices?.size || 0,
            alarmsCount: window.alarmManager?.alarms?.length || 0,
            chartCount: window.historyManager?.charts?.size || 0
        };
    }

    exportSystemData() {
        const data = {
            timestamp: new Date().toISOString(),
            sensors: window.sensorManager ? Array.from(window.sensorManager.sensors.entries()) : [],
            devices: window.deviceManager ? Array.from(window.deviceManager.devices.entries()) : [],
            alarms: window.alarmManager ? window.alarmManager.alarms : [],
            mqttTopics: window.sensorManager ? Array.from(window.sensorManager.mqttTopics.entries()) : []
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `iot_dashboard_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
    
    // Make dashboard methods available in console for debugging
    window.getSystemStatus = () => window.dashboard.getSystemStatus();
    window.exportSystemData = () => window.dashboard.exportSystemData();
    
    console.log('IoT Brain Dashboard initialized');
    console.log('Use getSystemStatus() to check system status');
    console.log('Use exportSystemData() to export all data');
});

// Add toast styles
const toastStyles = `
.toast {
    position: fixed;
    bottom: 20px;
    right: -300px;
    background-color: #333;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    transition: right 0.3s ease;
    max-width: 300px;
}

.toast.show {
    right: 20px;
}

.toast-success {
    background-color: #27ae60;
}

.toast-error {
    background-color: #e74c3c;
}

.toast-warning {
    background-color: #f39c12;
}

.tooltip {
    position: absolute;
    background-color: #333;
    color: white;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    z-index: 10000;
    pointer-events: none;
    transform: translateX(-50%);
    white-space: nowrap;
}

.tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid #333;
}

/* Responsive improvements */
@media (max-width: 768px) {
    .toast {
        right: -90%;
        left: 5%;
        max-width: 90%;
    }
    
    .toast.show {
        right: 5%;
    }
}

/* Loading states */
.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Smooth transitions */
.page {
    opacity: 0;
    transition: opacity 0.3s ease;
}

.page.active {
    opacity: 1;
}

/* Focus indicators for accessibility */
.nav-btn:focus,
.btn:focus {
    outline: 2px solid #3498db;
    outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    .sensor-box,
    .device-card,
    .chart-card {
        border: 2px solid #000;
    }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
    .toast,
    .notification,
    .page {
        transition: none;
    }
    
    .sensor-box:hover,
    .device-card:hover {
        transform: none;
    }
}
`;

// Inject toast styles
const toastStyleSheet = document.createElement('style');
toastStyleSheet.textContent = toastStyles;
document.head.appendChild(toastStyleSheet);