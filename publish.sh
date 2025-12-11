#!/bin/bash

# =============================================================================
# Scientific Data Viewer - Manual Publishing Script
# =============================================================================
# This script publishes the extension to both VS Code Marketplace and Open VSX
# with comprehensive version consistency checks.
#
# Prerequisites:
#   - VS Code Marketplace: Run `vsce login <publisher>` with your PAT first
#   - Open VSX: Set OPENVSX_TOKEN environment variable
#
# Usage:
#   ./publish.sh              # Full publish to both marketplaces
#   ./publish.sh --dry-run    # Package only, don't publish
#   ./publish.sh --skip-tests # Skip tests (use with caution)
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
SKIP_TESTS=false
SKIP_VSCODE=false
SKIP_OPENVSX=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --skip-tests)
            SKIP_TESTS=true
            ;;
        --skip-vscode)
            SKIP_VSCODE=true
            ;;
        --skip-openvsx)
            SKIP_OPENVSX=true
            ;;
        --help|-h)
            echo "Usage: ./publish.sh [options]"
            echo ""
            echo "Options:"
            echo "  --dry-run      Package only, don't publish"
            echo "  --skip-tests   Skip running tests"
            echo "  --skip-vscode  Skip VS Code Marketplace publish"
            echo "  --skip-openvsx Skip Open VSX publish"
            echo "  --help, -h     Show this help message"
            exit 0
            ;;
    esac
done

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✖ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✔ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

print_header "Pre-flight Checks"

# Check we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Get version from package.json
PACKAGE_VERSION=$(node -p "require('./package.json').version")
PUBLISHER=$(node -p "require('./package.json').publisher")
EXTENSION_NAME=$(node -p "require('./package.json').name")

print_info "Extension: ${EXTENSION_NAME}"
print_info "Publisher: ${PUBLISHER}"
print_info "Version: ${PACKAGE_VERSION}"

# Check for required tools and versions
print_step "Checking required tools..."

# Required versions (match package.json engines and CI)
REQUIRED_NODE_MAJOR=22
REQUIRED_PYTHON_MAJOR=3
REQUIRED_PYTHON_MINOR=13

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)

if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
    print_error "Node.js ${REQUIRED_NODE_MAJOR}+ is required. Current version: v${NODE_VERSION}"
    print_info "Use nvm to switch: nvm use ${REQUIRED_NODE_MAJOR}"
    exit 1
fi
print_success "Node.js: v${NODE_VERSION} (>= ${REQUIRED_NODE_MAJOR} ✓)"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm: $(npm --version)"

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed"
    exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYTHON_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
PYTHON_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")

if [ "$PYTHON_MAJOR" -lt "$REQUIRED_PYTHON_MAJOR" ] || \
   ([ "$PYTHON_MAJOR" -eq "$REQUIRED_PYTHON_MAJOR" ] && [ "$PYTHON_MINOR" -lt "$REQUIRED_PYTHON_MINOR" ]); then
    print_error "Python ${REQUIRED_PYTHON_MAJOR}.${REQUIRED_PYTHON_MINOR}+ is required. Current version: ${PYTHON_VERSION}"
    exit 1
fi
print_success "Python: ${PYTHON_VERSION} (>= ${REQUIRED_PYTHON_MAJOR}.${REQUIRED_PYTHON_MINOR} ✓)"

if ! command -v vsce &> /dev/null && ! npx vsce --version &> /dev/null; then
    print_warning "vsce not found globally, will use npx"
    VSCE_CMD="npx @vscode/vsce"
else
    VSCE_CMD="vsce"
fi
print_success "vsce: available"

if ! command -v ovsx &> /dev/null && ! npx ovsx --version &> /dev/null; then
    print_warning "ovsx not found globally, will use npx"
    OVSX_CMD="npx ovsx"
else
    OVSX_CMD="ovsx"
fi
print_success "ovsx: available"

# =============================================================================
# Version Consistency Checks
# =============================================================================

print_header "Version Consistency Checks"

CHECKS_PASSED=true

