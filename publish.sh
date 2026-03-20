#!/bin/bash

# =============================================================================
# Scientific Data Viewer - Manual Publishing Script
# =============================================================================
# This script publishes the extension to both VS Code Marketplace and Open VSX
# with comprehensive version consistency checks (CHANGELOG, README, release notes, git).
# After build/package, it creates the git tag vX.Y.Z (if needed), pushes it, and opens a
# minimal GitHub Release (title X.Y.Z) with a changelog permalink — then publishes to the
# marketplaces so the release exists before publication.
#
# Prerequisites:
#   - VS Code Marketplace: Run `vsce login <publisher>` with your PAT first
#   - Open VSX: Set OPENVSX_TOKEN environment variable
#   - GitHub: GitHub CLI (`gh`) installed and `gh auth login` (for PR/CI verification and releases)
#
# Usage:
#   ./publish.sh                    # Tag + GitHub release, then both marketplaces
#   ./publish.sh --dry-run          # Package only, don't publish or create release
#   ./publish.sh --skip-tests       # Skip tests (use with caution)
#   ./publish.sh --skip-pr-check    # Skip GitHub PR / CI verification
#   ./publish.sh --skip-github-release  # Publish marketplaces only; no tag/release automation
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
SKIP_PR_CHECK=false
SKIP_GITHUB_RELEASE=false

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
        --skip-pr-check)
            SKIP_PR_CHECK=true
            ;;
        --skip-github-release)
            SKIP_GITHUB_RELEASE=true
            ;;
        --help|-h)
            echo "Usage: ./publish.sh [options]"
            echo ""
            echo "Options:"
            echo "  --dry-run               Package only, don't publish"
            echo "  --skip-tests            Skip running tests"
            echo "  --skip-vscode           Skip VS Code Marketplace publish"
            echo "  --skip-openvsx          Skip Open VSX publish"
            echo "  --skip-pr-check         Skip GitHub PR / Actions CI verification (gh)"
            echo "  --skip-github-release   Skip git tag push + gh release create"
            echo "  --help, -h              Show this help message"
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

# Verify GitHub check runs for a commit (REST: check-runs, up to 100).
verify_commit_check_runs() {
    local owner=$1 name=$2 sha=$3
    local total pending failed
    total=$(gh api "repos/${owner}/${name}/commits/${sha}/check-runs?per_page=100" --jq '.check_runs | length' 2>/dev/null || echo 0)
    if [ -z "$total" ] || [ "$total" = "null" ]; then
        total=0
    fi
    if [ "$total" -eq 0 ]; then
        print_error "No GitHub check runs for commit ${sha:0:7}. Push and wait for CI, or use --skip-pr-check"
        exit 1
    fi
    pending=$(gh api "repos/${owner}/${name}/commits/${sha}/check-runs?per_page=100" --jq '[.check_runs[] | select(.status != "completed")] | length' 2>/dev/null || echo 0)
    if [ "${pending:-0}" -gt 0 ]; then
        print_error "${pending} check run(s) still in progress for ${sha:0:7}. Wait for CI or use --skip-pr-check"
        exit 1
    fi
    failed=$(gh api "repos/${owner}/${name}/commits/${sha}/check-runs?per_page=100" --jq '[.check_runs[] | select(.status == "completed" and (.conclusion != "success" and .conclusion != "skipped" and .conclusion != "neutral"))] | length' 2>/dev/null || echo 0)
    if [ "${failed:-0}" -gt 0 ]; then
        print_error "${failed} check run(s) did not succeed for ${sha:0:7}. See GitHub Actions for details."
        exit 1
    fi
    print_success "All ${total} GitHub check run(s) completed successfully for ${sha:0:7}"
}

