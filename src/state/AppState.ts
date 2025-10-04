/**
 * Centralized state management for the Scientific Data Viewer extension
 */

export interface DataState {
    currentFile: string | null;
    dataInfo: any | null;
    isLoading: boolean;
    lastLoadTime: Date | null;
    error: string | null;
}

export interface UIState {
    selectedVariable: string | null;
    plotType: string;
    showTimestamp: boolean;
    activePanel: string | null;
}

export interface PythonState {
    isReady: boolean;
    pythonPath: string | null;
    availablePackages: string[];
    error: string | null;
}

export interface ExtensionConfigState {
    extensionConfig: Record<string, any> | null;
}

export interface AppState {
    data: DataState;
    ui: UIState;
    python: PythonState;
    extension: ExtensionConfigState;
}

export type Action = 
    | { type: 'SET_CURRENT_FILE'; payload: string | null }
    | { type: 'SET_DATA_INFO'; payload: any | null }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_LAST_LOAD_TIME'; payload: Date | null }
    | { type: 'SET_SELECTED_VARIABLE'; payload: string | null }
    | { type: 'SET_PLOT_TYPE'; payload: string }
    | { type: 'SET_SHOW_TIMESTAMP'; payload: boolean }
    | { type: 'SET_ACTIVE_PANEL'; payload: string | null }
    | { type: 'SET_PYTHON_READY'; payload: boolean }
    | { type: 'SET_PYTHON_PATH'; payload: string | null }
    | { type: 'SET_AVAILABLE_PACKAGES'; payload: string[] }
    | { type: 'SET_PYTHON_ERROR'; payload: string | null }
    | { type: 'SET_EXTENSION'; payload: Record<string, any> | null }
    | { type: 'RESET_STATE' };

export class StateManager {
    private state: AppState;
    private subscribers: Array<(state: AppState) => void> = [];
    private history: AppState[] = [];
    private maxHistorySize = 50;

    constructor(initialState?: Partial<AppState>) {
        this.state = {
            data: {
                currentFile: null,
                dataInfo: null,
                isLoading: false,
                lastLoadTime: null,
                error: null
            },
            ui: {
                selectedVariable: null,
                plotType: 'auto',
                showTimestamp: true,
                activePanel: null
            },
            python: {
                isReady: false,
                pythonPath: null,
                availablePackages: [],
                error: null,
            },
            extension: {
                extensionConfig: null
            },
            ...initialState
        };
    }

    getState(): AppState {
        return { ...this.state };
    }

    dispatch(action: Action): void {
        const previousState = { ...this.state };
        this.state = this.reducer(this.state, action);
        
        // Add to history for undo functionality
        this.history.push(previousState);
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
        
        this.notifySubscribers();
    }

    subscribe(callback: (state: AppState) => void): () => void {
        this.subscribers.push(callback);
        return () => this.unsubscribe(callback);
    }

    private unsubscribe(callback: (state: AppState) => void): void {
        const index = this.subscribers.indexOf(callback);
        if (index > -1) {
            this.subscribers.splice(index, 1);
        }
    }

