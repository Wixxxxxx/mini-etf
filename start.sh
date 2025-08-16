#!/bin/bash

echo "🚀 Starting CLOB Trading System..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Check if system has been built
if [ ! -f "clob/target/release/libclob.dylib" ] && [ ! -f "clob/target/release/libclob.so" ] && [ ! -f "clob/target/release/clob.dll" ]; then
    echo "⚠️  Rust CLOB library not found. Building system..."
    ./build.sh
    if [ $? -ne 0 ]; then
        echo "❌ Build failed. Please run ./build.sh manually to fix issues."
        exit 1
    fi
fi

# Start backend server
echo "🚀 Starting backend API server..."
cd backend
npm start &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend is running on http://localhost:3001"
    
    # Check which CLOB engine is being used
    ENGINE_INFO=$(curl -s http://localhost:3001/health | grep -o '"clobEngine":"[^"]*"' | cut -d'"' -f4)
    if [ "$ENGINE_INFO" = "Rust" ]; then
        echo "🚀 Using Rust CLOB engine"
    else
        echo "⚠️  Using JavaScript fallback engine"
    fi
else
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start frontend
echo "🚀 Starting frontend..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo "✅ CLOB Trading System is starting up!"
echo ""
echo "📊 Backend API: http://localhost:3001"
echo "🌐 Frontend: http://localhost:3000"
echo "🔗 Health Check: http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait 