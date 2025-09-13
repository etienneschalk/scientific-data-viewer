import * as vscode from 'vscode';
import { DataProcessor } from './dataProcessor';

export class ScientificDataItem extends vscode.TreeItem {
    public children?: ScientificDataItem[];

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly uri?: vscode.Uri,
        public readonly type?: string,
        public readonly size?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}${this.size ? ` (${this.size})` : ''}`;
        this.contextValue = type || 'file';
    }

    iconPath = new vscode.ThemeIcon('file');
}

export class ScientificDataProvider implements vscode.TreeDataProvider<ScientificDataItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ScientificDataItem | undefined | null | void> = new vscode.EventEmitter<ScientificDataItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ScientificDataItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private dataProcessor: DataProcessor) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ScientificDataItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ScientificDataItem): Promise<ScientificDataItem[]> {
        if (!element) {
            // Root level - show all scientific data files in workspace
            return this.getScientificDataFiles();
        } else {
            // File level - show file details
            return this.getFileDetails(element.uri!);
        }
    }

    private async getScientificDataFiles(): Promise<ScientificDataItem[]> {
        const files: ScientificDataItem[] = [];
        const supportedExtensions = ['.nc', '.netcdf', '.zarr', '.h5', '.hdf5'];

        try {
            const workspaceFiles = await vscode.workspace.findFiles(
                `**/*.{${supportedExtensions.join(',')}}`,
                '**/node_modules/**'
            );

            for (const file of workspaceFiles) {
                const stat = await vscode.workspace.fs.stat(file);
                const size = this.formatFileSize(stat.size);
                const ext = file.path.split('.').pop()?.toLowerCase();
                const type = this.getFileType(ext || '');
                
                files.push(new ScientificDataItem(
                    file.path.split('/').pop() || file.path,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    file,
                    type,
                    size
                ));
            }
        } catch (error) {
            console.error('Error finding scientific data files:', error);
        }

        return files.sort((a, b) => a.label.localeCompare(b.label));
    }

    private async getFileDetails(uri: vscode.Uri): Promise<ScientificDataItem[]> {
        const details: ScientificDataItem[] = [];
        
        try {
            // Get basic file info
            const stat = await vscode.workspace.fs.stat(uri);
            details.push(new ScientificDataItem(
                `Size: ${this.formatFileSize(stat.size)}`,
                vscode.TreeItemCollapsibleState.None
            ));

            details.push(new ScientificDataItem(
                `Modified: ${new Date(stat.mtime).toLocaleString()}`,
                vscode.TreeItemCollapsibleState.None
            ));

            // Try to get data structure info
            try {
                const dataInfo = await this.dataProcessor.getDataInfo(uri);
                if (dataInfo) {
                    details.push(new ScientificDataItem(
                        `Format: ${dataInfo.format}`,
                        vscode.TreeItemCollapsibleState.None
                    ));

                    if (dataInfo.dimensions) {
                        const dimsItem = new ScientificDataItem(
                            'Dimensions',
                            vscode.TreeItemCollapsibleState.Collapsed
                        );
                        dimsItem.children = Object.entries(dataInfo.dimensions).map(([name, size]) => 
                            new ScientificDataItem(`${name}: ${size}`, vscode.TreeItemCollapsibleState.None)
                        );
                        details.push(dimsItem);
                    }

                    if (dataInfo.variables && dataInfo.variables.length > 0) {
                        const varsItem = new ScientificDataItem(
                            `Variables (${dataInfo.variables.length})`,
                            vscode.TreeItemCollapsibleState.Collapsed
                        );
                        varsItem.children = dataInfo.variables.map(variable => 
                            new ScientificDataItem(
                                `${variable.name} (${variable.dtype})`,
                                vscode.TreeItemCollapsibleState.None
                            )
                        );
                        details.push(varsItem);
                    }
                }
            } catch (error) {
                details.push(new ScientificDataItem(
                    'Error loading data info',
                    vscode.TreeItemCollapsibleState.None
                ));
            }

        } catch (error) {
            console.error('Error getting file details:', error);
            details.push(new ScientificDataItem(
                'Error loading file details',
                vscode.TreeItemCollapsibleState.None
            ));
        }

        return details;
    }

    private formatFileSize(bytes: number): string {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    private getFileType(extension: string): string {
        const typeMap: { [key: string]: string } = {
            'nc': 'netcdf',
            'netcdf': 'netcdf',
            'zarr': 'zarr',
            'h5': 'hdf5',
            'hdf5': 'hdf5'
        };
        return typeMap[extension] || 'unknown';
    }
}