    private notifySubscribers(): void {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('Error in state subscriber:', error);
            }
        });
    }

    private reducer(state: AppState, action: Action): AppState {
        switch (action.type) {
            case 'SET_CURRENT_FILE':
                return {
                    ...state,
                    data: { ...state.data, currentFile: action.payload }
                };
            
            case 'SET_DATA_INFO':
                return {
                    ...state,
                    data: { 
                        ...state.data, 
                        dataInfo: action.payload,
                        error: action.payload ? null : state.data.error
                    }
                };
            
            case 'SET_LOADING':
                return {
                    ...state,
                    data: { ...state.data, isLoading: action.payload }
                };
            
            case 'SET_ERROR':
                return {
                    ...state,
                    data: { ...state.data, error: action.payload }
                };
            
            case 'SET_LAST_LOAD_TIME':
                return {
                    ...state,
                    data: { ...state.data, lastLoadTime: action.payload }
                };
            
            case 'SET_SELECTED_VARIABLE':
                return {
                    ...state,
                    ui: { ...state.ui, selectedVariable: action.payload }
                };
            
            case 'SET_PLOT_TYPE':
                return {
                    ...state,
                    ui: { ...state.ui, plotType: action.payload }
                };
            
            case 'SET_SHOW_TIMESTAMP':
                return {
                    ...state,
                    ui: { ...state.ui, showTimestamp: action.payload }
                };
            
            case 'SET_ACTIVE_PANEL':
                return {
                    ...state,
                    ui: { ...state.ui, activePanel: action.payload }
                };
            
            case 'SET_PYTHON_READY':
                return {
                    ...state,
                    python: { ...state.python, isReady: action.payload }
                };
            
            case 'SET_PYTHON_PATH':
                return {
                    ...state,
                    python: { ...state.python, pythonPath: action.payload }
                };
            
            case 'SET_AVAILABLE_PACKAGES':
                return {
                    ...state,
                    python: { ...state.python, availablePackages: action.payload }
                };
            
            case 'SET_PYTHON_ERROR':
                return {
                    ...state,
                    python: { ...state.python, error: action.payload }
                };
            
            case 'SET_EXTENSION':
                return {
                    ...state,
                    extension: { ...state.extension, extensionConfig: action.payload }
                };
            
            case 'RESET_STATE':
                return {
                    data: {
                        currentFile: null,
                        dataInfo: null,
                        isLoading: false,
                        lastLoadTime: null,
                        error: null
                    },
                    ui: {
                        selectedVariable: null,
                        plotType: 'auto',
                        showTimestamp: true,
                        activePanel: null
                    },
                    python: {
                        isReady: false,
                        pythonPath: null,
                        availablePackages: [],
                        error: null,
                    },
                    extension: {
                        extensionConfig: null
                    }
                };
            
            default:
                return state;
        }
    }

    // Utility methods for common state operations
    setCurrentFile(filePath: string | null): void {
        this.dispatch({ type: 'SET_CURRENT_FILE', payload: filePath });
    }

    setDataInfo(dataInfo: any | null): void {
        this.dispatch({ type: 'SET_DATA_INFO', payload: dataInfo });
    }

    setLoading(isLoading: boolean): void {
        this.dispatch({ type: 'SET_LOADING', payload: isLoading });
    }

    setError(error: string | null): void {
        this.dispatch({ type: 'SET_ERROR', payload: error });
    }

    setPythonReady(isReady: boolean): void {
        this.dispatch({ type: 'SET_PYTHON_READY', payload: isReady });
    }

    setPythonPath(pythonPath: string | null): void {
        this.dispatch({ type: 'SET_PYTHON_PATH', payload: pythonPath });
    }

    setLastLoadTime(lastLoadTime: Date | null): void {
        this.dispatch({ type: 'SET_LAST_LOAD_TIME', payload: lastLoadTime });
    }

    setExtension(extensionConfig: Record<string, any> | null): void {
        this.dispatch({ type: 'SET_EXTENSION', payload: extensionConfig });
    }


    // History management
    canUndo(): boolean {
        return this.history.length > 0;
    }

    undo(): void {
        if (this.canUndo()) {
            const previousState = this.history.pop()!;
            this.state = previousState;
            this.notifySubscribers();
        }
    }

    // State validation
    validateState(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        if (this.state.data.isLoading && this.state.data.dataInfo) {
            errors.push('Data is loading but dataInfo is already set');
        }
        
        if (this.state.python.isReady && !this.state.python.pythonPath) {
            errors.push('Python is ready but no path is set');
        }
        
        if (this.state.ui.selectedVariable && !this.state.data.dataInfo) {
            errors.push('Variable selected but no data loaded');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
