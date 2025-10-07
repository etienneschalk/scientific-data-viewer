import * as vscode from 'vscode';
import { Logger } from '../common/Logger';
import { CMD_SCROLL_TO_HEADER } from '../common/config';

export interface HeaderItem {
    label: string;
    level: number;
    id: string;
    line?: number;
    children: HeaderItem[];
}

const VERBOSE_DEBUG_LOGS = false;

export class OutlineProvider implements vscode.TreeDataProvider<HeaderItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<
        HeaderItem | undefined | null | void
    > = new vscode.EventEmitter<HeaderItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<
        HeaderItem | undefined | null | void
    > = this._onDidChangeTreeData.event;

    private currentHeaders: HeaderItem[] = [];
    private currentPanelId: number | undefined;
    private headersToPanelId: Map<number, HeaderItem[]> = new Map();
    private treeView: vscode.TreeView<HeaderItem> | undefined;
    private expandedStates: Map<number, Set<string>> = new Map(); // panelId -> Set of expanded item IDs

    constructor() {
        Logger.info('📋 OutlineProvider initialized');
    }

    /**
     * Set the tree view reference for collapse/expand operations
     */
    public setTreeView(treeView: vscode.TreeView<HeaderItem>): void {
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

    updateHeaders(currentPanelId: number, headers: HeaderItem[]): void {
        this.currentHeaders = headers;
        this.currentPanelId = currentPanelId;
        this.headersToPanelId.set(currentPanelId, headers);
        Logger.info(
            `[${this.currentPanelId}] 📋 Updated outline with ${headers.length} headers for panel with ID: ${currentPanelId}`
        );
        this.refresh();
    }

    getTreeItem(element: HeaderItem): vscode.TreeItem {
        const currentPanelId = this.currentPanelId;
        if (currentPanelId === undefined) {
            Logger.warn('[ ] 📋 No current panel ID found');
            return new vscode.TreeItem(
                element.label,
                vscode.TreeItemCollapsibleState.None
            );
        }

        // Determine the initial collapse state based on saved state
        let collapsibleState = vscode.TreeItemCollapsibleState.None;
        if (element.children.length > 0) {
            const isExpanded = this.isItemExpanded(element);
            collapsibleState = isExpanded
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed;
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
                command: CMD_SCROLL_TO_HEADER,
                title: 'Scroll to Header',
                arguments: [element.id, element.label],
            };
            if (VERBOSE_DEBUG_LOGS) {
                Logger.debug(
                    `[${this.currentPanelId}] 📋 Added scroll command for header: ${element.label} (${element.id})`
                );
            }
        }

        // Add context value for potential future context menu actions
        treeItem.contextValue = `header-${element.level}`;

        // Set ID based on active pane ID and element properties
        const sanitizedLabel = this.sanitizeLabel(element.label);
        const uniqueId = this.generateUniqueId(
            currentPanelId,
            element.level,
            sanitizedLabel,
            element
        );
        treeItem.id = uniqueId;

        return treeItem;
    }

    getChildren(element?: HeaderItem): HeaderItem[] {
        if (!element) {
            return this.currentHeaders;
        }
        return element.children;
    }

    getParent(element: HeaderItem): HeaderItem | undefined {
        // Find parent by traversing the tree
        const findParent = (
            items: HeaderItem[],
            target: HeaderItem
        ): HeaderItem | undefined => {
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

        return findParent(this.currentHeaders, element);
    }

    public disposeForPanel(panelId: number): void {
        this.clearFileHeadersForPanel(panelId);
        this.clearExpandedStateForPanel(panelId);
        Logger.info(
            `[${this.currentPanelId}] 📋 Disposed outline provider for panel with ID: ${panelId}`
        );
    }

    public getCurrentPanelId(): number | undefined {
        return this.currentPanelId;
    }

    /**
     * Switch to display headers for a different file
     */
    public switchToPanel(panelId: number): void {
        const headers = this.headersToPanelId.get(panelId);

        this.currentPanelId = panelId;

        if (headers) {
            this.currentHeaders = headers;
            Logger.info(
                `[${this.currentPanelId}] 📋 Switched outline to panel with ID: ${panelId}`
            );

            // Restore expanded state after a short delay to ensure tree view is ready
            setTimeout(() => {
                this.restoreExpandedState(panelId);
            }, 100);

            this.refresh();
        } else {
            // If no headers are cached for this file, clear the outline
            Logger.info(
                `[${this.currentPanelId}] 📋 No cached headers for panel with ID: ${panelId}, clearing outline`
            );
            this.clearOutline();
        }
    }

    private clearOutline() {
        this.currentHeaders = [];
        this.refresh();
    }

    /**
     * Get headers for a specific file without switching to it
     */
    getHeadersForPanel(panelId: number): HeaderItem[] | undefined {
        return this.headersToPanelId.get(panelId);
    }

    /**
     * Expand all items in the tree view
     */
    expandAll(): void {
        if (!this.treeView) {
            Logger.warn(
                `[${this.currentPanelId}] 📋 Tree view not available for expandAll operation`
            );
            return;
        }

        // Get all elements that have children (can be expanded)
        const allElements = this.getAllElements(this.currentHeaders);
        const expandableElements = allElements.filter(
            (element) => element.children.length > 0
        );

        // Add all expandable elements to the expanded state for the current file
        if (this.currentPanelId) {
            if (!this.expandedStates.has(this.currentPanelId)) {
                this.expandedStates.set(this.currentPanelId, new Set());
            }

            const expandedSet = this.expandedStates.get(this.currentPanelId)!;
            expandableElements.forEach((element) => {
                const elementId = this.getElementId(element);
                expandedSet.add(elementId);
            });

            Logger.info(
                `[${this.currentPanelId}] 📋 Added ${expandableElements.length} items to expanded state for panel with ID: ${this.currentPanelId}`
            );
        }

        // Expand all elements by revealing them with expand: true
        expandableElements.forEach((element) => {
            try {
                this.treeView!.reveal(element, {
                    select: false,
                    focus: false,
                    expand: true,
                });
            } catch (error) {
                Logger.debug(
                    `[${this.currentPanelId}] 📋 Failed to expand element: ${element.label}, ${error}`
                );
            }
        });

        Logger.info(
            `[${this.currentPanelId}] 📋 Expanded ${expandableElements.length} items in tree view`
        );
    }

    /**
     * Get all elements recursively from the headers array
     */
    private getAllElements(headers: HeaderItem[]): HeaderItem[] {
        const elements: HeaderItem[] = [];

        const collectElements = (items: HeaderItem[]) => {
            items.forEach((item) => {
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
    private generateUniqueId(
        activePaneId: number,
        level: number,
        sanitizedLabel: string,
        element: HeaderItem
    ): string {
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
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36).substring(0, 6);
    }

    /**
     * Save the expanded state of an element
     */
    private saveExpandedState(element: HeaderItem): void {
        if (!this.currentPanelId) {
            return;
        }

        const elementId = this.getElementId(element);

        if (!this.expandedStates.has(this.currentPanelId)) {
            this.expandedStates.set(this.currentPanelId, new Set());
        }

        this.expandedStates.get(this.currentPanelId)!.add(elementId);
        Logger.debug(
            `[${this.currentPanelId}] 📋 Saved expanded state for element: ${elementId} in panel with ID: ${this.currentPanelId}`
        );
    }

    /**
     * Save the collapsed state of an element
     */
    private saveCollapsedState(element: HeaderItem): void {
        if (!this.currentPanelId) {
            return;
        }

        const elementId = this.getElementId(element);

        if (this.expandedStates.has(this.currentPanelId)) {
            this.expandedStates.get(this.currentPanelId)!.delete(elementId);
            Logger.debug(
                `[${this.currentPanelId}] 📋 Saved collapsed state for element: ${elementId} in panel with ID: ${this.currentPanelId}`
            );
        }
    }

    /**
     * Check if an element should be expanded based on saved state
     */
    private isItemExpanded(element: HeaderItem): boolean {
        if (!this.currentPanelId) {
            return false;
        }

        const elementId = this.getElementId(element);

        return (
            this.expandedStates.has(this.currentPanelId) &&
            this.expandedStates.get(this.currentPanelId)!.has(elementId)
        );
    }

    /**
     * Get a unique identifier for an element
     */
    private getElementId(element: HeaderItem): string {
        const sanitizedLabel = this.sanitizeLabel(element.label);
        return this.generateUniqueId(
            this.currentPanelId!,
            element.level,
            sanitizedLabel,
            element
        );
    }

    /**
     * Restore the expanded state for a file
     */
    private restoreExpandedState(
        panelId: number,
        forceExpand: boolean = true
    ): void {
        if (!this.treeView || !this.expandedStates.has(panelId)) {
            return;
        }

        const expandedIds = this.expandedStates.get(panelId)!;
        if (expandedIds.size === 0) {
            return;
        }

        Logger.debug(
            `[${this.currentPanelId}] 📋 Restoring expanded state for ${expandedIds.size} elements in panel with ID: ${panelId}`
        );

        // Find and expand all elements that should be expanded
        const allElements = this.getAllElements(this.currentHeaders);
        allElements.forEach((element) => {
            const elementId = this.getElementId(element);
            if (expandedIds.has(elementId) && element.children.length > 0) {
                try {
                    this.treeView!.reveal(element, {
                        select: false,
                        focus: false,
                        expand: forceExpand,
                    });
                } catch (error) {
                    Logger.debug(
                        `[${this.currentPanelId}] 📋 Failed to expand element: ${elementId}, ${error}`
                    );
                }
            }
        });
    }

    /**
     * Clear expanded state for a specific file (public method)
     */
    private clearExpandedStateForPanel(panelId: number): void {
        if (!panelId) {
            Logger.warn(
                `[${this.currentPanelId}] 📋 Invalid panelId provided to clearExpandedStateForPanel`
            );
            return;
        }

        this.expandedStates.delete(panelId);
        Logger.info(
            `[${this.currentPanelId}] 📋 Cleared expanded state for panel with ID: ${panelId}`
        );
    }

    private clearFileHeadersForPanel(panelId: number): void {
        if (!panelId) {
            Logger.warn(
                `[${this.currentPanelId}] 📋 Invalid panelId provided to clearFileHeadersForPanel`
            );
            return;
        }
        this.headersToPanelId.delete(panelId);
        Logger.info(
            `[${this.currentPanelId}] 📋 Disposed file headers for panel with ID: ${panelId}`
        );
    }
}
