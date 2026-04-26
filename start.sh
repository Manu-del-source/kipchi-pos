#!/bin/bash

# Find local IP address
LOCAL_IP=$(ifconfig wlan0 | grep 'inet ' | awk '{print $2}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ifconfig eth0 | grep 'inet ' | awk '{print $2}')
fi

echo "🚀 Starting POS Web System..."

# Start Backend
echo "Starting FastAPI Backend on http://$LOCAL_IP:5000 ..."
python3 backend/api.py &
BACKEND_PID=$!

# Start Frontend
echo "Starting React Frontend on http://$LOCAL_IP:5173 ..."
cd frontend && npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT

echo "✅ System is running!"
echo "------------------------------------------------"
echo "Access from this device: http://localhost:5173"
echo "Access from other devices: http://$LOCAL_IP:5173"
echo "------------------------------------------------"

wait
