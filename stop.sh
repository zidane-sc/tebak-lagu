#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$DIR/app.pid"

fuser -k 3000/tcp 2>/dev/null
pkill -f "next-server.*3000" 2>/dev/null

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    kill -9 "$PID" 2>/dev/null
    rm -f "$PID_FILE"
fi

echo "Stopped Tebak Lagu port 3000 cleanly."
