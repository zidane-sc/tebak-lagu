#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PID_FILE="$DIR/tunnel.pid"
LOG_FILE="$DIR/tunnel.log"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Tunnel already running (PID $PID)"
        grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$LOG_FILE" | tail -n 1
        exit 0
    fi
fi

rm -f "$LOG_FILE"
nohup nice -n 10 /data/workspace/dual-blast/cloudflared tunnel --url http://127.0.0.1:3000 </dev/null > "$LOG_FILE" 2>&1 &
PID=$!
disown $PID
echo "$PID" > "$PID_FILE"

for i in {1..20}; do
    URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$LOG_FILE" | head -n 1)
    if [ -n "$URL" ]; then
        echo "Tunnel ready: $URL"
        exit 0
    fi
    sleep 1
done

echo "Tunnel started with PID $PID, check $LOG_FILE for URL"
