```
feat: Add timestamp variable selection and time range filtering (v0.7.0)

Implements Issue #106: Comprehensive support for datetime variable selection
and time-based filtering across all xarray-supported formats.

Features:
- Automatic datetime variable detection (datetime64, CF-convention, standard_name, common names)
- Time range filtering with start/end datetime inputs
- Dual input methods (datetime-local picker + text input with bidirectional sync)
- Min/max value pre-filling from detected datetime variables
- Monotonicity-aware filtering (increasing, decreasing, non-monotonic)
- Cross-group datetime variable support
- Variable name preservation (handles dots correctly)
- Comprehensive error handling for 16 identified edge cases

Technical improvements:
- Python: Added is_datetime_variable() and check_monotonicity() functions
- Python: Enhanced create_plot() with datetime filtering logic
- TypeScript: Updated interfaces and message passing for datetime parameters
- Frontend: Added Time Controls UI section with smart visibility
- Testing: 27 Python unit tests + TypeScript integration tests
- Documentation: Comprehensive implementation docs and release notes

Breaking changes: None
Backward compatibility: Fully maintained

Closes #106

Co-authored-by: Auto <auto@cursor.sh>
```

