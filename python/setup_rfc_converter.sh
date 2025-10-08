#!/bin/bash

# Setup script for RFC to GitHub Issues Converter
# This script helps set up the environment and dependencies

set -e

echo "🚀 Setting up RFC to GitHub Issues Converter"
echo "============================================="

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Check if pip is available
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip3 first."
    exit 1
fi

echo "✅ pip3 found"

# Install dependencies
echo "📦 Installing dependencies..."
pip3 install -r requirements.txt

echo "✅ Dependencies installed successfully"

# Check if GitHub token is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo ""
    echo "⚠️  GITHUB_TOKEN environment variable is not set."
    echo ""
    echo "To set up your GitHub token:"
    echo "1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)"
    echo "2. Generate a new token with 'repo' scope (for private repos) or 'public_repo' (for public repos)"
    echo "3. Set the environment variable:"
    echo "   export GITHUB_TOKEN=your_token_here"
    echo ""
    echo "Or create a .env file in the project root with:"
    echo "   GITHUB_TOKEN=your_token_here"
    echo ""
    echo "You can also set it temporarily for this session:"
    echo "   GITHUB_TOKEN=your_token_here python3 rfc_to_github_issues.py --dry-run"
else
    echo "✅ GITHUB_TOKEN is set"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Usage examples:"
echo "  # Dry run to preview what would be created"
echo "  python3 rfc_to_github_issues.py --dry-run"
echo ""
echo "  # Convert a specific RFC"
echo "  python3 rfc_to_github_issues.py --rfc-file 001-format-support.md"
echo ""
echo "  # Convert all RFCs"
echo "  python3 rfc_to_github_issues.py --all"
echo ""
echo "  # Get help"
echo "  python3 rfc_to_github_issues.py --help"
echo ""
echo "For more information, see README_RFC_CONVERTER.md"

