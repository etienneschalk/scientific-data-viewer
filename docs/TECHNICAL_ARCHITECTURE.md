# Technical Architecture Documentation

## Overview

This document describes the comprehensive architectural improvements implemented to enhance the maintainability, scalability, and robustness of the Scientific Data Viewer VSCode extension. The improvements focus on UI architecture while maintaining full backward compatibility.

## Architecture Goals

- **Maintainability**: Modular, testable components with clear separation of concerns
- **Scalability**: Foundation for future features and complex UI interactions
- **Robustness**: Centralized error handling and state management
- **Type Safety**: Full TypeScript coverage with compile-time validation
- **Performance**: Efficient state updates and component rendering

## New Architecture Components

### 1. State Management System (`src/state/AppState.ts`)

**Purpose**: Centralized, immutable state management using Redux-like patterns.

**Key Features**:

- **Immutable State Updates**: All state changes go through action dispatching
- **Type Safety**: Full TypeScript interfaces for all state structures
- **State Validation**: Built-in validation to prevent inconsistent states
- **History Management**: Undo/redo functionality with configurable history size
- **Subscriber Pattern**: Reactive updates when state changes

**State Structure**:

```typescript
interface AppState {
  data: DataState; // File data, loading states, errors
  ui: UIState; // UI preferences, selections, display options
}
```

**Usage Example**:

```typescript
const stateManager = new StateManager();
stateManager.dispatch({ type: 'SET_CURRENT_FILE', payload: filePath });
stateManager.subscribe((state) => console.log('State updated:', state));
```

### 2. Type-Safe Communication System

#### Message Types (`src/communication/MessageTypes.ts`)

**Purpose**: Define all communication interfaces between extension and webview.

**Key Features**:

- **Request/Response Pattern**: Type-safe message handling with timeouts
- **Event System**: Real-time updates without request/response overhead
- **Message Factory**: Consistent message creation with unique IDs
- **Type Guards**: Runtime type checking for message validation

**Message Structure**:

```typescript
interface RequestMessage<T> {
  id: string;
  timestamp: number;
  type: 'request';
  command: string;
  payload: T;
}
```

#### Message Bus (`src/communication/MessageBus.ts`)

**Purpose**: Handle all communication between VSCode extension and webview.

**Key Features**:

- **Promise-based Requests**: Async/await pattern for request handling
- **Timeout Management**: Configurable timeouts with proper cleanup
- **Error Handling**: Automatic error propagation and logging
- **Event Broadcasting**: Publish/subscribe pattern for real-time updates

**Usage Example**:

```typescript
const messageBus = new MessageBus(webview);
await messageBus.sendRequest('getDataInfo', { filePath });
messageBus.onEvent('dataLoaded', (data) => console.log('Data loaded:', data));
```

### 3. Error Boundary System (`src/error/ErrorBoundary.ts`)

**Purpose**: Centralized error handling and recovery across the application.

**Key Features**:

- **Component-Specific Handlers**: Different error handling per component
- **Global Error Recovery**: Fallback error handling for unhandled errors
- **Error History**: Track and analyze error patterns
- **User-Friendly Messages**: Convert technical errors to user-friendly messages
- **Issue Reporting**: Automatic GitHub issue creation with error details

**Error Context**:

```typescript
interface ErrorContext {
  component: string; // Which component failed
  operation: string; // What operation was being performed
  data?: any; // Additional context data
  userAction?: string; // User action that triggered the error
}
```

**Usage Example**:

```typescript
const errorBoundary = ErrorBoundary.getInstance();
errorBoundary.registerHandler('ui', (error, context) => {
  // Handle UI-specific errors
});
errorBoundary.handleError(error, { component: 'ui', operation: 'render' });
```

### 4. Component-Based UI System

#### Base Component (`src/ui/components/BaseComponent.ts`)

**Purpose**: Abstract base class for all UI components.

**Key Features**:

- **Lifecycle Management**: mount, unmount, update lifecycle methods
- **State Management**: Local component state with reactive updates
- **Event Handling**: Centralized event listener management
- **Child Management**: Parent-child component relationships
- **Utility Methods**: Common functionality for all components

**Lifecycle Methods**:

```typescript
abstract class BaseComponent {
  abstract render(): string; // Generate HTML
  abstract mount(element: HTMLElement): void; // Attach to DOM
  abstract unmount(): void; // Clean up resources

  componentDidMount(): void; // Called after mounting
  componentDidUpdate(prevProps, prevState): void; // Called after updates
  componentWillUnmount(): void; // Called before unmounting
}
```

#### Header Component (`src/ui/components/HeaderComponent.ts`)

**Purpose**: Manages header controls including plotting options and timestamps.

**Key Features**:

- **Plotting Controls**: Variable selection and plot type configuration
- **Timestamp Display**: Real-time last load time updates
- **Event Handling**: User interaction management
- **State Synchronization**: Keeps UI in sync with application state

#### Data Display Component (`src/ui/components/DataDisplayComponent.ts`)

**Purpose**: Handles data visualization including dimensions, variables, and representations.

**Key Features**:

- **Data Rendering**: Displays file information, dimensions, variables
- **Copy Functionality**: Clipboard integration for data copying
- **Interactive Elements**: Clickable variables and expandable sections
- **Responsive Design**: Adapts to different data structures

### 5. UI Controller (`src/ui/UIController.ts`)

**Purpose**: Separates UI logic from DataViewerPanel for better maintainability.

**Key Features**:

