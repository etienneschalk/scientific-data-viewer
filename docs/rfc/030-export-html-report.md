# RFC #030: Export whole HTML as a report

## Description

Add functionality to export the entire HTML content of the data viewer as a self-contained report that can be shared, archived, or used for documentation purposes.

## Requirements

- Export button to generate a complete HTML report
- Include all visualizations, data tables, and metadata in the report
- Generate a self-contained HTML file with embedded CSS and JavaScript
- Include dataset information, file metadata, and analysis results
- Support for different report templates (scientific, technical, summary)
- Option to include or exclude interactive elements
- Generate a clean, professional-looking report layout

## Acceptance Criteria

- [ ] Export button available in the main UI
- [ ] Generated HTML report is self-contained (no external dependencies)
- [ ] Report includes all current visualizations and data
- [ ] Dataset metadata and file information are included
- [ ] Report has a clean, professional layout
- [ ] Option to choose between interactive and static report versions
- [ ] Report can be opened in any web browser
- [ ] File size is reasonable for sharing

## Priority

Medium - Documentation and sharing capabilities

## Labels

enhancement, export, html, report, documentation, sharing

## Status

**PENDING** 📋

## Implementation Notes

This feature will require:

- HTML generation utilities for report creation
- Template system for different report styles
- Asset bundling for self-contained reports
- UI integration for export options
- Metadata extraction and formatting