# Ensure CI passed for the PR tied to this branch, or for HEAD on main/master / when no PR exists.
verify_github_ci() {
    if [ "$SKIP_PR_CHECK" = true ]; then
        print_warning "Skipping GitHub PR / CI verification (--skip-pr-check)"
        return 0
    fi
    if [ ! -d ".git" ]; then
        print_warning "Not a git repository; skipping GitHub CI verification"
        return 0
    fi
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) is required for CI verification. Install: https://cli.github.com/  Or use --skip-pr-check"
        exit 1
    fi
    if ! gh auth status &>/dev/null; then
        print_error "gh is not authenticated. Run: gh auth login  Or use --skip-pr-check"
        exit 1
    fi

    print_step "Verifying GitHub PR / CI status..."
    local CURRENT_BRANCH REPO_SLUG OWNER REPO_NAME HEAD_SHA PR_NUM
    CURRENT_BRANCH=$(git branch --show-current)
    REPO_SLUG=$(gh repo view --json nameWithOwner -q .nameWithOwner)
    OWNER=${REPO_SLUG%%/*}
    REPO_NAME=${REPO_SLUG#*/}
    HEAD_SHA=$(git rev-parse HEAD)

    if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
        print_info "On ${CURRENT_BRANCH}; verifying check runs for HEAD..."
        verify_commit_check_runs "$OWNER" "$REPO_NAME" "$HEAD_SHA"
        return 0
    fi

    if gh pr view --json number,url &>/dev/null; then
        print_info "Pull request: $(gh pr view --json url -q .url)"
        if gh pr checks; then
            print_success "All pull request checks passed"
        else
            print_error "Pull request checks failed or are still pending. Fix CI or use --skip-pr-check"
            exit 1
        fi
        return 0
    fi

    PR_NUM=$(gh pr list --head "$CURRENT_BRANCH" --state open --limit 1 --json number --jq '.[0].number // empty')
    if [ -n "$PR_NUM" ]; then
        print_info "Open pull request #${PR_NUM}"
        if gh pr checks "$PR_NUM"; then
            print_success "All pull request checks passed"
        else
            print_error "PR #${PR_NUM} checks failed or are still pending"
            exit 1
        fi
        return 0
    fi

    PR_NUM=$(gh pr list --head "$CURRENT_BRANCH" --state merged --limit 1 --json number --jq '.[0].number // empty')
    if [ -n "$PR_NUM" ]; then
        print_info "Latest merged PR for branch ${CURRENT_BRANCH}: #${PR_NUM}"
        if gh pr checks "$PR_NUM"; then
            print_success "All checks passed for PR #${PR_NUM}"
        else
            print_error "PR #${PR_NUM} does not have all successful checks (see GitHub). Use --skip-pr-check to override."
            exit 1
        fi
        return 0
    fi

    print_warning "No pull request found for branch '${CURRENT_BRANCH}'; verifying check runs on HEAD..."
    verify_commit_check_runs "$OWNER" "$REPO_NAME" "$HEAD_SHA"
}

