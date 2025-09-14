# RFC #002: Allow Editor split view

## Description

Implement the ability to split the editor view to show multiple datasets side by side.

## Requirements

- Allow users to split the editor view horizontally or vertically
- Each split should be able to display a different dataset
- Maintain independent state for each split view
- Provide intuitive controls for managing split views

## Technical Notes

- This is noted as a hard feature to implement due to previous unsuccessful attempts with AI
- May require significant refactoring of the current webview architecture

## Acceptance Criteria

- [ ] Users can split the editor view
- [ ] Each split can display different datasets independently
- [ ] Split views can be resized and managed
- [ ] State is preserved when switching between splits

## Priority

Medium - Complex implementation

## Labels

enhancement, ui, split-view, complex
