import * as vscode from 'vscode';
import { Logger } from '../logger';
import { HeaderExtractor } from './HeaderExtractor';

export class ScientificDataDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    private static instance: ScientificDataDocumentSymbolProvider | undefined;
    private currentHeaders: vscode.DocumentSymbol[] = [];
    private currentFile: vscode.Uri | undefined;

    private constructor() {
        Logger.info('📋 DocumentSymbolProvider initialized');
    }

    public static getInstance(): ScientificDataDocumentSymbolProvider {
        if (!ScientificDataDocumentSymbolProvider.instance) {
            ScientificDataDocumentSymbolProvider.instance = new ScientificDataDocumentSymbolProvider();
        }
        return ScientificDataDocumentSymbolProvider.instance;
    }

    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        // Check if this is a supported scientific data file
        const supportedExtensions = ['.nc', '.netcdf', '.zarr', '.h5', '.hdf5', '.grib', '.grib2', '.tif', '.tiff', '.geotiff', '.jp2', '.jpeg2000', '.safe', '.nc4', '.cdf'];
        const fileExtension = document.uri.path.split('.').pop()?.toLowerCase();
        
        if (!fileExtension || !supportedExtensions.includes(`.${fileExtension}`)) {
            return [];
        }

        // Check if this is the current file we're tracking
        if (this.currentFile && this.currentFile.fsPath === document.uri.fsPath) {
            return this.currentHeaders;
        }

        // For unsupported files or when no headers are available, return empty array
        return [];
    }

    public updateHeaders(headers: vscode.DocumentSymbol[], fileUri: vscode.Uri): void {
        this.currentHeaders = headers;
        this.currentFile = fileUri;
        Logger.info(`📋 Updated document symbols with ${headers.length} symbols for file: ${fileUri.fsPath}`);
    }

    public clear(): void {
        this.currentHeaders = [];
        this.currentFile = undefined;
        Logger.info('📋 Document symbols cleared');
    }

    public getCurrentFile(): vscode.Uri | undefined {
        return this.currentFile;
    }

    /**
     * Convert HeaderItem to DocumentSymbol
     */
    public static convertHeaderToDocumentSymbol(headerItem: any): vscode.DocumentSymbol {
        const symbol = new vscode.DocumentSymbol(
            headerItem.label,
            '', // detail - empty for now
            this.getSymbolKind(headerItem.level),
            new vscode.Range(0, 0, 0, 0), // range - will be updated when we have actual line numbers
            new vscode.Range(0, 0, 0, 0)  // selectionRange
        );

        // Add command to scroll to header in webview if ID is available
        if (headerItem.id) {
            symbol.tags = [vscode.SymbolTag.Deprecated]; // This will make it clickable in the outline
        }

        // Convert children recursively
        if (headerItem.children && headerItem.children.length > 0) {
            symbol.children = headerItem.children.map((child: any) => 
                this.convertHeaderToDocumentSymbol(child)
            );
        }
        
        return symbol;
    }

    /**
     * Get appropriate SymbolKind based on header level
     */
    private static getSymbolKind(level: number): vscode.SymbolKind {
        switch (level) {
            case 1:
                return vscode.SymbolKind.Module;
            case 2:
                return vscode.SymbolKind.Class;
            case 3:
                return vscode.SymbolKind.Method;
            case 4:
                return vscode.SymbolKind.Property;
            case 5:
                return vscode.SymbolKind.Field;
            default:
                return vscode.SymbolKind.Variable;
        }
    }

    /**
     * Create document symbols from the data viewer headers
     */
    public static createDataViewerDocumentSymbols(): vscode.DocumentSymbol[] {
        const headerItems = HeaderExtractor.createDataViewerHeaders();
        return headerItems.map(header => 
            this.convertHeaderToDocumentSymbol( header)
        );
    }
}
