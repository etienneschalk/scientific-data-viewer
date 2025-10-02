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

    constructor() {
        Logger.info('📋 OutlineProvider initialized');
    }

    /**
     * Set the tree view reference for collapse/expand operations
     */
    setTreeView(treeView: vscode.TreeView<HeaderItem>): void {
        this.treeView = treeView;
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
        const treeItem = new vscode.TreeItem(
            element.label,
            element.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        );
        
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

    clear(): void {
        this.headers = [];
        this.currentFile = undefined;
        this.fileHeaders.clear();
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
        
        const filePath = fileUri.fsPath;
        const headers = this.fileHeaders.get(filePath);
        
        if (headers) {
            this.headers = headers;
            this.currentFile = fileUri;
            Logger.info(`📋 Switched outline to file: ${filePath}`);
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
}
