import * as vscode from 'vscode';
import { Logger } from '../logger';
import { DataViewerPanel } from '../dataViewerPanel';

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
    private expandedStates: Map<string, Set<string>> = new Map(); // filePath -> Set of expanded item IDs

    constructor() {
        Logger.info('📋 OutlineProvider initialized');
    }

    /**
     * Set the tree view reference for collapse/expand operations
     */
    setTreeView(treeView: vscode.TreeView<HeaderItem>): void {
        this.treeView = treeView;
        
        // Set up event listeners for expand/collapse state tracking
        this.treeView.onDidExpandElement((e) => {
            this.saveExpandedState(e.element);
        });
        
        this.treeView.onDidCollapseElement((e) => {
            this.saveCollapsedState(e.element);
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    updateHeaders(headers: HeaderItem[], fileUri: vscode.Uri): void {
        this.headers = headers;
        this.currentFile = fileUri;
        this.fileHeaders.set(fileUri.fsPath, headers);
        Logger.info(`📋 Updated outline with ${headers.length} headers for file: ${fileUri.fsPath}`);
        this.refresh();
    }

    getTreeItem(element: HeaderItem): vscode.TreeItem {
        // Determine the initial collapse state based on saved state
        let collapsibleState = vscode.TreeItemCollapsibleState.None;
        if (element.children.length > 0) {
            const isExpanded = this.isItemExpanded(element);
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

        // Set ID based on active pane ID and element properties
        const activePaneId = this.getActivePaneId();
        const sanitizedLabel = this.sanitizeLabel(element.label);
        const uniqueId = this.generateUniqueId(activePaneId, element.level, sanitizedLabel, element);
        treeItem.id = uniqueId;

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

    clear(fileUri: vscode.Uri | undefined): void {
        this.clearFileHeadersForFile(fileUri);
        this.clearExpandedStateForFile(fileUri);
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
        
        const filePath = fileUri.fsPath;
        const headers = this.fileHeaders.get(filePath);
        
        if (headers) {
            this.headers = headers;
            this.currentFile = fileUri;
            Logger.info(`📋 Switched outline to file: ${filePath}`);
            
            // Restore expanded state after a short delay to ensure tree view is ready
            setTimeout(() => {
                this.restoreExpandedState(filePath);
            }, 100);
            
            this.refresh();
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
        return this.fileHeaders.get(fileUri.fsPath);
    }

    /**
     * Expand all items in the tree view
     */
    expandAll(): void {
        if (!this.treeView) {
            Logger.warn('📋 Tree view not available for expandAll operation');
            return;
        }

        // Get all elements that have children (can be expanded)
        const allElements = this.getAllElements(this.headers);
        const expandableElements = allElements.filter(element => element.children.length > 0);

        // Add all expandable elements to the expanded state for the current file
        if (this.currentFile) {
            const filePath = this.currentFile.fsPath;
            if (!this.expandedStates.has(filePath)) {
                this.expandedStates.set(filePath, new Set());
            }
            
            const expandedSet = this.expandedStates.get(filePath)!;
            expandableElements.forEach(element => {
                const elementId = this.getElementId(element);
                expandedSet.add(elementId);
            });
            
            Logger.info(`📋 Added ${expandableElements.length} items to expanded state for file: ${filePath}`);
        }

        // Expand all elements by revealing them with expand: true
        expandableElements.forEach(element => {
            try {
                this.treeView!.reveal(element, { select: false, focus: false, expand: true });
            } catch (error) {
                Logger.debug(`📋 Failed to expand element: ${element.label}, ${error}`);
            }
        });

        Logger.info(`📋 Expanded ${expandableElements.length} items in tree view`);
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
     * Get the active pane ID for the current file
     */
    private getActivePaneId(): number {
        if (!this.currentFile) {
            return 0; // Default ID when no current file
        }

        const activePanel = DataViewerPanel.getActivePanel(this.currentFile);
        if (activePanel) {
            return activePanel.getId();
        }

        return 0; // Default ID when no active panel found
    }

    /**
     * Sanitize a label to be safe for use in IDs
     */
    private sanitizeLabel(label: string): string {
        if (!label || label.trim() === '') {
            return 'unnamed';
        }
        
        // Replace special characters and spaces with underscores
        // Keep only alphanumeric characters, underscores, and hyphens
        return label
            .trim()
            .replace(/[^a-zA-Z0-9\s\-_]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
            .substring(0, 50); // Limit length to prevent very long IDs
    }

    /**
     * Generate a unique ID for a tree item
     */
    private generateUniqueId(activePaneId: number, level: number, sanitizedLabel: string, element: HeaderItem): string {
        // Create a base ID
        let baseId = `${activePaneId}-${level}-${sanitizedLabel}`;
        
        // If the element has an existing ID, use it as part of the unique identifier
        if (element.id) {
            baseId += `-${element.id}`;
        }
        
        // Add line number if available to ensure uniqueness
        if (element.line !== undefined) {
            baseId += `-line${element.line}`;
        }
        
        // If the label is still empty or very short, add a hash of the full label
        if (sanitizedLabel === 'unnamed' || sanitizedLabel.length < 3) {
            const labelHash = this.simpleHash(element.label || 'empty');
            baseId += `-${labelHash}`;
        }
        
        return baseId;
    }

    /**
     * Simple hash function for generating short unique identifiers
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36).substring(0, 6);
    }

    /**
     * Save the expanded state of an element
     */
    private saveExpandedState(element: HeaderItem): void {
        if (!this.currentFile) return;
        
        const filePath = this.currentFile.fsPath;
        const elementId = this.getElementId(element);
        
        if (!this.expandedStates.has(filePath)) {
            this.expandedStates.set(filePath, new Set());
        }
        
        this.expandedStates.get(filePath)!.add(elementId);
        Logger.debug(`📋 Saved expanded state for element: ${elementId} in file: ${filePath}`);
    }

    /**
     * Save the collapsed state of an element
     */
    private saveCollapsedState(element: HeaderItem): void {
        if (!this.currentFile) return;
        
        const filePath = this.currentFile.fsPath;
        const elementId = this.getElementId(element);
        
        if (this.expandedStates.has(filePath)) {
            this.expandedStates.get(filePath)!.delete(elementId);
            Logger.debug(`📋 Saved collapsed state for element: ${elementId} in file: ${filePath}`);
        }
    }

    /**
     * Check if an element should be expanded based on saved state
     */
    private isItemExpanded(element: HeaderItem): boolean {
        if (!this.currentFile) return false;
        
        const filePath = this.currentFile.fsPath;
        const elementId = this.getElementId(element);
        
        return this.expandedStates.has(filePath) && 
               this.expandedStates.get(filePath)!.has(elementId);
    }

    /**
     * Get a unique identifier for an element
     */
    private getElementId(element: HeaderItem): string {
        const activePaneId = this.getActivePaneId();
        const sanitizedLabel = this.sanitizeLabel(element.label);
        return this.generateUniqueId(activePaneId, element.level, sanitizedLabel, element);
    }

    /**
     * Restore the expanded state for a file
     */
    private restoreExpandedState(filePath: string, forceExpand: boolean = true): void {
        if (!this.treeView || !this.expandedStates.has(filePath)) {
            return;
        }

        const expandedIds = this.expandedStates.get(filePath)!;
        if (expandedIds.size === 0) {
            return;
        }

        Logger.debug(`📋 Restoring expanded state for ${expandedIds.size} elements in file: ${filePath}`);

        // Find and expand all elements that should be expanded
        const allElements = this.getAllElements(this.headers);
        allElements.forEach(element => {
            const elementId = this.getElementId(element);
            if (expandedIds.has(elementId) && element.children.length > 0) {
                try {
                    this.treeView!.reveal(element, { select: false, focus: false, expand: forceExpand });
                } catch (error) {
                    Logger.debug(`📋 Failed to expand element: ${elementId}, ${error}`);
                }
            }
        });
    }

    /**
     * Clear expanded state for a specific file (public method)
     */
    private clearExpandedStateForFile(fileUri: vscode.Uri | undefined): void {
        if (!fileUri || !fileUri.fsPath) {
            Logger.warn(`📋 Invalid fileUri provided to clearExpandedStateForFile`);
            return;
        }
        
        const filePath = fileUri.fsPath;
        this.expandedStates.delete(filePath);
        Logger.info(`📋 Cleared expanded state for file: ${filePath}`);
    }

    private clearFileHeadersForFile(fileUri: vscode.Uri | undefined): void {
        if (!fileUri || !fileUri.fsPath) {
            Logger.warn(`📋 Invalid fileUri provided to clearFileHeadersForFile`);
            return;
        }
        this.fileHeaders.delete(fileUri.fsPath);
    }
}
