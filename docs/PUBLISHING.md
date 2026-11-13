# 📦 Publishing Guide - Scientific Data Viewer

This guide covers the complete process of publishing the Scientific Data Viewer VSCode extension to the VS Code Marketplace and Open VSX. **`./publish.sh` is the way to publish**: it runs the checks, builds, tests, tags and publishes one `.vsix` to both marketplaces. The manual commands at the end are a fallback.

> **⚠ The Marketplace login is changing.** Azure DevOps is retiring global personal access tokens (PATs), the kind `vsce login` has used so far. Check [§ Marketplace authentication](#marketplace-authentication-check-before-each-release) before each release: this procedure may need to be updated.

## Overview

### Preparing for Publication

1. **Update version** in `package.json`.
2. **Update CHANGELOG.md** with new features and fixes, under the heading `## [<version>] - UNRELEASED`. Never write the date by hand: `publish.sh` writes the day of publishing.
3. **Python requirements changed?** If existing users' uv environments must change (new/changed entry in `ALL_REQUIREMENTS` or `ENVIRONMENT_CONSTRAINTS`, or to force newer packages), bump `ENVIRONMENT_REVISION` in `src/python/ExtensionVirtualEnvironmentManager.ts` and add a line to its history comment. Users with `useExtensionOwnEnvironment` then get their environment deleted and rebuilt once at their next start.
4. **Test the upgrade from the previous release**: `npm run package`, then `scripts/upgrade-sandbox.sh --old artefacts/vsix-releases/scientific-data-viewer-<previous>.vsix` (`scripts/release-vsix.sh <previous>` rebuilds it from its tag); `./paranoia.sh --full` runs every check, this one included (and `--scenario offline`, `--scenario interrupted` when the environment changed). See `docs/v0.13/UPGRADE_TEST_PLAN.md`.
5. **Write the release docs**: `docs/RELEASE_NOTES_<ver>.md` (read by `publish.sh` and linked from the README) and the PR summary in `docs/v<major.minor>/`, whose commit list each commit extends with its own subject (`CLAUDE.md`).
6. **Test thoroughly**: `./paranoia.sh --full` must say `READY` or `READY AFTER REVIEW` on the commit you publish, plus the manual test plan of the release.
7. **Update documentation** if needed (then `python scripts/generate_readme.py --no-timestamp`, with Node 22 for its prettier pass).
8. **Merge the release branch into `main`**, then `git switch main && git pull`. Publish from `main` only: the tag marks a commit of `main`.

### Publishing with `publish.sh`

```bash
nvm use                       # Node 22
vsce verify-pat eschalk0      # Marketplace login still valid (see § Marketplace authentication)
./publish.sh --dry-run        # everything but commit, tag, push and publish
./publish.sh                  # or ./publish.sh --pre-release
```

What it does, in this order (nothing is committed, tagged or pushed before the build and tests pass):

1. **Checks**: Node ≥ 22, Python ≥ 3.13 (`.venv`), vsce ≥ 4, ovsx; CHANGELOG section of the version (`UNRELEASED`, or dated today) and release notes; clean working tree (required); on `main` and not behind `origin/main`; tag `v<version>` absent (or at HEAD, from an interrupted run); `OPENVSX_TOKEN` set; `vsce verify-pat <publisher>`.
2. **Build and test**: `npm ci`, `npm run lint` (fails if `eslint --fix` changed files), `npm run compile`, `npm test` (`ELECTRON_RUN_AS_NODE` is unset first, as in `paranoia.sh`, so it also works from a VS Code terminal).
3. **Release date**: `UNRELEASED` in the CHANGELOG heading becomes today's date; the links to that section (`#0130---unreleased` in the release notes and other docs) and the README follow; the commit subject is added to the PR summary commit list; one commit, after confirmation.
4. **README check**: `README.md` must match `scripts/generate_readme.py` (it is packaged).
5. **Package**: `artefacts/vsix-releases/<name>-<version>.vsix` (`-pre-release.vsix` with `--pre-release`).
6. **Tag and push**, after a last confirmation: tag `v<version>` on HEAD, push `main` if it has the date commit, push the tag.
7. **Publish that same `.vsix`** to the VS Code Marketplace (`vsce publish --packagePath`) and Open VSX (`ovsx publish <vsix>`). If one fails, run again with `--skip-vscode` or `--skip-openvsx`: the tag at HEAD is reused.
8. **GitHub release**: printed command, `gh release create v<version> --notes-file docs/RELEASE_NOTES_<version>.md`.

Options: `--dry-run`, `--pre-release`, `--skip-tests`, `--skip-vscode`, `--skip-openvsx` (`./publish.sh --help`).

### Pre-release

`./publish.sh --pre-release` runs the same checks, builds and tests, then publishes to the **pre-release channel** of the VS Code Marketplace and Open VSX. Only users who clicked **Switch to Pre-Release Version** on the extension page get it; everyone else stays on the last stable release. Use it when a release changes something that can only be fully tested on users' machines (e.g. a rebuild of the uv environment, `ENVIRONMENT_REVISION`).

- The package is built with `vsce package --pre-release` (the pre-release marker is written into the `.vsix` manifest) as `artefacts/vsix-releases/<name>-<version>-pre-release.vsix`, and that same file is published to both marketplaces (`vsce publish --pre-release --packagePath …`, `ovsx publish … --pre-release`).
- The version stays plain `major.minor.patch`: the marketplaces reject `0.13.0-rc.1`, and `publish.sh` refuses it.
- **A version number is used up once published**, pre-release or not: the stable release that follows needs a higher one. After `0.13.0` as a pre-release, bump `package.json` to `0.13.1`, add its CHANGELOG section (`UNRELEASED`) and release notes, and run `./publish.sh` without the flag.
- Pre-release users are offered the stable release when it has a higher version, so they come back to the stable channel automatically.
- On GitHub, mark the release as a pre-release (`gh release create v<version> --notes-file docs/RELEASE_NOTES_<version>.md --prerelease`, or `gh release edit v<version> --prerelease`).
- `./publish.sh --pre-release --dry-run` builds the pre-release package without publishing it.
- The pre-release and the stable release that follows both need a valid Marketplace login: mind the PAT retirement dates below when planning the gap between them.

## Marketplace authentication (check before each release)

**Status as of 2026-11-13: this procedure may need to be updated.** `publish.sh` and the steps below log in to the VS Code Marketplace with an Azure DevOps **personal access token** (`vsce login <publisher>`, scope _Marketplace (Manage)_, organization _All accessible organizations_). That is a **global PAT**, and Azure DevOps is retiring them:

- The VS Code publishing documentation says: "On December 1, 2026, global Personal Access Tokens (PATs) in Azure DevOps are retired", and now labels PAT publishing "Not Recommended" ([Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)).
- The Azure DevOps blog post on the retirement says, in its update of 23 October, that the date was postponed "to avoid disruption during the December holiday season": existing global PATs stop working after **27 January 2027**. Its update of 5 March cancelled the block on creating new global PATs. The post does not mention the Marketplace or `vsce` ([Retirement of Global Personal Access Tokens in Azure DevOps](https://devblogs.microsoft.com/devops/retirement-of-global-personal-access-tokens-in-azure-devops)).

What this means here:

- Until one of those dates, `vsce login` with the existing PAT works: `vsce verify-pat eschalk0` said so on 2026-11-13, and `publish.sh` runs that check before building.
- After it, publishing from this machine with a PAT may fail. The replacements the VS Code documentation describes are **Trusted Publishing** from GitHub Actions (OpenID Connect, `npx @vscode/vsce publish --oidc`, no stored secret) and **Microsoft Entra ID** from Azure Pipelines (`vsce publish --azure-credential`, vsce ≥ 2.26.1). Neither is set up for this repository yet: moving to one means a release workflow in `.github/workflows/` and changes to `publish.sh` (it would build, check and tag here, and the workflow would publish). Before relying on it, check the current state of the VS Code documentation: a third-party report describes `--azure-credential` with a federated service principal passing `verify-pat` and then failing at publish ([classmethod.jp, 2026](https://dev.classmethod.jp/en/articles/publish-vscode-extension-ci-marketplace-openvsx-npm/)).
- **Open VSX** uses its own access token (`OPENVSX_TOKEN`) and is not concerned by this change.
- **vsce 4 keeps tokens in a new credential store.** A token saved with vsce 3 is not lost: the first vsce 4 command that needs it, in an interactive terminal, asks _"A saved PAT for publisher 'eschalk0' was found in the previous credential store. Copy it to the new store? [y/N]"_: answer `y` (run `vsce verify-pat eschalk0` once after upgrading vsce).

Update this section when the login method changes, with the date and the sources.

### Publishing to Open VSX (for Cursor and other editors)

`publish.sh` publishes to Open VSX too, so Cursor, VSCodium and other VS Code-compatible editors get the extension. It needs:

1. **Create Eclipse account** and sign Publisher Agreement at [open-vsx.org](https://open-vsx.org)
2. **Generate access token** from your Open VSX profile
3. **Set environment variable**: `export OPENVSX_TOKEN=your_token_here`

See [§ Publishing to Open VSX](#publishing-to-open-vsx-for-cursor-and-other-editors-1) below for details.

## Prerequisites

### 1. Azure DevOps Account

You need an Azure DevOps account to publish extensions to the VSCode marketplace:

1. **Create account**: Go to [Azure DevOps](https://dev.azure.com)
2. **Create organization**: Set up a new organization
3. **Create publisher**: Create a publisher identity for your extensions

### 2. Personal Access Token

_Reference: [https://code.visualstudio.com/ - Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension). Read [§ Marketplace authentication](#marketplace-authentication-check-before-each-release) first: global PATs are being retired._

Create a Personal Access Token (PAT) for authentication:

1. **Go to User Settings** → **Personal Access Tokens**
2. **Create new token** with these scopes:
   - **Organization**: All accessible organizations
   - **Marketplace**: Manage
   - **Duration**: as long as allowed, and not past the retirement of global PATs
3. **Save the token** securely (you won't see it again)
4. **Log in**: `vsce login eschalk0`, paste the token; check with `vsce verify-pat eschalk0`

### 3. Install vsce and ovsx

```bash
npm install -g @vscode/vsce@4   # same major version as the devDependency; `vsce` (unscoped) is the old, deprecated package
npm install -g ovsx
```

`publish.sh` uses the global `vsce` (or `npx @vscode/vsce`) and refuses a version below 4.

## Pre-Publication Checklist

### 1. Code Quality

- [ ] **`./paranoia.sh --full`** says `READY` or `READY AFTER REVIEW` on the commit to publish (tests, lint, typecheck, package audit, QA harnesses, upgrade scenarios: `docs/DEVELOPMENT.md` § Paranoia)
- [ ] **No console.log statements** in production code
- [ ] **Error handling** is comprehensive
- [ ] **Performance** is acceptable for large files

### 2. Documentation

- [ ] **README.md** is regenerated (`scripts/generate_readme.py --no-timestamp`) and accurate
- [ ] **CHANGELOG.md** is up to date, heading `## [<version>] - UNRELEASED`
- [ ] **Release notes** `docs/RELEASE_NOTES_<version>.md` and PR summary (commit list complete)
- [ ] **Screenshots** (`npm run screenshots`, `docs/SCREENSHOTS.md`)

### 3. Package Configuration

- [ ] **package.json** is properly configured
- [ ] **Version number** is correct
- [ ] **Publisher name** is set correctly
- [ ] **Display name** and description are appropriate
- [ ] **Keywords** are relevant and helpful
- [ ] **Categories** are correctly assigned
- [ ] **Repository URL** is valid
- [ ] **License** is specified
- [ ] **Package contents**: `npx vsce ls` lists the runtime files only (`.vscodeignore`, `CLAUDE.md`)

### 4. Testing

- [ ] **Tested on multiple platforms** (Windows, macOS, Linux)
- [ ] **Tested with various file types** and sizes
- [ ] **Tested with different Python environments**
- [ ] **Error scenarios** are handled gracefully
- [ ] **Performance** is acceptable
- [ ] **User experience** is smooth
- [ ] **The `.vsix` installed in a real VS Code** (`code --install-extension artefacts/vsix-releases/<name>-<version>.vsix`), not only F5

## Publishing to Open VSX (for Cursor and other editors)

Open VSX is an open-source alternative to the VSCode Marketplace that's used by editors like Cursor, VSCodium, and others. Publishing to Open VSX ensures your extension is available to a broader audience.

### Prerequisites for Open VSX

#### 1. Eclipse Account

1. **Create account**: Go to [Eclipse.org](https://accounts.eclipse.org/user/register)
2. **Fill in GitHub Username**: Use exactly the same GitHub account as when you log in to open-vsx.org
3. **Verify email**: Complete the email verification process

#### 2. Publisher Agreement

1. **Log in to open-vsx.org**: Click on the account icon → authorize with GitHub
2. **Navigate to Profile**: Click on your avatar → Settings
3. **Sign Publisher Agreement**: Click "Log in with Eclipse" → authorize → "Show Publisher Agreement" → "Agree"

#### 3. Create Access Token

1. **Go to Access Tokens**: Profile → Settings → Access Tokens
2. **Generate New Token**: Enter description (e.g., "Local Machine", "CI Build")
3. **Copy token value**: Save securely - it won't be shown again
4. **Set environment variable**: `export OPENVSX_TOKEN=your_token_here`

### Open VSX Publishing Process

#### 1. Create Namespace (First Time Only)

```bash
# Create namespace for your publisher
npx ovsx create-namespace <publisher-name> -p $OPENVSX_TOKEN
```

#### 2. Publish Extension

`./publish.sh` publishes the `.vsix` it built to Open VSX. To publish only there (e.g. after an Open VSX failure): `./publish.sh --skip-vscode`. By hand, publish the packaged file, never a fresh build:

```bash
ovsx publish artefacts/vsix-releases/scientific-data-viewer-<version>.vsix -p $OPENVSX_TOKEN
```

Avoid `npm run openvsx-publish`: it packages the working tree again, without the checks of `publish.sh`.

#### 3. Verify Publication

1. **Check open-vsx.org**: Visit [open-vsx.org](https://open-vsx.org)
2. **Search for your extension**: Look for "Scientific Data Viewer"
3. **Verify details**: Check all information is correct
4. **Test in Cursor**: Install from Open VSX and test functionality

### Open VSX vs VSCode Marketplace

| Feature              | VSCode Marketplace     | Open VSX                        |
| -------------------- | ---------------------- | ------------------------------- |
| **Primary Users**    | VSCode users           | Cursor, VSCodium, other editors |
| **Account Required** | Azure DevOps           | Eclipse.org                     |
| **Publishing Tool**  | `vsce`                 | `ovsx`                          |
| **Token Type**       | Personal Access Token  | Open VSX Access Token           |
| **Verification**     | Publisher verification | Namespace ownership             |

### Benefits of Open VSX Publishing

- **Broader Reach**: Available to Cursor, VSCodium, and other VSCode-compatible editors
- **Open Source**: Community-driven alternative to Microsoft's marketplace
- **No Vendor Lock-in**: Independent of Microsoft's ecosystem
- **Free Publishing**: No fees or restrictions
- **Easy Migration**: Same package format as VSCode Marketplace

## Manual Publishing (fallback)

Only if `publish.sh` cannot run. Follow the same order: nothing is tagged before the package is built and tested, and both marketplaces get the same file.

```bash
git switch main && git pull                 # release branch merged, clean tree
nvm use && npm ci && npm run lint && npm run compile
env -u ELECTRON_RUN_AS_NODE npm test
# CHANGELOG heading: UNRELEASED -> today's date; update the links to
# #<ver>---unreleased (release notes); python scripts/generate_readme.py --no-timestamp; commit
npm run package                             # -> artefacts/vsix-releases/scientific-data-viewer-<version>.vsix
code --install-extension artefacts/vsix-releases/scientific-data-viewer-<version>.vsix   # try it
git tag v<version> && git push origin main v<version>
vsce publish --packagePath artefacts/vsix-releases/scientific-data-viewer-<version>.vsix
ovsx publish artefacts/vsix-releases/scientific-data-viewer-<version>.vsix -p $OPENVSX_TOKEN
gh release create v<version> --notes-file docs/RELEASE_NOTES_<version>.md
```

Avoid `npm run publish` / a bare `vsce publish` and `npm version`: the first packages the working tree again (a different file from the one tested), the second makes its own commit and tag.

### Verify Publication

1. **Check marketplace**: Visit [VSCode Marketplace](https://marketplace.visualstudio.com/)
2. **Search for your extension**: Look for "Scientific Data Viewer"
3. **Verify details**: Check all information is correct
4. **Test installation**: Install from marketplace and test

## Post-Publication

### 1. Monitor and Respond

- **Check reviews** and ratings
- **Respond to issues** promptly
- **Monitor download statistics**
- **Gather user feedback**

### 2. Update Process

For future updates: bump `package.json`, add a `## [<version>] - UNRELEASED` section to the CHANGELOG and the release notes, run `./paranoia.sh --full`, merge into `main`, then `./publish.sh` ([§ Publishing with `publish.sh`](#publishing-with-publishsh)).

### 3. Marketing and Promotion

- **Announce on social media**
- **Share in relevant communities**
- **Write blog posts** about the extension
- **Submit to extension galleries**
- **Ask for reviews** from users

## Troubleshooting

### Common Issues

#### Authentication Errors

```bash
vsce verify-pat eschalk0      # is the stored token valid?
vsce logout eschalk0
vsce login eschalk0           # paste a new PAT
```

A token that stops working around the retirement dates of global PATs is not a typo: see [§ Marketplace authentication](#marketplace-authentication-check-before-each-release). After upgrading vsce from 3 to 4, answer `y` when it offers to copy the saved PAT.

#### Package Errors

```bash
# List the files the .vsix will contain (80 files: CLAUDE.md, .vscodeignore)
npx vsce ls

# Build the package without publishing
./publish.sh --dry-run
```

#### publish.sh stopped half-way

- **Before "Tag and push"**: nothing was committed except, maybe, the release date commit (local). Fix the cause and run it again.
- **After the tag, a marketplace failed**: run it again with `--skip-vscode` or `--skip-openvsx` for the one that succeeded; the tag at HEAD is reused.
- **Tag pushed, nothing published, and a new commit is needed**: delete the tag (`git tag -d v<version> && git push origin :refs/tags/v<version>`), commit, run again.

#### Publishing Errors

- **Check internet connection**
- **Verify token permissions**
- **Check for duplicate names**
- **Review error messages**

### Error Messages

#### "Extension with same name already exists"

- **Change display name** in package.json
- **Check for existing extensions** with similar names
- **Use unique identifier**

#### "Invalid publisher"

- **Verify publisher name** in package.json
- **Check Azure DevOps** publisher settings
- **Ensure publisher exists**

#### "Package validation failed"

- **Check package.json** for required fields
- **Verify file structure**
- **Check for missing dependencies**

## Best Practices

### 1. Version Management

- **Use semantic versioning** (MAJOR.MINOR.PATCH)
- **Update CHANGELOG.md** for each release
- **Test thoroughly** before publishing
- **Increment version** appropriately

### 2. Quality Assurance

- **Automated testing** before publication
- **Manual testing** on multiple platforms
- **Performance testing** with large files
- **User acceptance testing**

### 3. Documentation

- **Keep README.md** up to date
- **Document breaking changes**
- **Provide migration guides**
- **Include troubleshooting sections**

### 4. User Experience

- **Clear error messages**
- **Helpful tooltips** and descriptions
- **Intuitive user interface**
- **Good performance**

## Security Considerations

### 1. Code Security

- **No hardcoded secrets** or API keys
- **Validate all inputs**
- **Handle errors securely**
- **Use secure coding practices**

### 2. User Data

- **Don't collect unnecessary data**
- **Handle user files securely**
- **Respect user privacy**
- **Follow data protection regulations**

### 3. Dependencies

- **Keep dependencies updated**
- **Check for security vulnerabilities**
- **Use trusted packages**
- **Minimize attack surface**

## Legal Considerations

### 1. Licensing

- **Choose appropriate license** (MIT recommended)
- **Include license file**
- **Respect third-party licenses**
- **Document license requirements**

### 2. Trademarks

- **Don't use trademarked names**
- **Check for conflicts**
- **Use original branding**
- **Respect intellectual property**

### 3. Privacy

- **Privacy policy** if collecting data
- **GDPR compliance** if applicable
- **Data handling** transparency
- **User consent** for data collection

## Analytics and Monitoring

### 1. Extension Analytics

- **Monitor download counts**
- **Track user ratings**
- **Analyze user feedback**
- **Identify popular features**

### 2. Performance Monitoring

- **Monitor extension performance**
- **Track error rates**
- **Identify bottlenecks**
- **Optimize based on data**

### 3. User Feedback

- **Respond to reviews**
- **Address user concerns**
- **Implement requested features**
- **Maintain good reputation**

## Support and Maintenance

### 1. User Support

- **Respond to issues** promptly
- **Provide helpful documentation**
- **Create troubleshooting guides**
- **Maintain community presence**

### 2. Regular Updates

- **Fix bugs** quickly
- **Add new features** regularly
- **Improve performance**
- **Stay compatible** with VSCode updates

### 3. Long-term Maintenance

- **Plan for long-term support**
- **Consider maintenance burden**
- **Document maintenance procedures**
- **Plan for handover** if needed

## Resources

### Official Documentation

- [VSCode Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce Documentation](https://github.com/Microsoft/vscode-vsce)
- [Azure DevOps](https://dev.azure.com)

### Community Resources

- [VSCode Extension Samples](https://github.com/Microsoft/vscode-extension-samples)
- [Extension Guidelines](https://code.visualstudio.com/api/extension-guides/overview)
- [Marketplace Guidelines](https://code.visualstudio.com/api/references/extension-manifest)

### Tools

- [vsce CLI](https://github.com/Microsoft/vscode-vsce)
- [Extension Pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-extension-pack)
- [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
