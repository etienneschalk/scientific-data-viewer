# Publishing without personal access tokens

**Status: investigation and proposal, 2026-11-19.** Branch `eschalk/publishing-trusted`. Nothing here is live until the trusted publishers are registered and the repository variable `TRUSTED_PUBLISHING` is set (§ [One-time setup](#one-time-setup)).

## TL;DR

- **VS Code Marketplace**: today `publish.sh` logs in with an Azure DevOps global personal access token (PAT). Global PATs stop working on **27 January 2027** (Azure DevOps blog; the VS Code docs still say 1 December 2026). The replacement for a GitHub project is **Trusted Publishing**: a GitHub Actions workflow publishes with `vsce publish --oidc`, and the Marketplace trusts that workflow file instead of a stored secret. No PAT-free way to publish from a laptop exists, apart from uploading the `.vsix` by hand on the publisher page.
- **Open VSX**: its access tokens are **not** being retired. Open VSX added the same kind of trusted publishing on 30 September 2026 (`ovsx publish --trusted-publishing`). Moving to it is optional, but doing both in the same workflow removes the last long-lived token.
- **Proposal**: `./publish.sh --via-github` keeps everything `publish.sh` does locally (checks, build, tests, release date, tag), then creates the GitHub release. The new workflow `.github/workflows/release.yml` builds that tag again in a clean runner, tests it, and publishes the one `.vsix` it built to both registries, then attaches it to the release. The current local path stays the default until the first release through the workflow succeeds.
- **Deadline**: the release that follows 27 January 2027 cannot use the local Marketplace path. Validate the workflow with a release before then (0.13.1, or a pre-release).

## Timeline and sources

| Date       | Event                                                                                                                                                                                                                                                     | Source                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-03-05 | Azure DevOps cancels the block on creating new global PATs (planned for 15 March)                                                                                                                                                                         | [Azure DevOps blog](https://devblogs.microsoft.com/devops/retirement-of-global-personal-access-tokens-in-azure-devops) |
| 2026-09-30 | Open VSX announces trusted publishing for GitHub Actions                                                                                                                                                                                                  | [Eclipse blog](https://blogs.eclipse.org/post/tamas-cservenak/trusted-publishing-open-vsx)                             |
| 2026-10-23 | Azure DevOps postpones the end of global PATs from 1 December 2026 to **27 January 2027** ("to avoid disruption during the December holiday season"). The post does not mention the Marketplace                                                           | [Azure DevOps blog](https://devblogs.microsoft.com/devops/retirement-of-global-personal-access-tokens-in-azure-devops) |
| 2026-11-09 | Dart-Code publishes pre-releases to both registries from GitHub Actions with `vsce publish --oidc` and Open VSX trusted publishing (first-hand report that the Marketplace side works)                                                                    | [Dart-Code#6152](https://github.com/Dart-Code/Dart-Code/issues/6152)                                                   |
| 2026-11-19 | VS Code "Publishing Extensions" page: global PATs "are retired" on 1 December 2026; PAT publishing is "Not Recommended"; documents Trusted Publishing (GitHub Actions only) and Microsoft Entra ID (Azure Pipelines)                                      | [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)                |
| 2026-11-19 | Tool versions: `@vscode/vsce` 4.1.0 is the first with `--oidc` (latest 4.1.1; the repository's devDependency is `^4.1.0`). `ovsx` 1.2.0 is the first with `--trusted-publishing` (latest 1.4.0; the global `ovsx` on the maintainer's machine is 0.10.10) | `npx @vscode/vsce@<v> publish --help`, `npx ovsx@<v> publish --help`                                                   |
| 2026-11-19 | Open VSX namespace `eschalk0` is **verified** and has published versions, which trusted publishing requires                                                                                                                                               | `https://open-vsx.org/api/eschalk0`                                                                                    |

The two Microsoft dates disagree. Plan for the earlier one (1 December 2026) and treat 27 January 2027 as the last day the local path can work.

## Options

| Option                                                                          | Marketplace                                                                                                                                                                                                                                                   | Open VSX                                       | Verdict                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| **Global PAT, local `publish.sh`** (today)                                      | Works until the retirement date (`vsce verify-pat eschalk0` OK on 2026-11-13)                                                                                                                                                                                 | `OPENVSX_TOKEN`, not concerned                 | Fallback until 27 January 2027, then gone                     |
| **Organization-scoped PAT**                                                     | Not expected to work: Marketplace publishing has always required a PAT for _All accessible organizations_, and nothing documents a scoped one. Dart-Code considered it and moved on                                                                           | —                                              | Not pursued                                                   |
| **Trusted Publishing from GitHub Actions** (`vsce publish --oidc`)              | Documented by Microsoft, no stored secret, credential valid 15 minutes, one exchange per GitHub ID token. Policy per publisher: owner, repository, workflow file name, optional environment                                                                   | `ovsx publish --trusted-publishing`, same idea | **Recommended**                                               |
| **Microsoft Entra ID from Azure Pipelines** (`vsce publish --azure-credential`) | Documented, needs an Azure subscription, a user-assigned managed identity, a federated Azure DevOps service connection and an Azure Pipeline                                                                                                                  | —                                              | Too heavy for a GitHub project with one maintainer            |
| **Entra ID from GitHub Actions** (`azure/login` + `--azure-credential`)         | Community pattern, not documented by Microsoft. One report has `verify-pat` passing and publishing failing with a federated service principal ([classmethod.jp](https://dev.classmethod.jp/en/articles/publish-vscode-extension-ci-marketplace-openvsx-npm/)) | —                                              | Not pursued: Trusted Publishing does the same with less setup |
| **Upload the `.vsix` by hand** on the Marketplace publisher page                | Works without any token (sign-in with the Microsoft account)                                                                                                                                                                                                  | Open VSX token, or its web UI                  | Emergency fallback only                                       |

## Proposed design

```
local machine                                        GitHub
─────────────                                        ──────
./publish.sh --via-github
  checks: main, clean, CHANGELOG, release notes,
          tag free, gh logged in, release absent,
          TRUSTED_PUBLISHING=true
  npm ci, lint, compile, npm test                     (local gate, unchanged)
  release date commit (UNRELEASED -> today)
  vsce package (local copy, not published)
  tag v<ver>, push main + tag
  gh release create v<ver> [--prerelease] ───────▶  release: published
                                                     release.yml
                                                       build    checkout tag; tag == package.json,
                                                                on main, CHANGELOG dated, notes exist;
                                                                README check, lint, compile, pytest,
                                                                npm test (Xvfb), vsce package
                                                       publish  environment "release" (reviewer)
                                                                id-token: write
                                                                vsce publish --oidc --packagePath
                                                                ovsx publish --trusted-publishing
                                                       attach   gh release upload <vsix>
```

Choices:

- **The workflow builds the package**, from the tag, rather than publishing a `.vsix` built on the maintainer's machine. The registries trust the workflow, so what it publishes should come from the repository and not from a file anyone with release rights could upload. The local build and tests stay as a gate before anything is tagged, and the published file is attached to the GitHub release, so the "one `.vsix` for both stores" rule of `publish.sh` still holds.
- **Triggered by the GitHub release**, which `publish.sh` already told the maintainer to create by hand. The release's _pre-release_ flag decides the channel, so no second switch can disagree with it. `workflow_dispatch` with a `tag` input runs a failed release again; `--skip-duplicate` makes the registry that already succeeded a no-op.
- **Environment `release`** in both registrations. A required reviewer on it (the maintainer) gives a last approval before the publish job, which matters because neither registry ties the registration to a branch or a tag: anyone able to run `release.yml` could publish.
- **Off by default** (`vars.TRUSTED_PUBLISHING`), so merging the workflow changes nothing until the registrations exist. `publish.sh --via-github` refuses to tag while the variable is not `true`.
- **Local path kept**: `./publish.sh` without the flag still publishes with the PAT and `OPENVSX_TOKEN`, as the fallback while the workflow is new. Its `--skip-vscode` / `--skip-openvsx` do not apply to `--via-github` (run the workflow again instead).

Not reused from `draft/automated-publishing` (March 2026, PR #113): it published with stored PATs through `HaaLeo/publish-vscode-extension`, and packaged twice. Its ideas that remain useful (version check against the tag, release-triggered workflow, attaching the `.vsix`) are in `release.yml`. PR #113 can be closed and the branch deleted.

## One-time setup

1. **Marketplace policy**: sign in to the [publisher management page](https://marketplace.visualstudio.com/manage/publishers/eschalk0) → **Trusted Publishing** → **Create**: owner `etienneschalk`, repository `scientific-data-viewer`, workflow `release.yml`, environment `release`.
2. **Open VSX registration**: [open-vsx.org](https://open-vsx.org) → **Settings** → **Trusted Publishers** → namespace `eschalk0` → GitHub Actions: owner `etienneschalk`, repository `scientific-data-viewer`, workflow `release.yml`, environment `release`. Only a namespace owner can do this; registrations cannot be edited, only deleted and created again.
3. **GitHub environment**: repository **Settings** → **Environments** → **New environment** `release` → **Required reviewers**: yourself. Optionally **Deployment branches and tags**: tags `v*`.
4. **Tag ruleset** (optional): **Settings** → **Rules** → **Rulesets** → restrict creation of `v*` tags to the maintainer.
5. **GitHub CLI**: `gh auth login` on the publishing machine.
6. **Switch on**: `gh variable set TRUSTED_PUBLISHING --body true`.

## Validation plan

1. Register (steps 1–6) and merge this branch into `main`.
2. Publish the next release with `./publish.sh --via-github` (`--dry-run` first). Approve the publish job; check both listings, the "trusted publisher" mark on Open VSX, and the `.vsix` attached to the GitHub release.
3. If the Marketplace step fails, the tag is pushed and the release exists: fix the cause (policy fields, environment name) and run `gh workflow run release.yml -f tag=v<ver>`. Until 27 January 2027, `./publish.sh --skip-openvsx` still publishes the same version from the local machine.
4. After a successful release: make `--via-github` the default of `publish.sh` (the local path behind `--local`), run `vsce logout eschalk0`, revoke the Open VSX access token, and remove `OPENVSX_TOKEN` from the shell profile. Update `docs/PUBLISHING.md` and this page.
5. After 27 January 2027: remove the local Marketplace path, or keep it only for a manual `.vsix` upload.

## Risks and limitations

- **Workflow file name and environment are part of the trust**: renaming `release.yml` or the environment breaks publishing until both registrations are created again.
- **GitHub only**: neither registry supports other OIDC providers yet (Open VSX announces GitLab).
- **The workflow runs the tests again** (about 10 minutes): a failure there after the tag is pushed leaves a tag without a published version. Fix on `main`, bump the version, and release again; or delete the tag and release if nothing was published.
- **Open VSX first versions**: a brand-new extension still needs a token for its first version. Not an issue here (versions exist).
- **Microsoft's documentation is still moving**: the retirement date differs between the VS Code and Azure DevOps pages. Recheck both before the release that relies on the workflow, and record the date in `docs/PUBLISHING.md` § Marketplace authentication.

## When merging

This branch starts from `main` after 0.13.0, outside a release. When it is merged into a release branch, add the entry to that release's `CHANGELOG.md` (section _Development_ or _Changed_), release notes (upgrade note for the maintainer only: users are not affected) and PR summary commit list, as `CLAUDE.md` asks.
