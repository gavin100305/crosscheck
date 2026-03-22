#!/bin/bash

# LLM Council - Start script

# Load environment variables from .env if present
if [ -f .env ]; then
	set -a
	source .env
	set +a
fi

if [ -z "${GROQ_API_KEY}" ]; then
	echo "Error: GROQ_API_KEY is not set."
	echo "Add it to .env as GROQ_API_KEY=your_key_here or export it in your shell."
	exit 1
fi

if command -v uv >/dev/null 2>&1; then
	BACKEND_CMD=(uv run python -m backend.main)
else
	BACKEND_CMD=(python3 -m backend.main)
	echo "Warning: uv not found. Falling back to python3."
fi

echo "Starting LLM Council..."
echo ""

# Start backend
echo "Starting backend on http://localhost:8001..."
"${BACKEND_CMD[@]}" &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 2

# Start frontend
echo "Starting frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ LLM Council is running!"
echo "  Backend:  http://localhost:8001"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
