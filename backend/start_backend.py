import subprocess
import sys
import os
import time
import socket

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def start_service(name, path, port):
    print(f"[STARTING] {name} on port {port}...")
    if is_port_in_use(port):
        print(f"[WARNING] Port {port} is already in use. {name} might fail to start or is already running.")
    
    # Use the same python interpreter as this script
    process = subprocess.Popen(
        [sys.executable, path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True
    )
    return process

import threading

def stream_output(proc, name):
    try:
        for line in iter(proc.stdout.readline, ''):
            if line:
                print(f"[{name}] {line.strip()}", flush=True)
            else:
                break
    except Exception:
        pass

def main():
    # Root directory of the project
    base_dir = os.path.dirname(os.path.abspath(__file__))
    api_path = os.path.join(base_dir, "API", "api.py")
    gemini_path = os.path.join(base_dir, "API", "gemini.py")

    # Check for .env file
    env_path = os.path.join(os.path.dirname(base_dir), ".env")
    if not os.path.exists(env_path):
        print(f"[ERROR] .env file not found at {env_path}")
        return

    print("--- ClimateGuard Backend Controller ---")
    
    # Start API Service (Port 5000)
    api_proc = start_service("Climate API", api_path, 5000)
    
    # Give it a second to initialize
    time.sleep(2)
    
    # Start AI Aggregator (Port 5010)
    gemini_proc = start_service("AI Aggregator (Gemini / Groq)", gemini_path, 5010)

    # Start non-blocking log streamers
    t1 = threading.Thread(target=stream_output, args=(api_proc, "API"), daemon=True)
    t2 = threading.Thread(target=stream_output, args=(gemini_proc, "AI"), daemon=True)
    t1.start()
    t2.start()

    print("\n[SUCCESS] Both services are running. Press Ctrl+C to stop both.\n")

    try:
        while True:
            # Check if processes are still running
            if api_proc.poll() is not None:
                print("[ERROR] Climate API stopped unexpectedly.")
                break
            if gemini_proc.poll() is not None:
                print("[ERROR] AI Aggregator stopped unexpectedly.")
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[STOPPING] Stopping services...")
        api_proc.terminate()
        gemini_proc.terminate()
        print("[DONE] Bye.")

if __name__ == "__main__":
    main()
