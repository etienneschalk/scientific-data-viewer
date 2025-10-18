# Pre-commit Setup for Code Formatting Standardization

This document describes the pre-commit configuration implemented to address [Issue #65](https://github.com/etienneschalk/scientific-data-viewer/issues/65) - Code Formatting Standardization.

## Overview

The pre-commit configuration ensures consistent code formatting and quality across the entire codebase using automated formatting tools. This implementation covers both TypeScript/JavaScript and Python code.

## Configuration Files

- `.pre-commit-config.yaml` - Main pre-commit configuration
- `pyproject.toml` - Ruff configuration for Python formatting and linting
- `.secrets.baseline` - Baseline for detect-secrets security scanning

## Tools Used

### TypeScript/JavaScript

- **Prettier** - Code formatting
- **ESLint** - Linting and code quality
- **TypeScript Compiler** - Type checking

### Python

- **Ruff** - Linting and formatting (replaces black, flake8, isort, etc.)

### General

- **pre-commit-hooks** - Basic file checks (trailing whitespace, end-of-file, etc.)
- **detect-secrets** - Security scanning for secrets

## Installation

1. Install pre-commit:

   ```bash
   pip install pre-commit
   ```

2. Install the git hook scripts:

   ```bash
   pre-commit install
   ```

3. (Optional) Run on all files to format existing code:
   ```bash
   pre-commit run --all-files
   ```

## Features

### Automatic Formatting

- **TypeScript/JavaScript**: Prettier + ESLint with auto-fix
- **Python**: Ruff formatting
- **Markdown**: Prettier formatting
- **JSON/YAML**: Validation and formatting

### Code Quality Checks

- TypeScript type checking
- ESLint rules enforcement
- Python linting with Ruff
- Security scanning for secrets
- Large file detection
- Merge conflict detection

### File Exclusions

The following directories are excluded from formatting:

- `out/` - Compiled TypeScript output
- `node_modules/` - Node.js dependencies
- `.vscode-test/` - VS Code test files

## Manual Usage

### Run all hooks on all files:

```bash
pre-commit run --all-files
```

### Run specific hook:

```bash
pre-commit run prettier
pre-commit run eslint
pre-commit run ruff
```

### Update hook versions:

```bash
pre-commit autoupdate
```

## Integration with Development Workflow

### VS Code Integration

- Install the "Prettier" extension for real-time formatting
- Install the "ESLint" extension for real-time linting
- Install the "Ruff" extension for Python formatting and linting

### CI/CD Integration

The configuration includes CI settings for automatic updates and fixes via pre-commit.ci.

## Configuration Details

### Prettier Configuration

Uses the existing `.prettierrc` file with:

- 2-space tabs for most files
- 4-space tabs for TypeScript/JavaScript/JSON
- Single quotes for strings

### ESLint Configuration

Uses the existing `.eslintrc.json` with TypeScript support and custom rules.

### Ruff Configuration

Configured in `pyproject.toml` with:

- 88-character line length (Black-compatible)
- 4-space indentation
- Comprehensive linting rules
- Auto-formatting capabilities

## Troubleshooting

### Common Issues

1. **Hook fails on first run**: This is normal for existing code. Run `pre-commit run --all-files` to format all files.

2. **TypeScript errors**: Ensure all TypeScript files compile without errors before committing.

3. **Python import errors**: Make sure all Python dependencies are installed.

4. **Large file warnings**: Check if large files are necessary or should be added to `.gitignore`.

### Updating Dependencies

To update pre-commit hook versions:

```bash
pre-commit autoupdate
```

To update specific tools:

```bash
# Update Ruff
pip install --upgrade ruff

# Update Prettier/ESLint
npm update prettier eslint
```

## Benefits

This setup provides:

- **Consistency**: Uniform code style across the entire codebase
- **Quality**: Automated detection of code issues
- **Security**: Prevention of accidental secret commits
- **Maintainability**: Easier code reviews and maintenance
- **Developer Experience**: Automatic formatting on save/commit

## Requirements Fulfilled

This implementation addresses all requirements from Issue #65:

✅ Run formatter on all TypeScript/JavaScript code
✅ Configure consistent formatting rules
✅ Integrate formatting into development workflow
✅ Ensure formatting consistency across files
✅ Support both manual and automatic formatting
✅ Maintain code readability
✅ Integrate with pre-commit hooks
✅ Support different file types (TS, JS, Python, MD, JSON, YAML)

## References

- [Pre-commit Documentation](https://pre-commit.com/)
- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [Prettier Documentation](https://prettier.io/)
- [ESLint Documentation](https://eslint.org/)
- [Issue #65](https://github.com/etienneschalk/scientific-data-viewer/issues/65)
