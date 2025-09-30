# RFC #003: Add DataTree usage and support

## Description

Implement comprehensive DataTree support for handling complex hierarchical data structures.

## Requirements

- Use DataTree native representation when relevant
- Create fake complex data with many nested groups in Zarr format
- Create fake complex data with many groups in NetCDF format
- Integrate DataTree visualization into the existing UI

## Acceptance Criteria

- [x] DataTree objects are properly detected and handled
- [ ] Native DataTree representation is used in the UI
- [ ] Test data with complex nested structures is available
  - [ ] many nested groups in Zarr format
  - [ ] many groups in NetCDF format
- [x] DataTree-specific features are exposed in the interface

## Priority

Medium - Feature enhancement

## Labels

enhancement, datatree, hierarchical-data, test-data
