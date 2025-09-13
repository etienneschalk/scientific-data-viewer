#!/bin/bash

# Scientific Data Viewer - Setup Script
# This script sets up the development environment for the VSCode extension

set -e  # Exit on any error

echo "🔬 Scientific Data Viewer - Development Setup"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ and try again."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.7+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check Python version
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✅ Python $PYTHON_VERSION detected"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip3 install xarray netCDF4 zarr h5py numpy matplotlib h5netcdf

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

# Create sample data
echo "📊 Creating sample data files..."
python3 create_sample_data.py

# Run tests
echo "🧪 Running tests..."
npm test

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Open VSCode: code ."
echo "2. Press F5 to run the extension in development mode"
echo "3. Test with sample data files in the sample-data/ directory"
echo ""
echo "Useful commands:"
echo "- npm run watch    # Watch for changes and recompile"
echo "- npm test         # Run tests"
echo "- npm run lint     # Check code style"
echo "- npm run package  # Create .vsix package"
echo ""
echo "Happy coding! 🚀"
