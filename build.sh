#!/bin/bash

echo "🔨 Building CLOB Trading System..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust first."
    exit 1
fi

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

echo "✅ Prerequisites check passed"

# Build Rust CLOB library
echo "🔨 Building Rust CLOB library..."
cd clob
cargo build --release
if [ $? -ne 0 ]; then
    echo "❌ Failed to build Rust CLOB library"
    exit 1
fi
echo "✅ Rust CLOB library built successfully"
cd ..

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

# Build native addon
echo "🔨 Building Node.js native addon..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build native addon"
    echo "⚠️  Backend will fall back to JavaScript implementation"
else
    echo "✅ Native addon built successfully"
fi
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
cd ..

echo ""
echo "🎉 Build completed successfully!"
echo ""
echo "To start the system:"
echo "  ./start.sh"
echo ""
echo "Or manually:"
echo "  cd backend && npm start"
echo "  cd frontend && npm start"
echo ""
echo "The system will automatically use Rust CLOB if available,"
echo "or fall back to JavaScript implementation if not." 