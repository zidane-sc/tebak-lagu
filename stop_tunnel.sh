#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$DIR/tunnel.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        echo "Stopped Tebak Lagu Tunnel (PID $PID)"
    fi
    rm -f "$PID_FILE"
else
    echo "No tunnel.pid found."
fi
