# GitHub Actions Setup for Pre-commit Integration

This document describes the GitHub Actions workflows configured to run pre-commit checks on pull requests and pushes, implementing comprehensive code formatting standardization.

## Workflows Overview

### 1. Pre-commit Workflow (`.github/workflows/pre-commit.yml`)

**Triggers**: Pull requests and pushes to main/develop branches
**Purpose**: Runs pre-commit hooks on all files

**Features**:

- Runs pre-commit on all files with verbose output
- Includes TypeScript compilation check
- Includes Python-specific checks
- 10-minute timeout per job

### 2. Continuous Integration (`.github/workflows/ci.yml`)

**Triggers**: Pull requests and pushes to main/develop branches
**Purpose**: Comprehensive CI pipeline

**Features**:

- Lint and format checks
- Build and test with multiple Node.js versions (20, 22)
- Security scanning
- Extension packaging
- 15-minute timeout for build jobs

### 3. Pull Request Validation (`.github/workflows/pr-validation.yml`)

**Triggers**: Pull request events (opened, synchronized, reopened, ready for review)
**Purpose**: Focused PR validation

**Features**:

- Validates only changed files
- Checks code formatting
- Runs security checks
- TypeScript compilation
- ESLint validation
- Test execution

## Workflow Features

### Pre-commit Integration

All workflows use the `pre-commit/action@v3.0.1` action which:

- Automatically installs pre-commit
- Runs all configured hooks
- Provides detailed output
- Supports both `--all-files` and changed-files-only modes

### Multi-Environment Testing

- **Node.js versions**: 20, 22 (latest LTS and current)
- **Python version**: 3.13
- **Operating System**: Ubuntu Latest

### Security Features

- npm audit for dependency vulnerabilities
- detect-secrets for secret scanning
- Large file detection
- Merge conflict detection

### Performance Optimizations

- Concurrency groups to cancel redundant runs
- Caching for Node.js dependencies
- Timeout limits to prevent hanging jobs
- Matrix strategy for efficient parallel testing

## Workflow Triggers

### Pre-commit Workflow

```yaml
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]
  workflow_dispatch:
```

### CI Workflow

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:
```

### PR Validation

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
    branches: [main, develop]
```

## Pre-commit Hooks in CI

The workflows run all configured pre-commit hooks:

1. **Prettier** - TypeScript/JavaScript/JSON/Markdown formatting
2. **ESLint** - TypeScript/JavaScript linting with auto-fix
3. **TypeScript Check** - Type checking without compilation
4. **Ruff** - Python linting and formatting
5. **File Checks** - Trailing whitespace, end-of-file, YAML/JSON validation
6. **Security** - Secret detection and large file checks

## Usage

### Automatic Execution

- Workflows run automatically on pull requests and pushes
- No manual intervention required
- Results are displayed in the GitHub UI

### Manual Execution

- Use `workflow_dispatch` trigger for manual runs
- Available in GitHub Actions tab

### Local Testing

Before pushing, developers can run:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run on all files
pre-commit run --all-files

# Run on changed files only
pre-commit run
```

## Configuration Files

### Pre-commit Configuration

- `.pre-commit-config.yaml` - Main pre-commit configuration
- `pyproject.toml` - Ruff configuration for Python
- `.secrets.baseline` - Security scanning baseline

### GitHub Actions

- `.github/workflows/pre-commit.yml` - Pre-commit workflow
- `.github/workflows/ci.yml` - Continuous integration
- `.github/workflows/pr-validation.yml` - PR validation

## Benefits

### For Developers

- **Immediate Feedback**: Know immediately if code doesn't meet standards
- **Consistent Formatting**: Automatic code formatting on all changes
- **Security**: Automatic detection of secrets and vulnerabilities
- **Quality**: Comprehensive linting and type checking

### For Maintainers

- **Reduced Review Time**: Pre-formatted code reduces review overhead
- **Quality Assurance**: Automated checks catch issues before merge
- **Security**: Prevent accidental secret commits
- **Consistency**: Uniform code style across all contributions

### For the Project

- **Maintainability**: Consistent code style improves long-term maintainability
- **Security**: Regular security scanning prevents vulnerabilities
- **Reliability**: Automated testing ensures code quality
- **Professional**: Industry-standard CI/CD practices

## Troubleshooting

### Common Issues

1. **Pre-commit fails in CI but passes locally**
   - Ensure local pre-commit is up to date: `pre-commit autoupdate`
   - Run `pre-commit run --all-files` locally before pushing

2. **TypeScript compilation errors**
   - Check that all TypeScript files compile: `npm run compile`
   - Ensure all dependencies are installed: `npm ci`

3. **Python formatting issues**
   - Run Ruff locally: `ruff format python/`
   - Check Ruff configuration in `pyproject.toml`

4. **Security scan failures**
   - Review detected secrets in the security scan output
   - Update `.secrets.baseline` if false positives

### Debugging

1. **Check workflow logs** in GitHub Actions tab
2. **Run pre-commit locally** with verbose output: `pre-commit run --all-files --verbose`
3. **Test individual hooks**: `pre-commit run prettier`, `pre-commit run eslint`, etc.

## Integration with Pre-commit.ci

The configuration includes settings for pre-commit.ci integration:

- Automatic PR updates with formatting fixes
- Weekly dependency updates
- Automatic commit message formatting

To enable pre-commit.ci:

1. Install the pre-commit.ci app on your repository
2. The workflows will automatically use pre-commit.ci for faster execution

## References

- [Pre-commit Documentation](https://pre-commit.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Pre-commit Action](https://github.com/pre-commit/action)
- [Issue #65](https://github.com/etienneschalk/scientific-data-viewer/issues/65)
