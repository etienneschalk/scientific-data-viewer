# Publishing the extension (`publish.sh`)

This project ships the **Scientific Data Viewer** VS Code extension to the [VS Code Marketplace](https://marketplace.visualstudio.com/) and [Open VSX](https://open-vsx.org/) using a **local** script at the repository root: [`publish.sh`](../publish.sh).

Publishing is intentionally **not** automated in GitHub Actions for day-to-day releases. A **reference-only**, fully commented workflow lives in [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) if you ever want to revive CI-driven publishing.

---

## Prerequisites

| Requirement | Purpose |
|-------------|---------|
| **Node.js** 22+ | Matches `package.json` / CI |
| **npm** | `npm ci`, `vsce`, tests |
| **Python** 3.13+ | Extension runtime / tests |
| **`@vscode/vsce`** | Global or via `npx` — package and VS Code publish |
| **`ovsx`** | Global or via `npx` — Open VSX publish |
| **[GitHub CLI `gh`](https://cli.github.com/)** + `gh auth login` | PR/CI checks, duplicate-release guard, tag + GitHub Release (unless you skip those features) |
| **`vsce login <publisher>`** | VS Code Marketplace PAT (not stored in the script) |
| **`OPENVSX_TOKEN`** | Open VSX personal access token (environment variable) |

Run the script from the **repository root** (where `package.json` lives).

---

## Usage

```bash
./publish.sh                      # Full flow: checks → build → tag + GitHub release → marketplaces
./publish.sh --dry-run            # Build and package a .vsix only; no publish or GitHub release
./publish.sh --skip-tests         # Skip `npm run test` (use sparingly)
./publish.sh --skip-pr-check      # Skip GitHub PR / Actions verification
./publish.sh --skip-github-release # Marketplaces only; no `git tag` / `gh release`
./publish.sh --help               # Print options
```

You can combine flags (for example `--dry-run` with `--skip-pr-check` if you only want a local package without talking to GitHub).

---

## What the script enforces

1. **Version alignment** — `CHANGELOG.md` section for `package.json` version; optional `UNRELEASED` → dated header (with optional git commit). `README.md` must show **Current Version: v…** and link `docs/RELEASE_NOTES_<version>.md`. Release notes file is expected (you can confirm past the warning if missing).
2. **Git hygiene** — Working tree and branch prompts; local/remote tag must match **HEAD** when a tag already exists.
3. **CI / PR** — Unless `--skip-pr-check`, `gh` verifies that GitHub Actions checks are green (via `gh pr checks` and/or the check-runs API on `HEAD`).
4. **No double release** — If **`gh` is installed**, the script **aborts** when **both** a remote tag `vX.Y.Z` **and** a GitHub Release for that tag already exist (bump version and docs, then retry). If `gh` is missing, the script **exits** with an install hint (the duplicate check cannot run safely).
5. **Order of side effects** — After your confirmation, the script creates/pushes the **git tag** and **GitHub Release** (title `X.Y.Z`, notes link to `CHANGELOG.md` at that tag), **then** publishes to the marketplaces so the release exists before store publication.

---

## End-to-end flow (flowchart)

The diagram below is a simplified view of happy-path and major decision points. Many steps can **exit** on failure (`set -e` and explicit `exit 1`).

```mermaid
flowchart TD
    Start([./publish.sh]) --> Args[Parse CLI flags]
    Args --> PF[Pre-flight: package.json, Node/npm/Python, vsce, ovsx, gh if needed]
    PF --> VC[Version checks: CHANGELOG, release notes, README]
    VC --> GIT[Git: status, branch, CI via gh, tag vs HEAD]
    GIT --> DUP{gh installed?}
    DUP -->|no| ExitGh[Exit: install gh for duplicate-release guard]
    DUP -->|yes| DUP2{Origin tag + GitHub release exist?}
    DUP2 -->|yes| ExitDup[Exit: bump version and docs]
    DUP2 -->|no| Gate{CHECKS_PASSED?}
    Gate -->|fail| Prompt1[Prompt: continue anyway?]
    Prompt1 -->|no| Abort1([Abort])
    Prompt1 -->|yes| Auth
    Gate -->|ok| Auth[Auth: OPENVSX_TOKEN, vsce login reminder]
    Auth --> Build[npm ci → lint → compile → test]
    Build --> Pack[vsce package → .vsix]
    Pack --> Dry{Dry run?}
    Dry -->|yes| DoneDry([Exit: package OK])
    Dry -->|no| Ok[Prompt: tag/release + publish?]
    Ok -->|no| Abort2([Abort])
    Ok -->|yes| Rel{Skip GitHub release?}
    Rel -->|no| GH[Push tag vX.Y.Z + gh release create]
    Rel -->|yes| MP
    GH --> MP[vsce publish + ovsx publish]
    MP --> Sum[Summary + URLs]
    Sum --> End([Done])
```

---

## CI / PR verification (flowchart)

When `--skip-pr-check` is **not** set and the repo is a git checkout, `verify_github_ci` picks a strategy based on the current branch and available PRs:

```mermaid
flowchart TD
    A[verify_github_ci] --> S{SKIP_PR_CHECK?}
    S -->|yes| Z[Skip — return]
    S -->|no| G{gh installed and authed?}
    G -->|no| E1[Exit with error]
    G -->|yes| B{Branch main or master?}
    B -->|yes| C[Check-runs API on HEAD commit]
    B -->|no| D{gh pr view current branch?}
    D -->|yes| F[gh pr checks]
    D -->|no| H{Open PR for same head branch?}
    H -->|yes| F
    H -->|no| I{Latest merged PR for head?}
    I -->|yes| F
    I -->|no| J[Warn: no PR — check-runs on HEAD]
    J --> C
    C --> K{All completed and success or neutral or skipped?}
    F --> L{All checks pass?}
    K -->|no| E2[Exit]
    L -->|no| E2
    K -->|yes| OK[Continue]
    L -->|yes| OK
```

---

## Publish phase (sequence diagram)

After **build**, **package**, and (unless dry-run) **confirmation**, interactions with remotes look like this:

```mermaid
sequenceDiagram
    actor Maintainer
    participant Script as publish.sh
    participant Git as git / origin
    participant GH as GitHub API gh
    participant VSM as VS Code Marketplace
    participant OVSX as Open VSX

    Maintainer->>Script: Run script, answer prompts
    loop Preflight through package
        Script->>GH: pr checks / commit check-runs
        GH-->>Script: Pass or fail
        Note over Script: npm ci, lint, compile, test, vsce package
    end
    Maintainer->>Script: Confirm tag, release, and publishing
    alt Not skip-github-release
        Script->>Git: tag vX.Y.Z, push tag
        Script->>GH: release create title X.Y.Z, notes link CHANGELOG
        GH-->>Script: Release URL
    end
    alt Not skip-vscode
        Script->>VSM: vsce publish
        VSM-->>Script: OK / error
    end
    alt Not skip-openvsx
        Script->>OVSX: ovsx publish .vsix + token
        OVSX-->>Script: OK / error
    end
    Script-->>Maintainer: Summary and marketplace links
```

---

## Release naming conventions

| Artifact | Convention |
|----------|------------|
| Git tag | `v` + semver from `package.json` (example: `v0.10.1`) |
| GitHub Release title | Semver **without** `v` (example: `0.10.1`) |
| Release notes body | Single line with a permalink to **`CHANGELOG.md`** at that tag on GitHub |

This matches how releases are presented on the [GitHub Releases](https://github.com/etienneschalk/scientific-data-viewer/releases) page for this repository.

---

## Related documentation

- Per-version write-ups: `docs/RELEASE_NOTES_<version>.md`
- Changelog: `CHANGELOG.md` at the repository root
- Extension packaging reference: [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) (VS Code docs)

---

## Troubleshooting (quick pointers)

| Symptom | Hint |
|---------|------|
| `gh` required / not authenticated | Install from [cli.github.com](https://cli.github.com/), run `gh auth login`, or pass `--skip-pr-check` / `--skip-github-release` where documented above |
| Duplicate release exit | Version is already tagged **and** released on GitHub — increment version and refresh CHANGELOG, README, and release notes |
| Open VSX fails | Ensure `OPENVSX_TOKEN` is exported in the shell running the script |
| VS Code publish fails | Run `vsce login <publisher>` with a valid PAT |

For diagram rendering, use GitHub’s built-in Mermaid support, VS Code preview, or any Markdown viewer that supports Mermaid.
