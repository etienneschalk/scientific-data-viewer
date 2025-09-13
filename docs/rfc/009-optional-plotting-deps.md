# Issue #009: Optional dependencies for plotting

## Description

Implement optional dependencies system where each feature has its own Python package dependencies.

## Requirements

- Each feature should declare its required Python packages
- Matplotlib should only be required if plotting is enabled
- Graceful handling of missing optional dependencies
- Clear indication of which features are available based on installed packages

## Acceptance Criteria

- [ ] Feature-specific dependency management
- [ ] Matplotlib is optional when plotting is disabled
- [ ] Missing dependencies are handled gracefully
- [ ] Feature availability is clearly indicated to users

## Priority

Medium - Architecture

## Labels

architecture, dependencies, optional, plotting
