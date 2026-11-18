#!/bin/bash

# =============================================================================
# Scientific Data Viewer - Manual Publishing Script
# =============================================================================
# Publishes the extension to both VS Code Marketplace and Open VSX, from main,
# with version consistency checks. Order (docs/PUBLISHING.md):
#   checks (main, clean tree, tag, tokens) -> npm ci, lint, compile, tests
#   -> release date (UNRELEASED -> today, committed) -> package
#   -> tag v<version> + push -> publish this one .vsix to both marketplaces
# Nothing is tagged, pushed or committed before the build and tests pass.
#
# Prerequisites:
#   - Release branch merged into main, main checked out and pulled
#   - VS Code Marketplace: `vsce login <publisher>` with your PAT (checked
#     with `vsce verify-pat`; global PATs are retired, see PUBLISHING.md)
#   - Open VSX: Set OPENVSX_TOKEN environment variable
#
# Usage:
#   ./publish.sh              # Full publish to both marketplaces
#   ./publish.sh --dry-run    # Checks, build, tests and package only
#   ./publish.sh --skip-tests # Skip tests (use with caution)
#   ./publish.sh --pre-release # Publish as a pre-release (both marketplaces)
# =============================================================================

set -e  # Exit on error

# Set in a VS Code terminal: the VS Code started by `npm test` would then run
# as Node and every test fail (as in paranoia.sh)
unset ELECTRON_RUN_AS_NODE

# Python of the repository .venv (setup.sh): the system python3 can be too old
# for the scripts (e.g. 3.8 on Ubuntu 20.04). PYTHON=<path> to use another one.
PYTHON="${PYTHON:-$(pwd)/.venv/bin/python}"
[ -x "$PYTHON" ] || PYTHON=python3

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
PRE_RELEASE=false

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
        --pre-release)
            PRE_RELEASE=true
            ;;
        --help|-h)
            echo "Usage: ./publish.sh [options]"
            echo ""
            echo "Options:"
            echo "  --dry-run      Checks, build, tests and package only: nothing is"
            echo "                 committed, tagged, pushed or published"
            echo "  --skip-tests   Skip running tests"
            echo "  --skip-vscode  Skip VS Code Marketplace publish"
            echo "  --skip-openvsx Skip Open VSX publish"
            echo "  --pre-release  Publish as a pre-release: only users who chose"
            echo "                 'Switch to Pre-Release Version' get it. The version"
            echo "                 number is then used up: the next stable release"
            echo "                 needs a higher one (e.g. 0.13.0 pre-release -> 0.13.1)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Run it from main, after merging the release branch. A CHANGELOG"
            echo "heading '## [<version>] - UNRELEASED' gets today's date (links to it"
            echo "and README.md follow), committed after the build and tests pass."
            echo "The tag v<version> is created and pushed after packaging, then the"
            echo "same .vsix is published to both marketplaces."
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

# Ask "<question> (y/N)"; exit unless the answer is y
confirm_or_exit() {
    read -p "$1 (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Aborted by user"
        exit 1
    fi
}

check_generated_documentation() {
    local doc_file="README.md"
    local temp_doc

    print_header "Documentation Generation Check"

    print_step "Regenerating ${doc_file} (dry run)..."
    if [ ! -f "scripts/generate_readme.py" ]; then
        print_error "scripts/generate_readme.py not found"
        exit 1
    fi

    temp_doc=$(mktemp)

    if ! "$PYTHON" scripts/generate_readme.py --no-timestamp --output "$temp_doc"; then
        rm -f "$temp_doc"
        print_error "Documentation generation failed"
        exit 1
    fi

    if [ ! -f "$doc_file" ]; then
        rm -f "$temp_doc"
        print_error "${doc_file} is missing"
        print_info "Generate it with: ${PYTHON} scripts/generate_readme.py --no-timestamp"
        exit 1
    fi

    if cmp -s "$temp_doc" "$doc_file"; then
        rm -f "$temp_doc"
        print_success "${doc_file} matches generated output"
        return 0
    fi

    # The README is packaged in the .vsix: it must be the committed one
    print_error "${doc_file} differs from freshly generated documentation"
    print_info "Sources may be out of sync with ${doc_file} (package.json, docs/documentation.json)"
    print_info "Review the diff:"
    echo ""
    diff_output=$(diff -u "$doc_file" "$temp_doc" || true)
    echo "$diff_output" | head -80
    if [ "$(echo "$diff_output" | wc -l)" -gt 80 ]; then
        print_info "(diff truncated — run: diff -u ${doc_file} ${temp_doc})"
    fi
    echo ""
    rm -f "$temp_doc"
    print_info "Regenerate it (${PYTHON} scripts/generate_readme.py --no-timestamp), commit, then run ./publish.sh again"
    if [ "$DRY_RUN" = true ]; then
        print_warning "Dry run: continuing with the README as it is"
        return 0
    fi
    exit 1
}

