#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Free port 3000 if in use
fuser -k 3000/tcp 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
pkill -f "next-server.*3000" 2>/dev/null
sleep 1

PID_FILE="$DIR/app.pid"
PORT=3000

# Run custom Node + Next + WebSocket server in PRODUCTION mode
export NODE_ENV=production
nohup nice -n 10 /usr/bin/node "$DIR/server.js" </dev/null > "$DIR/app.log" 2>&1 &
NEW_PID=$!
disown $NEW_PID
echo "$NEW_PID" > "$PID_FILE"
echo "Tebak Lagu Multiplayer started on PID $NEW_PID (Port $PORT)"
