# 🚀 Automated Extension Publishing

This guide covers how to automatically publish the Scientific Data Viewer extension to the **VS Code Marketplace** and **Open VSX Registry** using GitHub Actions when creating a release.

## Overview

The automated publishing workflow:

1. **Triggers** when you create a GitHub Release with a tag (e.g., `v0.8.0`)
2. **Validates** that the tag version matches `package.json` version
3. **Builds** and tests the extension
4. **Publishes** to both VS Code Marketplace and Open VSX Registry

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Release Workflow                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Create GitHub Release (tag: v0.8.0)                                    │
│              │                                                           │
│              ▼                                                           │
│   ┌─────────────────────────┐                                            │
│   │  Validate version match │  ← Ensures tag matches package.json        │
│   └─────────────────────────┘                                            │
│              │                                                           │
│              ▼                                                           │
│   ┌─────────────────────────┐                                            │
│   │  Build & Test           │  ← Compile TypeScript, run tests           │
│   └─────────────────────────┘                                            │
│              │                                                           │
│         ┌────┴────┐                                                      │
│         ▼         ▼                                                      │
│   ┌───────────┐ ┌───────────┐                                            │
│   │ VS Code   │ │ Open VSX  │                                            │
│   │Marketplace│ │ Registry  │                                            │
│   └───────────┘ └───────────┘                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

Before setting up automated publishing, you need:

### 1. VS Code Marketplace Personal Access Token (PAT)

The VS Code Marketplace uses Azure DevOps for authentication.

#### Create the PAT:

