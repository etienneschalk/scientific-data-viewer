# Issue #007: Lazy initialization with feature flags

## Description

Implement lazy initialization to improve startup performance by deferring environment checks until needed.

## Requirements

- Add feature flag for lazy initialization
- Defer environment checks (xarray, dask imports) until first file is opened
- Improve startup performance significantly
- Maintain all existing functionality

## Acceptance Criteria

- [ ] Feature flag controls lazy initialization
- [ ] Environment checks are deferred until first file open
- [ ] Startup time is measurably improved
- [ ] All functionality works after lazy initialization

## Priority

Medium - Performance

## Labels

performance, lazy-loading, feature-flag, startup