- **Message Handling**: Delegates webview messages to appropriate handlers
- **State Management**: Coordinates between UI components and application state
- **Error Integration**: Integrates with error boundary system
- **Configuration Management**: Handles VSCode configuration updates

**Architecture Pattern**:

```
DataViewerPanel -> UIController -> StateManager
                -> MessageBus -> Webview
                -> ErrorBoundary -> ErrorHandlers
```

## Migration Strategy

### Phase 1: Foundation (Completed)

- ✅ Implemented state management system
- ✅ Created type-safe communication system
- ✅ Added error boundary system
- ✅ Built component-based UI system
- ✅ Extracted UI controller

### Phase 2: Integration (Current)

- ✅ Maintained backward compatibility
- ✅ Preserved all existing functionality
- ✅ Added legacy message handling support
- ✅ Disabled conflicting new systems temporarily

### Phase 3: Full Migration (Future)

- 🔄 Update webview JavaScript to use new message format
- 🔄 Enable UI controller message handling
- 🔄 Enable state subscription system
- 🔄 Remove legacy message handling
- 🔄 Add comprehensive testing

## File Structure

```
src/
├── state/
│   └── AppState.ts              # Centralized state management
├── communication/
│   ├── MessageTypes.ts          # Type-safe message interfaces
│   └── MessageBus.ts            # Communication system
├── error/
│   └── ErrorBoundary.ts         # Error handling system
├── ui/
│   ├── UIController.ts          # UI logic controller
│   └── components/
│       ├── BaseComponent.ts     # Base component class
│       ├── HeaderComponent.ts   # Header component
│       └── DataDisplayComponent.ts # Data display component
└── dataViewerPanel.ts           # Main panel (refactored)
```

## Configuration Changes

### TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "lib": ["ES2021", "DOM"] // Added DOM types for webview components
  }
}
```

## Benefits Achieved

### Maintainability

- **Modular Architecture**: Each component has a single responsibility
- **Clear Interfaces**: Well-defined contracts between components
- **Type Safety**: Compile-time error detection and IDE support
- **Documentation**: Comprehensive inline documentation

### Scalability

- **Component Reusability**: Components can be reused across different contexts
- **State Management**: Centralized state scales with application complexity
- **Message System**: Supports complex communication patterns
- **Error Handling**: Robust error recovery at all levels

### Performance

- **Immutable Updates**: Efficient state change detection
- **Component Lifecycle**: Proper resource management and cleanup
- **Message Batching**: Optimized communication patterns
- **Error Recovery**: Graceful degradation without full restarts

## Testing Strategy

### Unit Testing

- **State Manager**: Test state updates, validation, and history
- **Message Bus**: Test request/response patterns and error handling
- **Error Boundary**: Test error handling and recovery mechanisms
- **Components**: Test rendering, lifecycle, and event handling

### Integration Testing

- **UI Controller**: Test message handling and state coordination
- **Component Communication**: Test parent-child relationships
- **Error Propagation**: Test error handling across component boundaries

### End-to-End Testing

- **Full Workflow**: Test complete data loading and visualization
- **Error Scenarios**: Test error handling in real-world conditions
- **Performance**: Test with large datasets and complex operations

## Maintenance Guidelines

### Adding New Components

1. Extend `BaseComponent` class
2. Implement required abstract methods
3. Add component-specific state and props interfaces
4. Register with parent component or UI controller
5. Add comprehensive tests

### Adding New State

1. Define new state interface in `AppState.ts`
2. Add corresponding action types
3. Implement reducer logic
4. Add utility methods if needed
5. Update component subscriptions

### Adding New Messages

1. Define message interfaces in `MessageTypes.ts`
2. Add command/event constants
3. Implement handlers in `MessageBus.ts`
4. Update UI controller if needed
5. Add type guards for runtime validation

### Error Handling

1. Register component-specific error handlers
2. Use error boundary wrapper methods for async operations
3. Provide user-friendly error messages
4. Include relevant context in error reports
5. Test error scenarios thoroughly

## Future Enhancements

### Planned Features

- **Virtual DOM**: Efficient UI updates with diffing
- **Theme System**: Dynamic theming support
- **Plugin System**: Custom component support
- **Performance Monitoring**: Real-time performance metrics
- **Advanced State**: Time-travel debugging and state persistence

### Migration Path

1. **Gradual Migration**: Migrate components one by one to new system
2. **Feature Flags**: Use configuration to enable/disable new features
3. **A/B Testing**: Test new features with subset of users
4. **Rollback Strategy**: Maintain ability to revert to legacy system

## Troubleshooting

### Common Issues

- **State Inconsistency**: Check state validation and reducer logic
- **Message Timeouts**: Verify message handlers are registered
- **Component Not Updating**: Check state subscriptions and lifecycle
- **Error Not Handled**: Verify error boundary registration

### Debug Tools

- **State Inspector**: Use `stateManager.getState()` to inspect current state
- **Message Logger**: Enable debug logging in MessageBus
- **Error History**: Use `errorBoundary.getErrorHistory()` to review errors
- **Component Tree**: Use browser dev tools to inspect component hierarchy

## Conclusion

The new architecture provides a solid foundation for future development while maintaining full backward compatibility. The modular design, type safety, and comprehensive error handling make the codebase much more maintainable and robust. Future developers can easily extend the system by following the established patterns and guidelines.

---

**Last Updated**: September 18, 2025  
**Version**: 1.0  
**Maintainer**: Development Team