# CHANGELOG "## [<version>] - UNRELEASED" -> today; links to that section
# (their anchor follows the heading) and README.md follow; the subject of the
# commit is added to the commit list of the PR summary (CLAUDE.md). Committed
# here: the package must hold the committed README, and the tag this commit.
set_release_date() {
    local today anchor_ver ver_re subject pr_summary last_item next_number
    local -a files linked
    today=$(date +%Y-%m-%d)
    anchor_ver="${PACKAGE_VERSION//./}"
    ver_re="${PACKAGE_VERSION//./\\.}"
    subject="docs: set the ${PACKAGE_VERSION} release date to ${today}"

    print_step "CHANGELOG.md: UNRELEASED -> ${today}"
    sed -i -E "s/^(## \[?${ver_re}\]? - )[Uu][Nn][Rr][Ee][Ll][Ee][Aa][Ss][Ee][Dd]/\1${today}/" CHANGELOG.md
    files=(CHANGELOG.md)

    # Markdown links only ("CHANGELOG.md#0130---unreleased)"), not the text that explains them
    mapfile -t linked < <(git grep -l -i "CHANGELOG\.md#${anchor_ver}---unreleased)" -- '*.md' ':!README.md' ':!CHANGELOG.md' || true)
    for f in "${linked[@]}"; do
        sed -i "s/CHANGELOG\.md#${anchor_ver}---unreleased)/CHANGELOG.md#${anchor_ver}---${today})/gI" "$f"
        print_step "Link to the changelog section updated: ${f}"
        files+=("$f")
    done

    print_step "Regenerating README.md (its changelog link follows the heading)..."
    "$PYTHON" scripts/generate_readme.py --no-timestamp
    files+=(README.md)

    pr_summary="docs/v${MAJOR_MINOR}/PR_SUMMARY_${PACKAGE_VERSION}.md"
    if [ -f "$pr_summary" ]; then
        last_item=$(grep -E '^[0-9]+\.[[:space:]]' "$pr_summary" | tail -1 || true)
        if [ -n "$last_item" ] && [ "$(grep -vE '^[[:space:]]*$' "$pr_summary" | tail -1)" = "$last_item" ]; then
            next_number=$(( ${last_item%%.*} + 1 ))
            printf '%d.  %s\n' "$next_number" "$subject" >> "$pr_summary"
            print_step "Commit added to the commit list of ${pr_summary}"
            files+=("$pr_summary")
        else
            print_warning "Commit list of ${pr_summary} not found at the end of the file: add '${subject}' by hand"
        fi
    fi

    git add -- "${files[@]}"
    echo ""
    git --no-pager diff --cached --stat
    echo ""
    read -p "Commit \"${subject}\"? (Y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        print_error "Aborted: the release date is staged but not committed (git restore --staged --worktree ${files[*]} to undo)"
        exit 1
    fi
    git commit -m "$subject"
    print_success "Committed: ${subject}"
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
MAJOR_MINOR="${PACKAGE_VERSION%.*}"

print_info "Extension: ${EXTENSION_NAME}"
print_info "Publisher: ${PUBLISHER}"
print_info "Version: ${PACKAGE_VERSION}"
if [ "$PRE_RELEASE" = true ]; then
    print_info "Channel: pre-release"
    # Both marketplaces only accept major.minor.patch: a pre-release is marked
    # in the .vsix manifest, not with a semver suffix such as 0.13.0-rc.1.
    if ! [[ "$PACKAGE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_error "Pre-release versions must be plain major.minor.patch (got ${PACKAGE_VERSION})"
        print_info "The marketplaces reject suffixes like -rc.1: the --pre-release flag marks the package instead"
        exit 1
    fi
else
    print_info "Channel: stable"
fi
if [ "$DRY_RUN" = true ]; then
    print_info "Dry run: nothing is committed, tagged, pushed or published"
fi

# Check for required tools and versions
print_step "Checking required tools..."

# Required versions (match package.json engines and CI)
REQUIRED_NODE_MAJOR=22
REQUIRED_PYTHON_MAJOR=3
REQUIRED_PYTHON_MINOR=13
REQUIRED_VSCE_MAJOR=4

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
if ! command -v "$PYTHON" &> /dev/null; then
    print_error "Python 3 is not installed"
    exit 1
fi

PYTHON_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYTHON_MAJOR=$("$PYTHON" -c "import sys; print(sys.version_info.major)")
PYTHON_MINOR=$("$PYTHON" -c "import sys; print(sys.version_info.minor)")

if [ "$PYTHON_MAJOR" -lt "$REQUIRED_PYTHON_MAJOR" ] || \
   ([ "$PYTHON_MAJOR" -eq "$REQUIRED_PYTHON_MAJOR" ] && [ "$PYTHON_MINOR" -lt "$REQUIRED_PYTHON_MINOR" ]); then
    print_error "Python ${REQUIRED_PYTHON_MAJOR}.${REQUIRED_PYTHON_MINOR}+ is required. Current version: ${PYTHON_VERSION}"
    exit 1
fi
print_success "Python: ${PYTHON_VERSION} (>= ${REQUIRED_PYTHON_MAJOR}.${REQUIRED_PYTHON_MINOR} ✓): ${PYTHON}"

if command -v vsce &> /dev/null; then
    VSCE_CMD="vsce"
elif npx @vscode/vsce --version &> /dev/null; then
    VSCE_CMD="npx @vscode/vsce"
else
    print_error "vsce not found (install with: npm install -g @vscode/vsce)"
    exit 1
fi
VSCE_VERSION=$($VSCE_CMD --version)
if [ "${VSCE_VERSION%%.*}" -lt "$REQUIRED_VSCE_MAJOR" ]; then
    print_error "vsce ${VSCE_VERSION} is too old (${REQUIRED_VSCE_MAJOR}.x, as in package.json): npm install -g @vscode/vsce"
    exit 1
fi
print_success "vsce: ${VSCE_VERSION} (${VSCE_CMD})"

if command -v ovsx &> /dev/null; then
    OVSX_CMD="ovsx"
    print_success "ovsx: $(ovsx --version) (global)"
elif npx ovsx --version &> /dev/null; then
    OVSX_CMD="npx ovsx"
    print_success "ovsx: available (via npx)"
else
    print_error "ovsx not found (install with: npm install -g ovsx)"
    exit 1
fi

# =============================================================================
# Version Consistency Checks
# =============================================================================

print_header "Version Consistency Checks"

CHECKS_PASSED=true
RELEASE_DATE_PENDING=false

# Check 1: CHANGELOG.md has entry for this version
print_step "Checking CHANGELOG.md..."
VERSION_RE="${PACKAGE_VERSION//./\\.}"
if [ -f "CHANGELOG.md" ]; then
    CHANGELOG_HEADING=$(grep -m1 -E "^## \[?${VERSION_RE}\]?" CHANGELOG.md || true)
    if [ -n "$CHANGELOG_HEADING" ]; then
        print_success "CHANGELOG.md has entry for version ${PACKAGE_VERSION}: ${CHANGELOG_HEADING}"
        if echo "$CHANGELOG_HEADING" | grep -qiE " - unreleased"; then
            RELEASE_DATE_PENDING=true
            print_info "Release date UNRELEASED: set to the day of publishing after the build and tests"
        elif ! echo "$CHANGELOG_HEADING" | grep -q " - $(date +%Y-%m-%d)"; then
            print_warning "The heading has a date that is not today: write UNRELEASED instead to have it set when publishing"
            CHECKS_PASSED=false
        fi
    else
        print_error "CHANGELOG.md does not have an entry for version ${PACKAGE_VERSION}"
        print_info "Please add a section: ## [${PACKAGE_VERSION}] - UNRELEASED"
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

TAG_NAME="v${PACKAGE_VERSION}"
CURRENT_BRANCH=""
if [ -d ".git" ]; then
    # Check 3: Git working directory is clean: what is packaged is what is tagged
    print_step "Checking git status..."
    if [ -n "$(git status --porcelain)" ]; then
        git status --short
        if [ "$DRY_RUN" = true ]; then
            print_warning "Git working directory has uncommitted changes (dry run: continuing)"
        else
            print_error "Git working directory has uncommitted changes: commit or stash them"
            print_info "The package is built from the working tree and the tag marks a commit: they must match"
            exit 1
        fi
    else
        print_success "Git working directory is clean"
    fi

    # Check 4: Publish from main, up to date with origin
    print_step "Checking current branch..."
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
        print_success "On branch: ${CURRENT_BRANCH}"
    else
        print_error "Not on main (current: ${CURRENT_BRANCH:-detached HEAD})"
        print_info "Merge the release branch into main first, then: git switch main && git pull"
        if [ "$DRY_RUN" = true ]; then
            print_warning "Dry run: continuing"
        else
            confirm_or_exit "Publish from ${CURRENT_BRANCH:-a detached HEAD} anyway?"
        fi
    fi
    if [ -n "$CURRENT_BRANCH" ] && git fetch --quiet origin "$CURRENT_BRANCH" 2>/dev/null; then
        REMOTE_HEAD=$(git rev-parse FETCH_HEAD)
        if [ "$REMOTE_HEAD" = "$(git rev-parse HEAD)" ]; then
            print_success "${CURRENT_BRANCH} is up to date with origin"
        elif git merge-base --is-ancestor "$REMOTE_HEAD" HEAD; then
            print_info "$(git rev-list --count "${REMOTE_HEAD}..HEAD") local commit(s) not pushed yet: pushed with the tag after packaging"
        else
            print_error "origin/${CURRENT_BRANCH} has commits that are not here: git pull first"
            exit 1
        fi
    else
        print_warning "Could not fetch origin/${CURRENT_BRANCH:-?} (offline?)"
    fi

    # Check 5: Tag of this version: created after packaging, never before
    print_step "Checking git tags..."
    if git rev-parse -q --verify "refs/tags/${TAG_NAME}" > /dev/null; then
        TAG_COMMIT=$(git rev-list -n 1 "${TAG_NAME}")
        if [ "$TAG_COMMIT" = "$(git rev-parse HEAD)" ]; then
            print_info "Tag ${TAG_NAME} already exists at HEAD (a previous run): reused"
        else
            print_error "Tag ${TAG_NAME} already exists on another commit (${TAG_COMMIT:0:8}): ${PACKAGE_VERSION} is used, bump the version"
            print_info "If nothing was published with it: git tag -d ${TAG_NAME} && git push origin :refs/tags/${TAG_NAME}"
            exit 1
        fi
    else
        print_success "Tag ${TAG_NAME} does not exist yet: created after packaging"
    fi
fi

VSIX_DIR="artefacts/vsix-releases"
if [ "$PRE_RELEASE" = true ]; then
    # Own name, so it is never mistaken for (or overwritten by) a stable package
    VSIX_FILE="${VSIX_DIR}/${EXTENSION_NAME}-${PACKAGE_VERSION}-pre-release.vsix"
    PRE_RELEASE_FLAG="--pre-release"
else
    VSIX_FILE="${VSIX_DIR}/${EXTENSION_NAME}-${PACKAGE_VERSION}.vsix"
    PRE_RELEASE_FLAG=""
fi

if [ "$CHECKS_PASSED" = false ]; then
    print_error "Some checks failed. Please fix the issues above."
    confirm_or_exit "Continue anyway?"
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
    print_step "Checking VS Code Marketplace authentication (vsce verify-pat ${PUBLISHER})..."
    # vsce 4 may first offer to copy a PAT saved by vsce 3: answer y
    if $VSCE_CMD verify-pat "$PUBLISHER"; then
        print_success "Marketplace token of ${PUBLISHER} is valid"
    else
        print_error "No valid Marketplace token for ${PUBLISHER}: vsce login ${PUBLISHER}"
        print_info "Global Azure DevOps PATs are being retired: see docs/PUBLISHING.md § Marketplace authentication"
        if [ "$DRY_RUN" = true ]; then
            print_warning "Dry run: continuing"
        else
            exit 1
        fi
    fi
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
if [ -d ".git" ] && [ "$DRY_RUN" = false ] && [ -n "$(git status --porcelain)" ]; then
    git status --short
    print_error "npm run lint (eslint --fix) changed files: review and commit them, then run again"
    exit 1
fi
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
        confirm_or_exit "Continue anyway?"
    }
    print_success "Tests passed"
else
    print_warning "Skipping tests (--skip-tests)"
fi

# =============================================================================
# Release date
# =============================================================================

if [ "$RELEASE_DATE_PENDING" = true ]; then
    print_header "Release Date"
    if [ "$DRY_RUN" = true ]; then
        print_info "Would set the date of ## [${PACKAGE_VERSION}] to $(date +%Y-%m-%d), update the links to it and README.md, and commit"
    else
        set_release_date
    fi
fi

# README matches generated documentation (it is packaged)
check_generated_documentation

# =============================================================================
# Package
# =============================================================================

print_header "Packaging"

print_step "Creating .vsix package..."
mkdir -p "$VSIX_DIR"
rm -f "$VSIX_FILE"
$VSCE_CMD package $PRE_RELEASE_FLAG --out "$VSIX_FILE" || {
    print_error "Packaging failed"
    exit 1
}

if [ ! -f "$VSIX_FILE" ]; then
    print_error "Expected package file not found: ${VSIX_FILE}"
    exit 1
fi
print_success "Package created: ${VSIX_FILE}"
print_info "Size: $(du -h "$VSIX_FILE" | cut -f1)"

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
if [ "$PRE_RELEASE" = true ]; then
    echo "Ready to tag ${TAG_NAME} and publish ${VSIX_FILE} as a PRE-RELEASE to:"
else
    echo "Ready to tag ${TAG_NAME} and publish ${VSIX_FILE} to:"
fi
[ "$SKIP_VSCODE" = false ] && echo "  • VS Code Marketplace"
[ "$SKIP_OPENVSX" = false ] && echo "  • Open VSX Registry"
echo ""
if [ "$PRE_RELEASE" = true ]; then
    print_warning "Only users who chose 'Switch to Pre-Release Version' will get it."
    print_warning "Version ${PACKAGE_VERSION} cannot be published again: the stable release"
    print_warning "that follows needs a higher version (bump package.json, e.g. to the next patch)."
    echo ""
fi
confirm_or_exit "Proceed with publishing?"

# Tag: built, tested and packaged; it marks the commit of the published package
if [ -d ".git" ]; then
    if ! git rev-parse -q --verify "refs/tags/${TAG_NAME}" > /dev/null; then
        git tag "${TAG_NAME}"
        print_success "Created tag ${TAG_NAME} at $(git rev-parse --short HEAD)"
    fi
    if [ -n "$CURRENT_BRANCH" ] && [ -n "$(git rev-list "origin/${CURRENT_BRANCH}..HEAD" 2>/dev/null)" ]; then
        print_step "Pushing ${CURRENT_BRANCH} (commits of the release, e.g. its date)..."
        git push origin "HEAD:${CURRENT_BRANCH}" || print_warning "Could not push ${CURRENT_BRANCH}: push it after publishing"
    fi
    if git ls-remote --tags origin | grep -q "refs/tags/${TAG_NAME}$"; then
        print_success "Tag ${TAG_NAME} is on origin"
    else
        git push origin "${TAG_NAME}"
        print_success "Pushed tag ${TAG_NAME} to origin"
    fi
fi

PUBLISH_SUCCESS=true

# Publish to VS Code Marketplace: the package built and tested above, so both
# marketplaces get the same file (a bare `vsce publish` would package again)
if [ "$SKIP_VSCODE" = false ]; then
    print_step "Publishing to VS Code Marketplace..."
    if $VSCE_CMD publish $PRE_RELEASE_FLAG --packagePath "$VSIX_FILE"; then
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
    if $OVSX_CMD publish "$VSIX_FILE" -p "$OPENVSX_TOKEN" $PRE_RELEASE_FLAG; then
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

# Get GitHub repo URL from package.json or git remote
REPO_URL=$(node -p "require('./package.json').repository?.url || ''" 2>/dev/null | sed 's/\.git$//' | sed 's|^git+||')
if [ -z "$REPO_URL" ]; then
    REPO_URL=$(git remote get-url origin 2>/dev/null | sed 's/\.git$//' | sed 's|^git@github.com:|https://github.com/|')
fi

if [ "$PUBLISH_SUCCESS" = true ]; then
    print_success "Publishing completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Verify the extension on the marketplaces"
    echo "  2. Create the GitHub release of tag ${TAG_NAME}:"
    echo "     gh release create ${TAG_NAME} --notes-file ${RELEASE_NOTES_FILE} $PRE_RELEASE_FLAG"
    echo "     (${REPO_URL}/releases/tag/${TAG_NAME})"
    if [ "$PRE_RELEASE" = true ]; then
        echo "  3. Install it in VS Code: Extensions view > Scientific Data Viewer >"
        echo "     'Switch to Pre-Release Version'; watch issues before the stable release"
        echo "  4. Before the stable release, bump package.json above ${PACKAGE_VERSION}"
    fi

    echo ""
    echo "Marketplace URLs:"
    [ "$SKIP_VSCODE" = false ] && echo "  • https://marketplace.visualstudio.com/items?itemName=${PUBLISHER}.${EXTENSION_NAME}"
    [ "$SKIP_OPENVSX" = false ] && echo "  • https://open-vsx.org/extension/${PUBLISHER}/${EXTENSION_NAME}"
else
    print_error "Publishing completed with errors"
    print_info "Tag ${TAG_NAME} is pushed: run ./publish.sh again with --skip-vscode or --skip-openvsx for the one that failed"
    exit 1
fi
