#!/bin/bash

# Scientific Data Viewer - Setup Script
# This script sets up the development environment for the VSCode extension

set -e  # Exit on any error

echo "🔬 Scientific Data Viewer - Development Setup"
echo "---------------------------------------------"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 22+ and try again."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.13+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "❌ Node.js version 22+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check Python version
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYTHON_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
PYTHON_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 13 ]); then
    echo "❌ Python 3.13+ is required. Current version: $PYTHON_VERSION"
    exit 1
fi

echo "✅ Python $PYTHON_VERSION detected"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Python development environment: the repository .venv, with the pinned
# packages of requirements-dev.txt (also used by paranoia.sh, publish.sh and CI)
echo "🐍 Creating .venv and installing requirements-dev.txt..."
if [ ! -x .venv/bin/python ]; then
    python3 -m venv .venv
fi
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements-dev.txt
PY=.venv/bin/python

# Create sample data
echo "📊 Creating sample data files..."
echo "   Existing files are kept (use --overwrite to regenerate them, --disposable for the deletion-test files)..."
"$PY" python/create_sample_data.py

# Issue #117 non-regression plot PNGs (versioned folder from package.json)
_PKG_VERSION=$(node -p "require('./package.json').version")
echo "📈 Generating non-regression plot snapshots (Issue #117)..."
echo "   Output: artefacts/non-regression-plots/v${_PKG_VERSION}/"
set +e
"$PY" python/non_regression_test_plot.py
NON_REG_PLOT_EXIT=$?
set -e
if [ $NON_REG_PLOT_EXIT -eq 0 ]; then
    echo "✅ Non-regression plots generated (open artefacts/non-regression-plots/v*/summary.md for visual check)"
else
    echo "⚠️  Non-regression plot script failed or data missing (exit $NON_REG_PLOT_EXIT). Check that python/create_sample_data.py created artefacts/sample-data/hs-issue-0117.nc."
fi

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

# Run tests
echo "🧪 Running tests..."
echo "   Running TypeScript tests..."
npm test

echo "   Running Python tests..."
set +e  # Temporarily disable exit on error for test execution
"$PY" -m pytest python/tests -q
PYTEST_EXIT_CODE=$?
set -e  # Re-enable exit on error
if [ $PYTEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Python tests passed"
else
    echo "⚠️  Python tests failed (non-fatal, exit code: $PYTEST_EXIT_CODE)"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Open VSCode: code ."
echo "2. Press F5 to run the extension in development mode"
echo "3. Test with sample data files in the artefacts/sample-data/ directory"
echo ""
echo "Useful commands:"
echo "- npm run watch    # Watch for changes and recompile"
echo "- npm test         # Run tests"
echo "- npm run lint     # Check code style"
echo "- npm run package  # Create .vsix package in artefacts/vsix-releases/"
echo "- .venv/bin/python -m pytest python/tests   # Python tests"
echo ""
echo "Happy coding! 🚀"
