# Contributing to Scientific Data Viewer

Thank you for your interest in contributing to the Scientific Data Viewer VSCode extension! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Python 3.7+ with scientific packages
- VSCode
- Git

### Development Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/etienneschalk/scientific-data-viewer.git
   cd scientific-data-viewer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Python dependencies**:
   ```bash
   pip install xarray netCDF4 zarr h5py numpy matplotlib
   ```

4. **Compile the extension**:
   ```bash
   npm run compile
   ```

5. **Open in VSCode**:
   ```bash
   code .
   ```

## Development Workflow

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write code following the project's style guidelines
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**:
   ```bash
   npm run compile
   npm test
   npm run lint
   ```

4. **Run the extension**:
   - Press `F5` to open Extension Development Host
   - Test your changes with sample data files

### Code Style

- Use TypeScript for all new code
- Follow the existing code style and patterns
- Use meaningful variable and function names
- Add JSDoc comments for public functions
- Keep functions small and focused

### Testing

- Write unit tests for new functionality
- Test with various file types and sizes
- Verify Python integration works correctly
- Test error handling and edge cases

## Project Structure

```
src/
├── extension.ts          # Main extension entry point
├── dataProvider.ts       # Tree data provider for file explorer
├── dataProcessor.ts      # Python integration and data processing
├── dataViewerPanel.ts    # Webview panel for data visualization
└── pythonManager.ts      # Python environment management

test/
├── runTest.ts           # Test runner
└── suite/               # Test suites
    └── extension.test.ts
```

## Areas for Contribution

### High Priority

- **Performance improvements** for large files
- **Additional file formats** (GRIB, TIFF, etc.)
- **Enhanced visualizations** (3D plots, animations)
- **Data export functionality**
- **Better error handling and user feedback**

### Medium Priority

- **Unit test coverage** improvements
- **Documentation** enhancements
- **Accessibility** improvements
- **Internationalization** support
- **Configuration options** expansion

### Low Priority

- **UI/UX improvements**
- **Code refactoring**
- **Performance monitoring**
- **Analytics integration**

## Submitting Changes

### Pull Request Process

1. **Ensure your code is ready**:
   - All tests pass
   - Code is properly formatted
   - Documentation is updated
   - No console.log statements left in

2. **Create a pull request**:
   - Use a descriptive title
   - Provide a detailed description
   - Link any related issues
   - Include screenshots for UI changes

3. **Respond to feedback**:
   - Address review comments promptly
   - Make requested changes
   - Ask questions if something is unclear

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **VSCode version**
- **Extension version**
- **Operating system**
- **Python version and packages**
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Error messages or logs**

### Feature Requests

For feature requests, please include:

- **Use case description**
- **Proposed solution**
- **Alternatives considered**
- **Additional context**

## Code Review Guidelines

### For Contributors

- **Be responsive** to review feedback
- **Ask questions** if feedback is unclear
- **Be open to suggestions** and alternative approaches
- **Keep PRs focused** and reasonably sized

### For Reviewers

- **Be constructive** in feedback
- **Explain the reasoning** behind suggestions
- **Be respectful** and professional
- **Focus on the code**, not the person

## Release Process

### Version Numbering

We use [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Run full test suite
- [ ] Test with sample data files
- [ ] Update documentation if needed
- [ ] Create release notes

## Community Guidelines

### Code of Conduct

- **Be respectful** and inclusive
- **Be constructive** in discussions
- **Be patient** with newcomers
- **Be collaborative** and helpful

### Getting Help

- **GitHub Issues** for bug reports and feature requests
- **GitHub Discussions** for questions and general discussion
- **Pull Request comments** for specific code discussions

## Recognition

Contributors will be recognized in:
- **README.md** contributors section
- **Release notes** for significant contributions
- **GitHub contributors** page

## Questions?

If you have questions about contributing, please:
- Open a GitHub issue
- Start a GitHub discussion
- Contact the maintainers directly

Thank you for contributing to Scientific Data Viewer!
