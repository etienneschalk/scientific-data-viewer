# RFC #001: Add support for all possible formats

## Description

Add comprehensive support for all file formats supported by xarray, with automatic dependency management.

## Requirements

- Support all formats listed in https://docs.xarray.dev/en/stable/user-guide/io.html
- Automatically propose to install required dependencies if not found
- Implement a mapping of supported file formats to dependencies directly from xarray
- Handle missing dependencies gracefully with user-friendly installation prompts

## Acceptance Criteria

- [ ] All xarray-supported formats can be opened
- [ ] Missing dependencies are detected and installation is proposed
- [ ] Format-to-dependency mapping is dynamically retrieved from xarray
- [ ] Error handling for unsupported or corrupted files

## Priority

High - Core functionality

## Labels

enhancement, format-support, dependencies