1. Go to [Azure DevOps](https://dev.azure.com)
2. Sign in with the Microsoft account associated with your publisher
3. Click on **User Settings** (gear icon) → **Personal Access Tokens**
4. Click **+ New Token**
5. Configure the token:
   - **Name**: `GitHub Actions - VS Code Publish` (or similar)
   - **Organization**: Select **All accessible organizations**
   - **Expiration**: Choose an appropriate duration (max 1 year)
   - **Scopes**: Click **Show all scopes**, then select:
     - **Marketplace** → **Manage** (full access to publish extensions)
6. Click **Create** and **copy the token immediately** (you won't see it again!)

> ⚠️ **Important**: The organization must be set to "All accessible organizations" for the token to work with the marketplace.

### 2. Open VSX Access Token

Open VSX uses Eclipse accounts for authentication.

#### Create the Token:

1. Go to [open-vsx.org](https://open-vsx.org)
2. Log in with your GitHub account
3. Navigate to your **Profile** → **Settings** → **Access Tokens**
4. Click **Generate New Token**
5. Give it a description (e.g., `GitHub Actions CI`)
6. Click **Generate** and **copy the token immediately**

> 📝 **Note**: If you haven't already, you need to create a namespace matching your publisher name. See [PUBLISHING.md](./PUBLISHING.md) for details.

### 3. Add Secrets to GitHub Repository

Add both tokens as secrets in your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each:

| Secret Name            | Value                      | Description             |
| ---------------------- | -------------------------- | ----------------------- |
| `VS_MARKETPLACE_TOKEN` | Your Azure DevOps PAT      | For VS Code Marketplace |
| `OPEN_VSX_TOKEN`       | Your Open VSX access token | For Open VSX Registry   |

## GitHub Actions Workflow

Create the file `.github/workflows/publish.yml`:

```yaml
name: Publish Extension

# Trigger on GitHub Release publication
on:
  release:
    types: [published]

jobs:
  publish:
    name: Publish Extension
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Set up Python (for tests)
        uses: actions/setup-python@v5
        with:
          python-version: '3.13'

      # Extract version from tag and validate
      - name: Validate Version Match
        run: |
          # Get tag from release event
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          PACKAGE_VERSION=$(node -p "require('./package.json').version")

          echo "Tag version: $TAG_VERSION"
          echo "Package version: $PACKAGE_VERSION"

          if [ "$TAG_VERSION" != "$PACKAGE_VERSION" ]; then
            echo "❌ ERROR: Tag version ($TAG_VERSION) does not match package.json version ($PACKAGE_VERSION)"
            echo "Please ensure the tag matches the version in package.json"
            exit 1
          fi

          echo "✅ Version match confirmed: $PACKAGE_VERSION"

      - name: Install Dependencies
        run: npm ci

      - name: Compile TypeScript
        run: npm run compile

      - name: Install Virtual Display Dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y xvfb

      - name: Run Tests
        run: |
          export DISPLAY=:99
          Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
          sleep 3
          npm run test

      # Publish to Open VSX first (it builds the .vsix)
      - name: Publish to Open VSX Registry
        id: publishToOpenVSX
        uses: HaaLeo/publish-vscode-extension@v2
        with:
          pat: ${{ secrets.OPEN_VSX_TOKEN }}

      # Publish to VS Code Marketplace using the same .vsix
      - name: Publish to VS Code Marketplace
        uses: HaaLeo/publish-vscode-extension@v2
        with:
          pat: ${{ secrets.VS_MARKETPLACE_TOKEN }}
          registryUrl: https://marketplace.visualstudio.com
          extensionFile: ${{ steps.publishToOpenVSX.outputs.vsixPath }}

      # Upload the .vsix as a release asset
      - name: Upload VSIX to Release
        uses: softprops/action-gh-release@v2
        with:
          files: ${{ steps.publishToOpenVSX.outputs.vsixPath }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## How to Create a Release

### Step 1: Update Version

Before creating a release, ensure `package.json` version is updated:

```bash
# For patch release (0.8.0 → 0.8.1)
npm version patch

# For minor release (0.8.0 → 0.9.0)
npm version minor

# For major release (0.8.0 → 1.0.0)
npm version major
```

Or manually edit `package.json` and update the version.

### Step 2: Update CHANGELOG

Document your changes in `CHANGELOG.md`:

```markdown
## [0.8.1] - 2024-12-11

### Added

- New feature X

### Fixed

- Bug fix Y

### Changed

- Improvement Z
```

### Step 3: Commit and Push

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.8.1"
git push origin main
```

### Step 4: Create GitHub Release

#### Option A: Via GitHub Web UI (Recommended)

1. Go to your repository → **Releases** → **Draft a new release**
2. Click **Choose a tag** → Type `v0.8.1` → **Create new tag**
3. Set **Release title**: `v0.8.1` (or a descriptive title)
4. Add release notes (or click **Generate release notes**)
5. Click **Publish release**

#### Option B: Via GitHub CLI

```bash
# Create tag and release
gh release create v0.8.1 \
  --title "v0.8.1" \
  --notes "Release notes here" \
  --generate-notes
```

#### Option C: Via Git Commands

```bash
# Create and push tag
git tag v0.8.1
git push origin v0.8.1

# Then create release via GitHub UI or CLI
```

> 💡 **Tip**: Using `release.published` as trigger (instead of `push.tags`) gives you control—you can create a tag, review it, and only publish when ready.

## Alternative: Tag-Based Trigger

If you prefer to publish on tag push (without creating a GitHub Release):

```yaml
name: Publish Extension

on:
  push:
    tags:
      - 'v*.*.*'
# ... rest of the workflow
```

**Trade-offs:**

| Trigger             | Pros                                     | Cons                                  |
| ------------------- | ---------------------------------------- | ------------------------------------- |
| `release.published` | Full control, can preview before publish | Requires extra step to create release |
| `push.tags`         | Simpler, automatic on tag push           | No preview/draft capability           |

## Best Practices

### 1. Version Consistency

Always ensure these match:

- Tag name: `v0.8.1`
- `package.json` version: `0.8.1`
- CHANGELOG entry: `## [0.8.1]`

The workflow validates tag vs `package.json`, but CHANGELOG is your responsibility.

### 2. Semantic Versioning

Follow [SemVer](https://semver.org/):

- **MAJOR** (`1.0.0`): Breaking changes
- **MINOR** (`0.1.0`): New features, backward compatible
- **PATCH** (`0.0.1`): Bug fixes, backward compatible

### 3. Use Pre-releases for Testing

For beta/preview versions:

```bash
# Create a pre-release
gh release create v0.9.0-beta.1 --prerelease --title "v0.9.0 Beta 1"
```

Update the workflow to skip pre-releases if desired:

```yaml
on:
  release:
    types: [published]

jobs:
  publish:
    # Skip pre-releases
    if: '!github.event.release.prerelease'
    # ...
```

### 4. Pin Action Versions

For security, pin actions to specific versions or SHA:

```yaml
# Good - pinned to major version
uses: actions/checkout@v4

# Better - pinned to specific version
uses: actions/checkout@v4.1.1

# Best - pinned to commit SHA (most secure)
uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
```

### 5. Token Rotation

Regularly rotate your access tokens:

- **Azure DevOps PAT**: Set calendar reminder before expiration
- **Open VSX Token**: Rotate annually or when team changes

## Troubleshooting

### Common Issues

#### "Authentication failed" for VS Code Marketplace

- Verify the PAT has **Marketplace: Manage** scope
- Ensure organization is set to **All accessible organizations**
- Check that the `publisher` in `package.json` matches your Azure DevOps publisher

#### "Namespace not found" for Open VSX

Create the namespace first:

```bash
npx ovsx create-namespace <your-publisher-name> -p $OPEN_VSX_TOKEN
```

#### "Version already exists"

Both registries reject duplicate versions. You must increment the version for each publish.

#### Tests Failing in CI

The extension tests require a display. The workflow includes `xvfb` setup:

```yaml
- name: Install Virtual Display Dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y xvfb

- name: Run Tests
  run: |
    export DISPLAY=:99
    Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
    sleep 3
    npm run test
```

### Checking Workflow Logs

1. Go to **Actions** tab in your repository
2. Click on the failed workflow run
3. Expand the failed step to see detailed logs

## Security Considerations

### Protecting Secrets

- Never commit tokens to the repository
- Use GitHub's encrypted secrets
- Limit secret access to specific workflows if needed

### Workflow Permissions

The workflow uses minimal permissions:

- `contents: read` for checkout
- `contents: write` for uploading release assets (handled by `GITHUB_TOKEN`)

### Dependabot for Action Updates

Enable Dependabot to keep actions updated:

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
```

## Monitoring Publications

### VS Code Marketplace

- **Publisher Portal**: [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
- View download statistics, ratings, and reviews

### Open VSX

- **Extension Page**: `https://open-vsx.org/extension/<publisher>/<extension>`
- View download counts and version history

## Complete Release Checklist

- [ ] All tests pass locally
- [ ] Version bumped in `package.json`
- [ ] CHANGELOG updated with new version section
- [ ] Changes committed and pushed to main
- [ ] Create GitHub Release with tag `vX.Y.Z`
- [ ] Verify workflow completes successfully
- [ ] Check extension appears on both marketplaces
- [ ] Test installing from marketplace

## Resources

### Official Documentation

- [VS Code Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Open VSX Publishing](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
- [GitHub Actions](https://docs.github.com/en/actions)

### Actions Used

- [HaaLeo/publish-vscode-extension](https://github.com/HaaLeo/publish-vscode-extension) - Publishes to both registries
- [actions/checkout](https://github.com/actions/checkout) - Checks out repository
- [actions/setup-node](https://github.com/actions/setup-node) - Sets up Node.js
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release) - Uploads release assets

### Related Documentation

- [PUBLISHING.md](./PUBLISHING.md) - Manual publishing guide
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development setup
- [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md) - CI/CD setup
