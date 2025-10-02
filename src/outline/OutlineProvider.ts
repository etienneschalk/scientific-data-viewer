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

    constructor() {
        Logger.info('📋 OutlineProvider initialized');
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
            element.children.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
        );

        // Set icon based on header level
        switch (element.level) {
            case 1:
                treeItem.iconPath = new vscode.ThemeIcon('symbol-class');
                break;
            case 2:
                treeItem.iconPath = new vscode.ThemeIcon('symbol-method');
                break;
            case 3:
                treeItem.iconPath = new vscode.ThemeIcon('symbol-property');
                break;
            default:
                treeItem.iconPath = new vscode.ThemeIcon('symbol-field');
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
}
