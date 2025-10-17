#!/usr/bin/env python3
"""
Simple HTTP server to serve the IoT Brain Dashboard frontend.
Run this script to serve the frontend files on http://localhost:8080
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path
import argparse

def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="Serve the IoT Brain Dashboard frontend.")
    parser.add_argument("--host", default="localhost", help="Host to bind the server (default: localhost)")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind the server (default: 8080)")
    args = parser.parse_args()

    # Get the directory where this script is located
    script_dir = Path(__file__).parent.absolute()
    frontend_dir = script_dir
    
    # Change to the frontend directory
    os.chdir(frontend_dir)
    
    # Set up the server
    PORT = args.port
    HOST = args.host
    Handler = http.server.SimpleHTTPRequestHandler
    
    # Add CORS headers for WebSocket connections
    class CORSRequestHandler(Handler):
        def end_headers(self):
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            super().end_headers()
        
        def do_OPTIONS(self):
            self.send_response(200)
            self.end_headers()
    
    with socketserver.TCPServer((HOST, PORT), CORSRequestHandler) as httpd:
        print(f"IoT Brain Dashboard server running at http://{HOST}:{PORT}")
        print(f"Serving files from: {frontend_dir}")
        print("Press Ctrl+C to stop the server")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")

if __name__ == "__main__":
    main()