create_github_tag_and_release() {
    local TAG_NAME="v${PACKAGE_VERSION}"
    local HEAD_COMMIT CHANGELOG_LINK NOTES

    if [ "$SKIP_GITHUB_RELEASE" = true ]; then
        return 0
    fi
    if [ ! -d ".git" ]; then
        print_warning "Not a git repository; skipping GitHub tag and release"
        return 0
    fi
    if ! command -v gh &> /dev/null || ! gh auth status &>/dev/null; then
        print_error "gh is required to create the GitHub release. Run: gh auth login  Or use --skip-github-release"
        exit 1
    fi
    if [ -z "$REPO_URL" ]; then
        print_error "Could not determine GitHub URL (package.json repository or git remote origin)"
        exit 1
    fi

    print_header "GitHub tag & release"

    HEAD_COMMIT=$(git rev-parse HEAD)

    if ! git rev-parse "$TAG_NAME^{commit}" &>/dev/null; then
        if git ls-remote --tags origin 2>/dev/null | grep -q "refs/tags/${TAG_NAME}$"; then
            print_step "Fetching existing tag ${TAG_NAME} from origin..."
            git fetch -q origin "refs/tags/${TAG_NAME}:refs/tags/${TAG_NAME}" || {
                print_error "Failed to fetch tag ${TAG_NAME} from origin"
                exit 1
            }
        fi
    fi

    if git rev-parse "$TAG_NAME^{commit}" &>/dev/null; then
        local TAG_COMMIT
        TAG_COMMIT=$(git rev-parse "$TAG_NAME^{commit}")
        if [ "$TAG_COMMIT" != "$HEAD_COMMIT" ]; then
            print_error "Tag ${TAG_NAME} points to ${TAG_COMMIT:0:7} but HEAD is ${HEAD_COMMIT:0:7}. Align or delete the tag before publishing."
            exit 1
        fi
    else
        print_step "Creating local tag ${TAG_NAME}..."
        git tag "$TAG_NAME"
        print_success "Created local tag ${TAG_NAME}"
    fi

    print_step "Pushing tag ${TAG_NAME} to origin..."
    if ! git push origin "$TAG_NAME"; then
        print_error "Failed to push ${TAG_NAME}. If the tag exists on the server for another commit, fix it on GitHub first."
        exit 1
    fi
    print_success "Tag ${TAG_NAME} is on origin"

    if gh release view "$TAG_NAME" &>/dev/null; then
        print_success "GitHub release ${TAG_NAME} already exists"
        print_info "${REPO_URL}/releases/tag/${TAG_NAME}"
        return 0
    fi

    CHANGELOG_LINK="${REPO_URL}/blob/${TAG_NAME}/CHANGELOG.md"
    NOTES="Changelog for this version: ${CHANGELOG_LINK}"

    print_step "Creating GitHub release (tag ${TAG_NAME}, title ${PACKAGE_VERSION})..."
    if gh release create "$TAG_NAME" --title "$PACKAGE_VERSION" --notes "$NOTES"; then
        print_success "GitHub release created"
        print_info "${REPO_URL}/releases/tag/${TAG_NAME}"
    else
        print_error "gh release create failed"
        exit 1
    fi
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

# Public repo URL (release notes link, summary)
REPO_URL=$(node -p "require('./package.json').repository?.url || ''" 2>/dev/null | sed 's/\.git$//' | sed 's|^git+||')
if [ -z "$REPO_URL" ] && [ -d ".git" ]; then
    REPO_URL=$(git remote get-url origin 2>/dev/null | sed 's/\.git$//' | sed 's|^git@github.com:|https://github.com/|')
fi

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

if command -v vsce &> /dev/null; then
    VSCE_CMD="vsce"
    print_success "vsce: available (global)"
elif npx @vscode/vsce --version &> /dev/null; then
    VSCE_CMD="npx @vscode/vsce"
    print_success "vsce: available (via npx)"
else
    print_error "vsce not found (install with: npm install -g @vscode/vsce)"
    exit 1
fi

if command -v ovsx &> /dev/null; then
    OVSX_CMD="ovsx"
    print_success "ovsx: available (global)"
elif npx ovsx --version &> /dev/null; then
    OVSX_CMD="npx ovsx"
    print_success "ovsx: available (via npx)"
else
    print_error "ovsx not found (install with: npm install -g ovsx)"
    exit 1
fi

if [ "$SKIP_PR_CHECK" = false ] || [ "$SKIP_GITHUB_RELEASE" = false ]; then
    print_step "Checking GitHub CLI..."
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) is required unless you pass both --skip-pr-check and --skip-github-release"
        exit 1
    fi
    if ! gh auth status &> /dev/null; then
        print_error "gh is not authenticated. Run: gh auth login"
        exit 1
    fi
    print_success "gh: $(gh --version | head -n1)"
fi

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

# Check 2: Release notes exist for this version
print_step "Checking release notes..."
RELEASE_NOTES_FILE="docs/RELEASE_NOTES_${PACKAGE_VERSION}.md"
if [ -f "$RELEASE_NOTES_FILE" ]; then
    print_success "Release notes found: ${RELEASE_NOTES_FILE}"
else
    print_warning "Release notes not found: ${RELEASE_NOTES_FILE}"
    read -p "Continue without release notes? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Aborted. Please create ${RELEASE_NOTES_FILE} first."
        exit 1
    fi
fi

# Check 3: README.md lists current version and release notes link
print_step "Checking README.md..."
if [ -f "README.md" ]; then
    README_OK=true
    if ! grep -Fq "Current Version: v${PACKAGE_VERSION}" README.md; then
        print_error "README.md does not show Current Version: v${PACKAGE_VERSION}"
        print_info "Update the badge line near the top, e.g. **Current Version: v${PACKAGE_VERSION}**"
        README_OK=false
    fi
    if ! grep -Fq "RELEASE_NOTES_${PACKAGE_VERSION}.md" README.md; then
        print_error "README.md does not link to docs/RELEASE_NOTES_${PACKAGE_VERSION}.md"
        print_info "Update the release notes link, e.g. [Release Notes](./docs/RELEASE_NOTES_${PACKAGE_VERSION}.md)"
        README_OK=false
    fi
    if [ "$README_OK" = true ]; then
        print_success "README.md references version ${PACKAGE_VERSION}"
    else
        CHECKS_PASSED=false
    fi
