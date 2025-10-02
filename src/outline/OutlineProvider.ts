import * as vscode from 'vscode';
import { Logger } from '../logger';

export interface HeaderItem {
    label: string;
    level: number;
    id?: string;
    line?: number;
    children: HeaderItem[];
}

export class OutlineProvider implements vscode.TreeDataProvider<HeaderItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HeaderItem | undefined | null | void> = new vscode.EventEmitter<HeaderItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<HeaderItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private headers: HeaderItem[] = [];
    private currentFile: vscode.Uri | undefined;
    private fileHeaders: Map<string, HeaderItem[]> = new Map();
    private treeView: vscode.TreeView<HeaderItem> | undefined;
    private fileExpansionState: Map<string, Set<string>> = new Map();
    private originalIdToFileSpecificId: Map<string, string> = new Map();

    constructor() {
        Logger.info('📋 OutlineProvider initialized');
    }

    /**
     * Set the tree view reference for collapse/expand operations
     */
    setTreeView(treeView: vscode.TreeView<HeaderItem>): void {
        this.treeView = treeView;
        this.setupTreeViewListeners();
    }

    /**
     * Set up listeners for tree view expansion/collapse events
     */
    private setupTreeViewListeners(): void {
        if (!this.treeView) {
            return;
        }

        // Listen for when elements are revealed (expanded)
        this.treeView.onDidExpandElement((event) => {
            if (event.element.id) {
                const originalId = this.originalIdToFileSpecificId.get(event.element.id) || event.element.id;
                this.setElementExpanded(originalId, true);
            }
        });

        // Listen for when elements are collapsed
        this.treeView.onDidCollapseElement((event) => {
            if (event.element.id) {
                const originalId = this.originalIdToFileSpecificId.get(event.element.id) || event.element.id;
                this.setElementExpanded(originalId, false);
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    updateHeaders(headers: HeaderItem[], fileUri: vscode.Uri): void {
        // Make headers file-specific by updating their IDs
        const fileSpecificHeaders = this.makeHeadersFileSpecific(headers, fileUri);
        
        this.headers = fileSpecificHeaders;
        this.currentFile = fileUri;
        this.fileHeaders.set(fileUri.fsPath, fileSpecificHeaders);
        Logger.info(`📋 Updated outline with ${fileSpecificHeaders.length} headers for file: ${fileUri.fsPath}`);
        this.refresh();
    }

    getTreeItem(element: HeaderItem): vscode.TreeItem {
        // Determine expansion state based on saved state
        let collapsibleState = vscode.TreeItemCollapsibleState.None;
        if (element.children.length > 0) {
            const isExpanded = this.isElementExpanded(element);
            collapsibleState = isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
        }

        const treeItem = new vscode.TreeItem(element.label, collapsibleState);

        // Set icon based on header level
        switch (element.level) {
            case 1:
                treeItem.iconPath = new vscode.ThemeIcon('symbol-class');
                break;
            case 2:
                treeItem.iconPath = new vscode.ThemeIcon('symbol-folder');
                break;
            case 3:
                treeItem.iconPath = new vscode.ThemeIcon('symbol-method');
                break;
            case 4:
                treeItem.iconPath = new vscode.ThemeIcon('symbol-file');
                break;
            case 5:
                treeItem.iconPath = new vscode.ThemeIcon('symbol-method');
                break;
            default:
                treeItem.iconPath = new vscode.ThemeIcon('symbol-file');
        }

        // Add command to scroll to header in webview
        if (element.id) {
            treeItem.command = {
                command: 'scientificDataViewer.scrollToHeader',
                title: 'Scroll to Header',
                arguments: [element.id, element.label]
            };
            Logger.debug(`📋 Added scroll command for header: ${element.label} (${element.id})`);
        }

        // Add context value for potential future context menu actions
        treeItem.contextValue = `header-${element.level}`;

        return treeItem;
    }

    getChildren(element?: HeaderItem): HeaderItem[] {
        if (!element) {
            return this.headers;
        }
        return element.children;
    }

    getParent(element: HeaderItem): HeaderItem | undefined {
        // Find parent by traversing the tree
        const findParent = (items: HeaderItem[], target: HeaderItem): HeaderItem | undefined => {
            for (const item of items) {
                if (item.children.includes(target)) {
                    return item;
                }
                const found = findParent(item.children, target);
                if (found) {
                    return found;
                }
            }
            return undefined;
        };

        return findParent(this.headers, element);
    }

    clear(): void {
        this.headers = [];
        this.currentFile = undefined;
        this.fileHeaders.clear();
        this.fileExpansionState.clear();
        this.refresh();
    }

    getCurrentFile(): vscode.Uri | undefined {
        return this.currentFile;
    }

    /**
     * Switch to display headers for a different file
     */
    switchToFile(fileUri: vscode.Uri): void {
        if (!fileUri || !fileUri.fsPath) {
            Logger.warn(`📋 Invalid fileUri provided to switchToFile`);
            return;
        }
        
        // Save current expansion state before switching
        if (this.currentFile) {
            this.saveExpansionState();
        }
        
        const filePath = fileUri.fsPath;
        const headers = this.fileHeaders.get(filePath);
        
        if (headers) {
            // Make headers file-specific by updating their IDs
            const fileSpecificHeaders = this.makeHeadersFileSpecific(headers, fileUri);
            this.headers = fileSpecificHeaders;
            this.currentFile = fileUri;
            Logger.info(`📋 Switched outline to file: ${filePath}`);
            this.refresh();
            
            // Restore expansion state after switching
            this.restoreExpansionState();
        } else {
            // If no headers are cached for this file, clear the outline
            this.headers = [];
            this.currentFile = fileUri;
            Logger.info(`📋 No cached headers for file: ${filePath}, clearing outline`);
            this.refresh();
        }
    }

    /**
     * Check if a file is supported for outline display
     */
    isFileSupported(fileUri: vscode.Uri): boolean {
        if (!fileUri || !fileUri.path) {
            return false;
        }
        
        const supportedExtensions = ['.nc', '.netcdf', '.zarr', '.h5', '.hdf5', '.grib', '.grib2', '.tif', '.tiff', '.geotiff', '.jp2', '.jpeg2000', '.safe', '.nc4', '.cdf'];
        const fileExtension = fileUri.path.split('.').pop()?.toLowerCase();
        return fileExtension ? supportedExtensions.includes(`.${fileExtension}`) : false;
    }

    /**
     * Get headers for a specific file without switching to it
     */
    getHeadersForFile(fileUri: vscode.Uri): HeaderItem[] | undefined {
        if (!fileUri || !fileUri.fsPath) {
            return undefined;
        }
        const headers = this.fileHeaders.get(fileUri.fsPath);
        if (headers) {
            // Make headers file-specific by updating their IDs
            return this.makeHeadersFileSpecific(headers, fileUri);
        }
        return undefined;
    }

    /**
     * Collapse all items in the tree view
     */
    collapseAll(): void {
        if (!this.treeView) {
            Logger.warn('📋 Tree view not available for collapse operation');
            return;
        }

        try {
            // Get all visible elements and collapse them
            const visibleElements = this.getAllElements(this.headers);
            visibleElements.forEach(element => {
                if (element.children.length > 0) {
                    this.treeView!.reveal(element, { select: false, focus: false, expand: false });
                }
            });
            Logger.info('📋 Collapsed all outline items');
        } catch (error) {
            Logger.error(`❌ Error collapsing all items: ${error}`);
        }
    }

    /**
     * Expand all items in the tree view
     */
    expandAll(): void {
        if (!this.treeView) {
            Logger.warn('📋 Tree view not available for expand operation');
            return;
        }

        try {
            // Get all elements and expand them
            const allElements = this.getAllElements(this.headers);
            allElements.forEach(element => {
                if (element.children.length > 0) {
                    this.treeView!.reveal(element, { select: false, focus: false, expand: true });
                }
            });
            Logger.info('📋 Expanded all outline items');
        } catch (error) {
            Logger.error(`❌ Error expanding all items: ${error}`);
        }
    }

    /**
     * Get all elements recursively from the headers array
     */
    private getAllElements(headers: HeaderItem[]): HeaderItem[] {
        const elements: HeaderItem[] = [];
        
        const collectElements = (items: HeaderItem[]) => {
            items.forEach(item => {
                elements.push(item);
                if (item.children.length > 0) {
                    collectElements(item.children);
                }
            });
        };
        
        collectElements(headers);
        return elements;
    }

    /**
     * Generate a file-specific ID by incorporating the file path
     */
    private generateFileSpecificId(originalId: string, fileUri: vscode.Uri): string {
        // Create a simple hash of the file path for uniqueness
        const filePath = fileUri.fsPath;
        const pathHash = this.simpleHash(filePath);
        return `${originalId}-${pathHash}`;
    }

    /**
     * Simple hash function for file paths
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Make headers file-specific by updating their IDs and labels
     */
    private makeHeadersFileSpecific(headers: HeaderItem[], fileUri: vscode.Uri): HeaderItem[] {
        const filePath = fileUri.fsPath;
        const fileName = filePath.split('/').pop() || 'unknown';
        const fileHash = this.simpleHash(filePath).substring(0, 4);
        
        // Clear the mapping for this file
        this.originalIdToFileSpecificId.clear();
        
        const makeFileSpecific = (items: HeaderItem[]): HeaderItem[] => {
            return items.map(item => {
                const originalId = item.id;
                const fileSpecificId = item.id ? this.generateFileSpecificId(item.id, fileUri) : undefined;
                
                // Add file identifier to label for testing
                const fileSpecificLabel = `[${fileName}-${fileHash}] ${item.label}`;
                // const fileSpecificLabel = item.label;
                
                // Track the mapping between original and file-specific IDs
                if (originalId && fileSpecificId) {
                    this.originalIdToFileSpecificId.set(fileSpecificId, originalId);
                    Logger.debug(`📋 Made ID file-specific: ${originalId} -> ${fileSpecificId} for file: ${fileUri.fsPath}`);
                }
                
                return {
                    ...item,
                    label: fileSpecificLabel,
                    id: fileSpecificId,
                    children: makeFileSpecific(item.children)
                };
            });
        };

        return makeFileSpecific(headers);
    }

    /**
     * Check if an element should be expanded based on saved state
     */
    private isElementExpanded(element: HeaderItem): boolean {
        if (!this.currentFile || !element.id) {
            return false;
        }
        
        // Get the original ID for this file-specific ID
        const originalId = this.originalIdToFileSpecificId.get(element.id) || element.id;
        const filePath = this.currentFile.fsPath;
        const expansionState = this.fileExpansionState.get(filePath);
        return expansionState ? expansionState.has(originalId) : false;
    }

    /**
     * Save the current expansion state for the current file
     * Note: This method is called before switching files to preserve the current state
     */
    public saveExpansionState(): void {
        if (!this.currentFile) {
            return;
        }

        const filePath = this.currentFile.fsPath;
        // The expansion state is already being tracked by the event listeners
        // This method is mainly for documentation and potential future enhancements
        const currentState = this.fileExpansionState.get(filePath);
        Logger.debug(`📋 Current expansion state for file: ${filePath} (${currentState?.size || 0} expanded items)`);
    }

    /**
     * Set expansion state for specific elements
     */
    public setElementExpanded(elementId: string, expanded: boolean): void {
        if (!this.currentFile) {
            return;
        }

        const filePath = this.currentFile.fsPath;
        let expansionState = this.fileExpansionState.get(filePath);
        if (!expansionState) {
            expansionState = new Set<string>();
            this.fileExpansionState.set(filePath, expansionState);
        }

        if (expanded) {
            expansionState.add(elementId);
        } else {
            expansionState.delete(elementId);
        }

        Logger.debug(`📋 Set element ${elementId} expansion state to ${expanded} for file: ${filePath}`);
    }

    /**
     * Clear expansion state for a specific file
     */
    public clearExpansionState(fileUri?: vscode.Uri): void {
        if (fileUri) {
            this.fileExpansionState.delete(fileUri.fsPath);
            Logger.debug(`📋 Cleared expansion state for file: ${fileUri.fsPath}`);
        } else {
            this.fileExpansionState.clear();
            Logger.debug('📋 Cleared all expansion states');
        }
    }

    /**
     * Restore expansion state for the current file after switching
     */
    public restoreExpansionState(): void {
        if (!this.currentFile || !this.treeView) {
            return;
        }

        const filePath = this.currentFile.fsPath;
        const expansionState = this.fileExpansionState.get(filePath);
        
        if (!expansionState || expansionState.size === 0) {
            Logger.debug(`📋 No expansion state to restore for file: ${filePath}`);
            return;
        }

        // Find elements that should be expanded and reveal them
        const allElements = this.getAllElements(this.headers);
        const elementsToExpand = allElements.filter(element => {
            if (!element.id || element.children.length === 0) {
                return false;
            }
            
            // Get the original ID for this file-specific ID
            const originalId = this.originalIdToFileSpecificId.get(element.id) || element.id;
            return expansionState.has(originalId);
        });

        // Use a small delay to ensure the tree view is ready
        setTimeout(() => {
            elementsToExpand.forEach(element => {
                try {
                    this.treeView!.reveal(element, { select: false, focus: false, expand: true });
                } catch (error) {
                    Logger.debug(`Could not expand element: ${element.id}`);
                }
            });
            Logger.debug(`📋 Restored expansion state for file: ${filePath} (${elementsToExpand.length} elements)`);
        }, 100);
    }
}
