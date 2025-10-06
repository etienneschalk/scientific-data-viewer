# RFC #039: Webview Search (Ctrl+F) Support

## Description

Implement Ctrl+F search functionality within the Scientific Data Viewer webview to allow users to search through data content, variable names, and other text content.

## Requirements

- Implement Ctrl+F keyboard shortcut in webview
- Support text search across all visible content
- Provide search highlighting
- Support case-sensitive and case-insensitive search
- Implement search navigation (next/previous)
- Support regex search patterns
- Provide search result count
- Maintain search state across navigation

## Acceptance Criteria

- [ ] Ctrl+F opens search dialog in webview
- [ ] Text search works across all content
- [ ] Search highlighting is visible
- [ ] Case sensitivity options are available
- [ ] Navigation between results works
- [ ] Regex search is supported
- [ ] Search result count is shown
- [ ] Search state is preserved

## Priority

Medium - User convenience

## Labels

search, webview, ctrl-f, user-experience, navigation

## Status

**PENDING** 📋

## Implementation Notes

This feature requires:

- Webview search implementation
- Keyboard shortcut handling
- Search highlighting system
- Navigation controls
- Regex support
- State management for search
- Integration with existing webview