else
    print_warning "README.md not found"
fi

# Check 4: Git working directory is clean
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

    # Check 5: Current branch (before tag operations)
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

    verify_github_ci

    # Check 6: Git tag alignment (tag/release run after confirm, before marketplaces, unless --skip-github-release)
    print_step "Checking git tags..."
    TAG_NAME="v${PACKAGE_VERSION}"
    HEAD_COMMIT=$(git rev-parse HEAD)
    if git tag -l | grep -q "^${TAG_NAME}$"; then
        TAG_COMMIT=$(git rev-parse "$TAG_NAME^{commit}")
        if [ "$TAG_COMMIT" != "$HEAD_COMMIT" ]; then
            print_error "Local tag ${TAG_NAME} points to ${TAG_COMMIT:0:7} but HEAD is ${HEAD_COMMIT:0:7}. Delete or move the tag before publishing."
            CHECKS_PASSED=false
        else
            print_success "Local tag ${TAG_NAME} matches HEAD"
        fi
    else
        if [ "$DRY_RUN" = true ]; then
            print_info "Tag ${TAG_NAME} is not created yet (dry run; a full run would create tag + release then marketplaces unless --skip-github-release)"
        else
            print_info "Tag ${TAG_NAME} will be created and pushed after you confirm, before marketplace publish"
        fi
    fi

    if git ls-remote --tags origin 2>/dev/null | grep -q "refs/tags/${TAG_NAME}$"; then
        REMOTE_C=$(git ls-remote origin "refs/tags/${TAG_NAME}^{}" 2>/dev/null | awk '{print $1}')
        if [ -z "$REMOTE_C" ]; then
            REMOTE_C=$(git ls-remote origin "refs/tags/${TAG_NAME}" 2>/dev/null | awk 'NR==1 {print $1}')
        fi
        if [ -n "$REMOTE_C" ] && [ "$REMOTE_C" != "$HEAD_COMMIT" ]; then
            print_error "Remote tag ${TAG_NAME} points to ${REMOTE_C:0:7} but HEAD is ${HEAD_COMMIT:0:7}. Fix the remote tag or reset HEAD before publishing."
            CHECKS_PASSED=false
        elif [ -n "$REMOTE_C" ]; then
            print_success "Remote tag ${TAG_NAME} matches HEAD"
        fi
    fi
fi

# Check 7: Version hasn't been published already
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
echo "Ready to release version ${PACKAGE_VERSION}:"
if [ "$SKIP_GITHUB_RELEASE" = false ]; then
    echo "  • Git tag v${PACKAGE_VERSION} + GitHub Release (title ${PACKAGE_VERSION})"
fi
[ "$SKIP_VSCODE" = false ] && echo "  • VS Code Marketplace"
[ "$SKIP_OPENVSX" = false ] && echo "  • Open VSX Registry"
echo ""
read -p "Proceed with tag/release and publishing? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Aborted by user"
    exit 1
fi

if [ "$SKIP_GITHUB_RELEASE" = false ]; then
    create_github_tag_and_release
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
    TAG_NAME="v${PACKAGE_VERSION}"
    STEP=1
    if [ "$SKIP_GITHUB_RELEASE" = false ] && [ -n "$REPO_URL" ]; then
        echo "  ${STEP}. Verify GitHub release: ${REPO_URL}/releases/tag/${TAG_NAME}"
        STEP=$((STEP + 1))
    fi
    echo "  ${STEP}. Verify the extension on the marketplaces"
    STEP=$((STEP + 1))
    if [ "$SKIP_GITHUB_RELEASE" = true ] && [ -n "$REPO_URL" ]; then
        echo "  ${STEP}. Create tag & release manually if you still need them:"
        echo "       git tag ${TAG_NAME} && git push origin ${TAG_NAME}"
        echo "       gh release create ${TAG_NAME} --title ${PACKAGE_VERSION} --notes \"...\""
    fi

    echo ""
    echo "Marketplace URLs:"
    [ "$SKIP_VSCODE" = false ] && echo "  • https://marketplace.visualstudio.com/items?itemName=${PUBLISHER}.${EXTENSION_NAME}"
    [ "$SKIP_OPENVSX" = false ] && echo "  • https://open-vsx.org/extension/${PUBLISHER}/${EXTENSION_NAME}"
else
    print_error "Publishing completed with errors"
    exit 1
fi