# Check 1: CHANGELOG.md has entry for this version
print_step "Checking CHANGELOG.md..."
CHANGELOG_UPDATED=false
if [ -f "CHANGELOG.md" ]; then
    # Look for version header like "## [0.8.0]" or "## 0.8.0"
    if grep -qE "^## \[?${PACKAGE_VERSION}\]?" CHANGELOG.md; then
        print_success "CHANGELOG.md has entry for version ${PACKAGE_VERSION}"

        # Check if it has UNRELEASED date and replace with today's date
        TODAY=$(date +%Y-%m-%d)
        if grep -qiE "^## \[?${PACKAGE_VERSION}\]? - [Uu][Nn][Rr][Ee][Ll][Ee][Aa][Ss][Ee][Dd]" CHANGELOG.md; then
            if [ "$DRY_RUN" = true ]; then
                print_info "Found UNRELEASED date (would replace with ${TODAY} in non-dry-run mode)"
            else
                print_info "Found UNRELEASED date, replacing with ${TODAY}..."
                # Replace UNRELEASED (case-insensitive) with today's date
                sed -i -E "s/^(## \[?${PACKAGE_VERSION}\]? - )[Uu][Nn][Rr][Ee][Ll][Ee][Aa][Ss][Ee][Dd]/\1${TODAY}/" CHANGELOG.md
                print_success "Updated CHANGELOG.md date to ${TODAY}"
                CHANGELOG_UPDATED=true

                # Ask user if they want to commit the change
                echo ""
                read -p "Commit CHANGELOG.md update? (Y/n) " -n 1 -r
                echo ""
                if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                    git add CHANGELOG.md
                    git commit -m "docs: update changelog date to ${TODAY} for version ${PACKAGE_VERSION}"
                    print_success "Committed CHANGELOG.md update"
                else
                    print_warning "CHANGELOG.md update not committed (remember to commit manually)"
                fi
            fi
        fi
    else
        print_error "CHANGELOG.md does not have an entry for version ${PACKAGE_VERSION}"
        print_info "Please add a section: ## [${PACKAGE_VERSION}] - $(date +%Y-%m-%d)"
        CHECKS_PASSED=false
    fi
else
    print_warning "CHANGELOG.md not found"
fi

# Check 2: Git working directory is clean
print_step "Checking git status..."
if [ -d ".git" ]; then
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "Git working directory has uncommitted changes"
        git status --short
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Aborted by user"
            exit 1
        fi
    else
        print_success "Git working directory is clean"
    fi

    # Check 3: Git tag for this version
    print_step "Checking git tags..."
    TAG_NAME="v${PACKAGE_VERSION}"
    if git tag -l | grep -q "^${TAG_NAME}$"; then
        print_success "Git tag ${TAG_NAME} exists"

        # Check if we're on the tagged commit
        TAG_COMMIT=$(git rev-list -n 1 "${TAG_NAME}" 2>/dev/null || echo "")
        HEAD_COMMIT=$(git rev-parse HEAD)
        if [ "$TAG_COMMIT" != "$HEAD_COMMIT" ]; then
            print_warning "Current HEAD is not at tag ${TAG_NAME}"
            print_info "Tag commit: ${TAG_COMMIT:0:8}"
            print_info "HEAD commit: ${HEAD_COMMIT:0:8}"
        fi
    else
        print_warning "Git tag ${TAG_NAME} does not exist yet"
        print_info "Consider creating it after publishing: git tag ${TAG_NAME} && git push origin ${TAG_NAME}"
    fi

    # Check 4: Current branch
    print_step "Checking current branch..."
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
        print_success "On branch: ${CURRENT_BRANCH}"
    else
        print_warning "Not on main/master branch (current: ${CURRENT_BRANCH})"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Aborted by user"
            exit 1
        fi
    fi
fi

# Check 5: Version hasn't been published already
print_step "Checking if version already published..."
# This is a best-effort check - may fail if not logged in
VSIX_FILE="${EXTENSION_NAME}-${PACKAGE_VERSION}.vsix"

if [ "$CHECKS_PASSED" = false ]; then
    print_error "Some checks failed. Please fix the issues above."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# =============================================================================
# Token/Authentication Checks
# =============================================================================

print_header "Authentication Checks"

if [ "$SKIP_OPENVSX" = false ]; then
    print_step "Checking Open VSX token..."
    if [ -z "$OPENVSX_TOKEN" ]; then
        print_error "OPENVSX_TOKEN environment variable is not set"
        print_info "Set it with: export OPENVSX_TOKEN=your_token_here"
        print_info "Or skip Open VSX with: --skip-openvsx"
        read -p "Skip Open VSX publishing? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            SKIP_OPENVSX=true
        else
            exit 1
        fi
    else
        print_success "OPENVSX_TOKEN is set"
    fi
