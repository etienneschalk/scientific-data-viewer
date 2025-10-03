# RFC #033: Flatten datatree variables using to_dict

## Description

Implement functionality to flatten datatree variables using the `to_dict()` method to show all variables in a flat structure, allowing users to plot and analyze nested variables that are otherwise hidden in the hierarchical datatree structure.

## Requirements

- Use datatree's `to_dict()` method to flatten the tree structure
- Display all variables in a flat list regardless of their original nesting level
- Preserve variable metadata and attributes during flattening
- Allow plotting of nested variables that were previously inaccessible
- Maintain the relationship between variables and their original groups
- Support both shallow and deep flattening options
- Provide clear indication of variable hierarchy in the UI

## Acceptance Criteria

- [ ] Flatten button available in datatree datasets
- [ ] All nested variables are accessible for plotting
- [ ] Variable hierarchy is preserved in metadata
- [ ] Flattened variables maintain their original attributes
- [ ] UI clearly indicates the original nesting structure
- [ ] Performance is acceptable with deeply nested trees
- [ ] Both shallow and deep flattening options are available
- [ ] Flattened variables can be plotted normally

## Priority

Medium - Enhanced data access

## Labels

enhancement, datatree, flatten, to_dict, nested-variables, data-access

## Status

**PENDING** 📋

## Implementation Notes

This feature requires:

- Integration with datatree's `to_dict()` method
- UI updates to show flattened variable structure
- Metadata preservation during flattening
- Performance optimization for large datatrees
- Clear visual indication of variable hierarchy
- Error handling for complex nested structures