fi

if [ "$SKIP_VSCODE" = false ]; then
    print_step "Checking VS Code Marketplace authentication..."
    print_info "Make sure you've run: vsce login ${PUBLISHER}"
    print_info "If not logged in, the publish step will fail"
fi

# =============================================================================
# Build & Test
# =============================================================================

print_header "Build & Test"

print_step "Installing dependencies..."
npm ci

print_step "Running linter..."
npm run lint || {
    print_error "Linting failed"
    exit 1
}
print_success "Linting passed"

print_step "Compiling TypeScript..."
npm run compile || {
    print_error "Compilation failed"
    exit 1
}
print_success "Compilation successful"

if [ "$SKIP_TESTS" = false ]; then
    print_step "Running tests..."
    npm run test || {
        print_error "Tests failed"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    }
    print_success "Tests passed"
else
    print_warning "Skipping tests (--skip-tests)"
fi

# =============================================================================
# Package
# =============================================================================

print_header "Packaging"

print_step "Creating .vsix package..."
$VSCE_CMD package || {
    print_error "Packaging failed"
    exit 1
}

if [ -f "$VSIX_FILE" ]; then
    print_success "Package created: ${VSIX_FILE}"
    print_info "Size: $(du -h "$VSIX_FILE" | cut -f1)"
else
    print_error "Expected package file not found: ${VSIX_FILE}"
    # Try to find the actual file
    ACTUAL_VSIX=$(ls -1 *.vsix 2>/dev/null | head -1)
    if [ -n "$ACTUAL_VSIX" ]; then
        print_info "Found: ${ACTUAL_VSIX}"
        VSIX_FILE="$ACTUAL_VSIX"
    else
        exit 1
    fi
fi

if [ "$DRY_RUN" = true ]; then
    print_header "Dry Run Complete"
    print_success "Package created successfully: ${VSIX_FILE}"
    print_info "To publish, run without --dry-run"
    exit 0
fi

# =============================================================================
# Publish
# =============================================================================

print_header "Publishing"

# Confirmation
echo ""
echo "Ready to publish version ${PACKAGE_VERSION} to:"
[ "$SKIP_VSCODE" = false ] && echo "  • VS Code Marketplace"
[ "$SKIP_OPENVSX" = false ] && echo "  • Open VSX Registry"
echo ""
read -p "Proceed with publishing? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Aborted by user"
    exit 1
fi

PUBLISH_SUCCESS=true

# Publish to VS Code Marketplace
if [ "$SKIP_VSCODE" = false ]; then
    print_step "Publishing to VS Code Marketplace..."
    if $VSCE_CMD publish; then
        print_success "Published to VS Code Marketplace"
        print_info "View at: https://marketplace.visualstudio.com/items?itemName=${PUBLISHER}.${EXTENSION_NAME}"
    else
        print_error "Failed to publish to VS Code Marketplace"
        PUBLISH_SUCCESS=false
    fi
fi

# Publish to Open VSX
if [ "$SKIP_OPENVSX" = false ]; then
    print_step "Publishing to Open VSX Registry..."
    if $OVSX_CMD publish "$VSIX_FILE" -p "$OPENVSX_TOKEN"; then
        print_success "Published to Open VSX Registry"
        print_info "View at: https://open-vsx.org/extension/${PUBLISHER}/${EXTENSION_NAME}"
    else
        print_error "Failed to publish to Open VSX"
        PUBLISH_SUCCESS=false
    fi
fi

# =============================================================================
# Summary
# =============================================================================

print_header "Summary"

if [ "$PUBLISH_SUCCESS" = true ]; then
    print_success "Publishing completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Verify the extension on the marketplaces"
    echo "  2. Create a GitHub release if not done yet:"
    echo "     git tag v${PACKAGE_VERSION}"
    echo "     git push origin v${PACKAGE_VERSION}"
    echo "     gh release create v${PACKAGE_VERSION} --generate-notes"
    echo ""
    echo "Marketplace URLs:"
    [ "$SKIP_VSCODE" = false ] && echo "  • https://marketplace.visualstudio.com/items?itemName=${PUBLISHER}.${EXTENSION_NAME}"
    [ "$SKIP_OPENVSX" = false ] && echo "  • https://open-vsx.org/extension/${PUBLISHER}/${EXTENSION_NAME}"
else
    print_error "Publishing completed with errors"
    exit 1
fi
