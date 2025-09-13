# Développement d'une extension VSCode pour NetCDF
_Exported on 9/12/2025 at 17:11:40 GMT+2 from Cursor (1.5.11)_

---

**User**

# Idée de stage : Développement d'une extension VSCode pour l'affichage de fichiers de données scientifiques

Note : tout ce texte a été écrit manuellement sans l'aide tierce d'un LLM.

## But du projet 
## Motivation

Lors du développement, rester dans VSCode pour visualiser des données sans avoir à utiliser de logiciel tiers est confortable.

Problème actuel : Il n'est pas possible d'ouvrir un fichier NetCDF avec VSCode.

Pour simplement afficher le contenu d'un NetCDF depuis VSCode il faut soit :
- utiliser un outil en ligne de commande tel que `ncdump`
- créer un Jupyter Notebook pour ouvrir le NetCDF, ce qui nécessite du code.

Par exemple, pour afficher le format GeoJSON, l'extension [Geo Data Viewer](https://marketplace.visualstudio.com/items?itemName=RandomFractalsInc.geo-data-viewer) peut être utilisée. Il suffit de cliquer sur un fichier avec l'extension `.geojson` depuis l'explorateur de fichiers intégré à VSCode pour visualiser le contenu du fichier sur une carte, de manière interactive. 

Cependant, il n'y a pas à l'heure actuelle d'équivalent aussi qualitatif pour lire le NetCDF. Voir section "Etat des lieux"

Le but du projet serait donc de résoudre ce manque actuel, ainsi que de servir de vitrine à l'entreprise en publiant une extension utile pour la communauté scientifique. Toute personne installant l'extension verra le nom de l'entreprise en tant que fournisseur de l'extension. Cette visibilité appelle cependant à une grande responsabilité : l'extension doit fonctionner correctement pour montrer une image d'excellence de l'entreprise en termes de développement informatique.

## Etat des lieux 

_Etat des lieux réalisés le 18 août 2025 obtenus en cherchant "netCDF" dans l'Extensions Marketplace de VSCode_

Les extensions actuelles de lecture de fichiers NetCDF ne sont pas satisfaisantes.

### [netCDF Preview](https://marketplace.visualstudio.com/items?itemName=Feliks.ncpreview)

5k téléchargements.

Cette extension est historiquement présente dans VSCode, d'où son grand nombre de téléchargements contrairement aux autres plus récentes.

Inconvénients de l'extension :
- Nécessite une dépendance système : `ncl`
- Dernière update en février il y a plus de 2 ans.
- Lien vers le repository GitHub non-fonctionnel.

### [NetCDF Viewer](https://marketplace.visualstudio.com/items?itemName=RichardMcDonald.netcdf-viewer)

< 1k téléchargements

Avantages de l'extension :
- Utilise un environnement Python fourni par l'utilisateur contenant `xarray` et `netCDF4`
- Publiée récemment et dernière relase en date : juin 2025
- Repository accessible sur GitHub : [netcdf-viewer](https://github.com/rmcd-mscb/netcdf-viewer)

Inconvénients de l'extension :
- Supporte seulement le NetCDF.
- Il faut utiliser la command palette pour ouvrir un fichier (cliquer sur le fichier dans l'explorateur ne suffit pas)
- La selection de l'env reste laborieuse, un systeme similaire a Data Wrangler devrait etre utilisé
- En lisant le code il semble qu'un seul NetCDF a la fois puisse etre chargé (un global store est utilisé pour stocker le path du netcdf.)

Le code de cette extension pourrait servir de point de départ pour créer la nôtre.

### [netcdf-cdl](https://marketplace.visualstudio.com/items?itemName=miikama.netcdf-cdl)

1k téléchargements

Hors-scope, car cette extension colore syntaxiquement le langage NetCDF CDL. Son but n'est pas l'affichage de fichiers.

### [NetCDF Explorer](https://marketplace.visualstudio.com/items?itemName=zsy1207.netcdf-explorer)

< 1k téléchargements

Avantages de l'extension :
- Utilise Python

Inconvénients de l'extension :
- Contrairement a NetCDF Viewer, ne permet pas à l'utilisateur de choisir un environnement et utilise le Python système.
- Affichage sommaire seulement : génère un markdown avec la structure du NetCDF. Pratique mais intérêt limité.

### [Manish's Fantastic Dump](https://marketplace.visualstudio.com/items?itemName=ManishVenumuddula.manishsfantasticdump)

< 100 téléchargements

Inconvénients de l'extension :
- Dépendances système : `ncdump` et `ncview` (on souhaite utiliser Python dans le cadre de ce projet)
- Affichage sommaire seulement (utilise `ncdump -h`, headers uniquement et non la data)

### Conclusion de l'état des lieux

L'extension **NetCDF Viewer** semble la plus satisfaisante et avancée à ce stade.

## Pistes techniques

L'idée serait d'utiliser l'environnement Python déjà configurée par l'utilisateur afin de l'utiliser pour lire et afficher les données.
Les extensions peuvent se connecter à un interpréteur Python. Exemple : l'extension Data Wrangler utilise l'interpréteur Python et la librairie pandas associée à son environnement lors de son exécution depuis un  Jupyter Notebook depuis VSCode. L'extension NetCDF Viewer fait usage du même principe.

Dans un premier temps, `xarray` serait utilisé pour lire et afficher les données. En effet, cette librairie permet de lire un large spectre de formats scientifiques.

Dans un second temps, une réflexion pourrait être menée pour améliorer l'UI – l'affichage de xarray est pratique mais reste basique) – en s'inspirant d'outils de visualisation déjà existant, notamment pour le NetCDF, tels que [Panoply](https://www.giss.nasa.gov/tools/panoply/). Par exemple, générer des plots pour les variables.

Enfin, l'ajout d'autres formats tels que Zarr pourrait être effectué. En effet aucune extension VSCode lié à Zarr existe pour le moment. xarray permet l'ouverture de nombreux fichiers, il faut en profiter.

## Liens


Documentation sur les extensions VSCode :
https://code.visualstudio.com/api/get-started/extension-anatomy

# AI Prompt

I want you to code an extens

Add extensive documentation about how to install the extension in development mode, how to maintain it.

You can get inspiration by checking the code of the NetCDF Viewer.

Add documentation on how to publish it on the VSCode marketplace when it's needed.

---

**Cursor**

I'll help you create a VSCode extension for displaying scientific data files, particularly NetCDF files. Let me start by examining the existing NetCDF Viewer extension to understand the current implementation and then create an improved version.


Let me search for the specific NetCDF Viewer extension repository to examine its code:


Now let me create a comprehensive VSCode extension for scientific data file viewing. I'll start by creating the project structure and implementing the core functionality.


Let me create the VSCode extension project structure. I'll start by creating the main project directory and files:


I'll create the VSCode extension project structure. Let me start by creating the main files:

## Scientific Data Viewer - VSCode Extension

I'll create a comprehensive VSCode extension for viewing scientific data files, particularly NetCDF files. This will be an improved version of existing extensions with better UI and broader format support.

### Project Structure

Let me create the essential files for the extension:

**package.json** - Extension manifest:
```json
{
  "name": "scientific-data-viewer",
  "displayName": "Scientific Data Viewer",
  "description": "View and analyze scientific data files (NetCDF, Zarr, HDF5) directly in VSCode",
  "version": "1.0.0",
  "publisher": "your-company",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Data Science",
    "Visualization",
    "Other"
  ],
  "keywords": [
    "netcdf",
    "zarr",
    "hdf5",
    "scientific",
    "data",
    "visualization",
    "xarray"
  ],
  "activationEvents": [
    "onCommand:scientificDataViewer.openFile",
    "onCustomEditor:scientificDataViewer.netcdfViewer"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "scientificDataViewer.openFile",
        "title": "Open with Scientific Data Viewer",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.refreshView",
        "title": "Refresh View",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.exportData",
        "title": "Export Data",
        "category": "Scientific Data"
      }
    ],
    "customEditors": [
      {
        "viewType": "scientificDataViewer.netcdfViewer",
        "displayName": "NetCDF Viewer",
        "selector": [
          {
            "filenamePattern": "*.nc"
          },
          {
            "filenamePattern": "*.netcdf"
          }
        ]
      },
      {
        "viewType": "scientificDataViewer.zarrViewer",
        "displayName": "Zarr Viewer",
        "selector": [
          {
            "filenamePattern": "*.zarr"
          }
        ]
      }
    ],
    "menus": {
      "explorer/context": [
        {
          "command": "scientificDataViewer.openFile",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ],
      "editor/title": [
        {
          "command": "scientificDataViewer.refreshView",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        },
        {
          "command": "scientificDataViewer.exportData",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "Scientific Data Viewer",
      "properties": {
        "scientificDataViewer.pythonPath": {
          "type": "string",
          "default": "python",
          "description": "Path to Python interpreter"
        },
        "scientificDataViewer.maxFileSize": {
          "type": "number",
          "default": 100,
          "description": "Maximum file size in MB to load"
        },
        "scientificDataViewer.autoRefresh": {
          "type": "boolean",
          "default": true,
          "description": "Automatically refresh view when file changes"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile && npm run lint",
    "lint": "eslint src --ext ts",
    "test": "node ./out/test/runTest.js"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "16.x",
    "@typescript-eslint/eslint-plugin": "^5.45.0",
    "@typescript-eslint/parser": "^5.45.0",
    "eslint": "^8.28.0",
    "typescript": "^4.9.4"
  },
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

**tsconfig.json** - TypeScript configuration:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": [
      "ES2020"
    ],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true
  },
  "exclude": [
    "node_modules",
    ".vscode-test"
  ]
}
```

**src/extension.ts** - Main extension file:
```typescript
import * as vscode from 'vscode';
import { NetCDFViewerProvider } from './providers/netcdfViewerProvider';
import { ZarrViewerProvider } from './providers/zarrViewerProvider';
import { DataViewerManager } from './dataViewerManager';
import { PythonExecutor } from './pythonExecutor';

export function activate(context: vscode.ExtensionContext) {
    console.log('Scientific Data Viewer extension is now active!');

    const pythonExecutor = new PythonExecutor();
    const dataViewerManager = new DataViewerManager(pythonExecutor);

    // Register custom editors
    const netcdfProvider = new NetCDFViewerProvider(dataViewerManager);
    const zarrProvider = new ZarrViewerProvider(dataViewerManager);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'scientificDataViewer.netcdfViewer',
            netcdfProvider,
            {
                supportsMultipleEditorsPerDocument: false,
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'scientificDataViewer.zarrViewer',
            zarrProvider,
            {
                supportsMultipleEditorsPerDocument: false,
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Register commands
    const openFileCommand = vscode.commands.registerCommand(
        'scientificDataViewer.openFile',
        async (uri: vscode.Uri) => {
            if (uri) {
                await vscode.commands.executeCommand('vscode.openWith', uri, 'scientificDataViewer.netcdfViewer');
            }
        }
    );

    const refreshCommand = vscode.commands.registerCommand(
        'scientificDataViewer.refreshView',
        () => {
            dataViewerManager.refreshCurrentView();
        }
    );

    const exportCommand = vscode.commands.registerCommand(
        'scientificDataViewer.exportData',
        () => {
            dataViewerManager.exportCurrentData();
        }
    );

    context.subscriptions.push(openFileCommand, refreshCommand, exportCommand);

    // Check Python environment on activation
    pythonExecutor.checkPythonEnvironment().then(isValid => {
        if (!isValid) {
            vscode.window.showWarningMessage(
                'Scientific Data Viewer: Python environment not properly configured. ' +
                'Please ensure Python with xarray and netCDF4 is installed.'
            );
        }
    });
}

export function deactivate() {
    console.log('Scientific Data Viewer extension is now deactivated!');
}
```

**src/dataViewerManager.ts** - Core data management:
```typescript
import * as vscode from 'vscode';
import { PythonExecutor } from './pythonExecutor';
import { DataFileInfo, VariableInfo } from './types';

export class DataViewerManager {
    private currentView: vscode.WebviewPanel | undefined;
    private pythonExecutor: PythonExecutor;

    constructor(pythonExecutor: PythonExecutor) {
        this.pythonExecutor = pythonExecutor;
    }

    async openFile(uri: vscode.Uri, webview: vscode.Webview): Promise<void> {
        try {
            const fileInfo = await this.pythonExecutor.readDataFile(uri.fsPath);
            this.updateWebview(webview, fileInfo);
        } catch (error) {
            this.showError(webview, `Failed to open file: ${error}`);
        }
    }

    async refreshCurrentView(): Promise<void> {
        if (this.currentView) {
            const uri = this.currentView.webview.uri;
            if (uri) {
                await this.openFile(uri, this.currentView.webview);
            }
        }
    }

    async exportCurrentData(): Promise<void> {
        if (this.currentView) {
            const uri = this.currentView.webview.uri;
            if (uri) {
                const fileInfo = await this.pythonExecutor.readDataFile(uri.fsPath);
                const exportData = this.prepareExportData(fileInfo);
                
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`${uri.fsPath}.export.json`),
                    filters: {
                        'JSON': ['json'],
                        'CSV': ['csv'],
                        'All Files': ['*']
                    }
                });

                if (saveUri) {
                    await this.pythonExecutor.exportData(fileInfo, saveUri.fsPath);
                    vscode.window.showInformationMessage(`Data exported to ${saveUri.fsPath}`);
                }
            }
        }
    }

    setCurrentView(panel: vscode.WebviewPanel): void {
        this.currentView = panel;
    }

    private updateWebview(webview: vscode.Webview, fileInfo: DataFileInfo): void {
        const html = this.generateWebviewContent(webview, fileInfo);
        webview.html = html;
    }

    private showError(webview: vscode.Webview, message: string): void {
        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Scientific Data Viewer - Error</title>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
                    .error { color: var(--vscode-errorForeground); padding: 20px; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>Error</h2>
                    <p>${message}</p>
                </div>
            </body>
            </html>
        `;
        webview.html = html;
    }

    private generateWebviewContent(webview: vscode.Webview, fileInfo: DataFileInfo): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
            vscode.Uri.file(__dirname), '..', 'media', 'viewer.js'
        ));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(
            vscode.Uri.file(__dirname), '..', 'media', 'viewer.css'
        ));

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Scientific Data Viewer</title>
                <link href="${styleUri}" rel="stylesheet">
                <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            </head>
            <body>
                <div class="container">
                    <header class="header">
                        <h1>Scientific Data Viewer</h1>
                        <div class="file-info">
                            <span class="file-name">${fileInfo.fileName}</span>
                            <span class="file-size">${this.formatFileSize(fileInfo.fileSize)}</span>
                        </div>
                    </header>
                    
                    <div class="content">
                        <div class="sidebar">
                            <h3>Variables</h3>
                            <div class="variables-list">
                                ${fileInfo.variables.map(variable => `
                                    <div class="variable-item" data-variable="${variable.name}">
                                        <div class="variable-name">${variable.name}</div>
                                        <div class="variable-dims">${variable.dimensions.join(' × ')}</div>
                                        <div class="variable-type">${variable.type}</div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <h3>Dimensions</h3>
                            <div class="dimensions-list">
                                ${fileInfo.dimensions.map(dim => `
                                    <div class="dimension-item">
                                        <span class="dim-name">${dim.name}</span>
                                        <span class="dim-size">${dim.size}</span>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <h3>Attributes</h3>
                            <div class="attributes-list">
                                ${fileInfo.attributes.map(attr => `
                                    <div class="attribute-item">
                                        <span class="attr-name">${attr.name}</span>
                                        <span class="attr-value">${attr.value}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="main-content">
                            <div class="plot-container">
                                <div id="plot-area"></div>
                            </div>
                            <div class="data-table-container">
                                <div id="data-table"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script>
                    window.fileData = ${JSON.stringify(fileInfo)};
                </script>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

    private prepareExportData(fileInfo: DataFileInfo): any {
        return {
            fileName: fileInfo.fileName,
            fileSize: fileInfo.fileSize,
            format: fileInfo.format,
            variables: fileInfo.variables,
            dimensions: fileInfo.dimensions,
            attributes: fileInfo.attributes,
            timestamp: new Date().toISOString()
        };
    }

    private formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}
```

**src/pythonExecutor.ts** - Python integration:
```typescript
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { DataFileInfo, VariableInfo, DimensionInfo, AttributeInfo } from './types';

export class PythonExecutor {
    private pythonPath: string;

    constructor() {
        this.pythonPath = vscode.workspace.getConfiguration('scientificDataViewer').get('pythonPath', 'python');
    }

    async checkPythonEnvironment(): Promise<boolean> {
        try {
            const result = await this.executePythonScript('check_environment.py');
            return result.success;
        } catch (error) {
            return false;
        }
    }

    async readDataFile(filePath: string): Promise<DataFileInfo> {
        const scriptPath = path.join(__dirname, '..', 'python', 'read_data_file.py');
        const result = await this.executePythonScript(scriptPath, [filePath]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to read data file');
        }

        return result.data;
    }

    async exportData(fileInfo: DataFileInfo, outputPath: string): Promise<void> {
        const scriptPath = path.join(__dirname, '..', 'python', 'export_data.py');
        const result = await this.executePythonScript(scriptPath, [
            JSON.stringify(fileInfo),
            outputPath
        ]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to export data');
        }
    }

    async getVariableData(filePath: string, variableName: string): Promise<any> {
        const scriptPath = path.join(__dirname, '..', 'python', 'get_variable_data.py');
        const result = await this.executePythonScript(scriptPath, [filePath, variableName]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to get variable data');
        }

        return result.data;
    }

    private executePythonScript(scriptPath: string, args: string[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            const pythonArgs = [scriptPath, ...args];
            const process = child_process.spawn(this.pythonPath, pythonArgs, {
                cwd: path.dirname(scriptPath)
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse Python output: ${stdout}`));
                    }
                } else {
                    reject(new Error(`Python script failed: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }
}
```

**src/types.ts** - Type definitions:
```typescript
export interface DataFileInfo {
    fileName: string;
    fileSize: number;
    format: string;
    variables: VariableInfo[];
    dimensions: DimensionInfo[];
    attributes: AttributeInfo[];
}

export interface VariableInfo {
    name: string;
    dimensions: string[];
    type: string;
    shape: number[];
    attributes: AttributeInfo[];
}

export interface DimensionInfo {
    name: string;
    size: number;
    attributes: AttributeInfo[];
}

export interface AttributeInfo {
    name: string;
    value: any;
    type: string;
}
```

**src/providers/netcdfViewerProvider.ts** - NetCDF custom editor:
```typescript
import * as vscode from 'vscode';
import { DataViewerManager } from '../dataViewerManager';

export class NetCDFViewerProvider implements vscode.CustomTextEditorProvider {
    constructor(private dataViewerManager: DataViewerManager) {}

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.dataViewerManager.setCurrentView(webviewPanel);
        await this.dataViewerManager.openFile(document.uri, webviewPanel.webview);

        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'getVariableData':
                        try {
                            const data = await this.dataViewerManager.getVariableData(
                                document.uri.fsPath,
                                message.variableName
                            );
                            webviewPanel.webview.postMessage({
                                type: 'variableData',
                                data: data
                            });
                        } catch (error) {
                            webviewPanel.webview.postMessage({
                                type: 'error',
                                message: error.message
                            });
                        }
                        break;
                }
            }
        );
    }
}
```

**src/providers/zarrViewerProvider.ts** - Zarr custom editor:
```typescript
import * as vscode from 'vscode';
import { DataViewerManager } from '../dataViewerManager';

export class ZarrViewerProvider implements vscode.CustomTextEditorProvider {
    constructor(private dataViewerManager: DataViewerManager) {}

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.dataViewerManager.setCurrentView(webviewPanel);
        await this.dataViewerManager.openFile(document.uri, webviewPanel.webview);

        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'getVariableData':
                        try {
                            const data = await this.dataViewerManager.getVariableData(
                                document.uri.fsPath,
                                message.variableName
                            );
                            webviewPanel.webview.postMessage({
                                type: 'variableData',
                                data: data
                            });
                        } catch (error) {
                            webviewPanel.webview.postMessage({
                                type: 'error',
                                message: error.message
                            });
                        }
                        break;
                }
            }
        );
    }
}
```

**python/read_data_file.py** - Python script for reading data files:
```python
#!/usr/bin/env python3
"""
Python script to read scientific data files and return metadata.
"""

import sys
import json
import os
import xarray as xr
import numpy as np
from pathlib import Path

def read_data_file(file_path):
    """Read a scientific data file and return metadata."""
    try:
        # Determine file format
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
            format_name = 'NetCDF'
        elif file_ext == '.zarr':
            ds = xr.open_zarr(file_path)
            format_name = 'Zarr'
        else:
            # Try to open as generic xarray dataset
            ds = xr.open_dataset(file_path)
            format_name = 'Unknown'
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Extract variables information
        variables = []
        for var_name, var in ds.variables.items():
            var_info = {
                'name': var_name,
                'dimensions': list(var.dims),
                'type': str(var.dtype),
                'shape': list(var.shape),
                'attributes': [{'name': k, 'value': str(v), 'type': type(v).__name__} 
                              for k, v in var.attrs.items()]
            }
            variables.append(var_info)
        
        # Extract dimensions information
        dimensions = []
        for dim_name, dim_size in ds.dims.items():
            dim_info = {
                'name': dim_name,
                'size': dim_size,
                'attributes': []
            }
            dimensions.append(dim_info)
        
        # Extract global attributes
        attributes = [{'name': k, 'value': str(v), 'type': type(v).__name__} 
                    for k, v in ds.attrs.items()]
        
        # Create result
        result = {
            'fileName': os.path.basename(file_path),
            'fileSize': file_size,
            'format': format_name,
            'variables': variables,
            'dimensions': dimensions,
            'attributes': attributes
        }
        
        return {'success': True, 'data': result}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({'success': False, 'error': 'Usage: python read_data_file.py <file_path>'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = read_data_file(file_path)
    print(json.dumps(result))
```

**python/check_environment.py** - Environment check script:
```python
#!/usr/bin/env python3
"""
Check if required Python packages are available.
"""

import sys
import json

def check_environment():
    """Check if required packages are installed."""
    required_packages = ['xarray', 'netCDF4', 'numpy', 'pandas']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        return {
            'success': False,
            'error': f'Missing packages: {", ".join(missing_packages)}'
        }
    else:
        return {'success': True}

if __name__ == '__main__':
    result = check_environment()
    print(json.dumps(result))
```

**python/get_variable_data.py** - Variable data extraction:
```python
#!/usr/bin/env python3
"""
Extract variable data for visualization.
"""

import sys
import json
import xarray as xr
import numpy as np

def get_variable_data(file_path, variable_name):
    """Get data for a specific variable."""
    try:
        # Open dataset
        file_ext = file_path.split('.')[-1].lower()
        if file_ext in ['nc', 'netcdf']:
            ds = xr.open_dataset(file_path)
        elif file_ext == 'zarr':
            ds = xr.open_zarr(file_path)
        else:
            ds = xr.open_dataset(file_path)
        
        # Get variable
        if variable_name not in ds.variables:
            return {'success': False, 'error': f'Variable {variable_name} not found'}
        
        var = ds.variables[variable_name]
        
        # Convert to numpy array for JSON serialization
        data = var.values
        
        # Handle different data types
        if data.dtype.kind in ['U', 'S']:  # String types
            data = data.astype(str).tolist()
        elif data.dtype.kind in ['f', 'i']:  # Numeric types
            # Convert NaN to None for JSON serialization
            data = np.where(np.isnan(data), None, data).tolist()
        else:
            data = data.tolist()
        
        result = {
            'name': variable_name,
            'data': data,
            'shape': list(var.shape),
            'dims': list(var.dims),
            'attributes': dict(var.attrs)
        }
        
        return {'success': True, 'data': result}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({'success': False, 'error': 'Usage: python get_variable_data.py <file_path> <variable_name>'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    variable_name = sys.argv[2]
    result = get_variable_data(file_path, variable_name)
    print(json.dumps(result))
```

**python/export_data.py** - Data export script:
```python
#!/usr/bin/env python3
"""
Export scientific data to various formats.
"""

import sys
import json
import xarray as xr
import pandas as pd
from pathlib import Path

def export_data(file_info_json, output_path):
    """Export data to specified format."""
    try:
        file_info = json.loads(file_info_json)
        file_path = file_info.get('originalPath', '')
        
        if not file_path:
            return {'success': False, 'error': 'No file path provided'}
        
        # Open dataset
        file_ext = Path(file_path).suffix.lower()
        if file_ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
        elif file_ext == '.zarr':
            ds = xr.open_zarr(file_path)
        else:
            ds = xr.open_dataset(file_path)
        
        # Determine output format
        output_ext = Path(output_path).suffix.lower()
        
        if output_ext == '.json':
            # Export as JSON
            export_data = {
                'metadata': file_info,
                'variables': {}
            }
            
            for var_name in ds.variables:
                var = ds.variables[var_name]
                export_data['variables'][var_name] = {
                    'data': var.values.tolist() if hasattr(var.values, 'tolist') else str(var.values),
                    'dims': list(var.dims),
                    'attributes': dict(var.attrs)
                }
            
            with open(output_path, 'w') as f:
                json.dump(export_data, f, indent=2)
                
        elif output_ext == '.csv':
            # Export first variable as CSV
            first_var = list(ds.variables.keys())[0]
            var = ds.variables[first_var]
            
            if var.ndim == 1:
                df = pd.DataFrame({first_var: var.values})
            elif var.ndim == 2:
                df = pd.DataFrame(var.values)
            else:
                # Flatten higher dimensional data
                df = pd.DataFrame(var.values.reshape(-1, 1), columns=[first_var])
            
            df.to_csv(output_path, index=False)
            
        else:
            return {'success': False, 'error': f'Unsupported output format: {output_ext}'}
        
        return {'success': True}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({'success': False, 'error': 'Usage: python export_data.py <file_info_json> <output_path>'}))
        sys.exit(1)
    
    file_info_json = sys.argv[1]
    output_path = sys.argv[2]
    result = export_data(file_info_json, output_path)
    print(json.dumps(result))
```

**media/viewer.js** - Frontend JavaScript:
```javascript
// Scientific Data Viewer Frontend
class ScientificDataViewer {
    constructor() {
        this.currentVariable = null;
        this.plotContainer = document.getElementById('plot-area');
        this.tableContainer = document.getElementById('data-table');
        
        this.initializeEventListeners();
        this.initializePlot();
    }

    initializeEventListeners() {
        // Variable selection
        document.querySelectorAll('.variable-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const variableName = e.currentTarget.dataset.variable;
                this.selectVariable(variableName);
            });
        });

        // Listen for messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'variableData':
                    this.displayVariableData(message.data);
                    break;
                case 'error':
                    this.showError(message.message);
                    break;
            }
        });
    }

    selectVariable(variableName) {
        // Update UI
        document.querySelectorAll('.variable-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-variable="${variableName}"]`).classList.add('selected');
        
        this.currentVariable = variableName;
        
        // Request variable data
        this.requestVariableData(variableName);
    }

    requestVariableData(variableName) {
        // Send message to extension
        if (window.vscode) {
            window.vscode.postMessage({
                type: 'getVariableData',
                variableName: variableName
            });
        }
    }

    displayVariableData(data) {
        this.plotData(data);
        this.displayDataTable(data);
    }

    plotData(data) {
        if (!data.data || data.data.length === 0) {
            this.plotContainer.innerHTML = '<p>No data to plot</p>';
            return;
        }

        const plotData = this.preparePlotData(data);
        
        const layout = {
            title: data.name,
            xaxis: { title: 'Index' },
            yaxis: { title: 'Value' },
            margin: { t: 50, r: 50, b: 50, l: 50 }
        };

        Plotly.newPlot(this.plotContainer, plotData, layout, {responsive: true});
    }

    preparePlotData(data) {
        const values = data.data;
        
        if (Array.isArray(values) && values.length > 0) {
            if (typeof values[0] === 'number') {
                // 1D data
                return [{
                    x: Array.from({length: values.length}, (_, i) => i),
                    y: values,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: data.name
                }];
            } else if (Array.isArray(values[0])) {
                // 2D data
                return [{
                    z: values,
                    type: 'heatmap',
                    name: data.name
                }];
            }
        }
        
        return [{
            x: [0],
            y: [0],
            type: 'scatter',
            mode: 'markers',
            name: 'No valid data'
        }];
    }

    displayDataTable(data) {
        if (!data.data || data.data.length === 0) {
            this.tableContainer.innerHTML = '<p>No data to display</p>';
            return;
        }

        const values = data.data;
        let tableHTML = '<table class="data-table"><thead><tr><th>Index</th><th>Value</th></tr></thead><tbody>';
        
        if (Array.isArray(values)) {
            values.slice(0, 100).forEach((value, index) => {
                tableHTML += `<tr><td>${index}</td><td>${value}</td></tr>`;
            });
            
            if (values.length > 100) {
                tableHTML += `<tr><td colspan="2">... and ${values.length - 100} more rows</td></tr>`;
            }
        }
        
        tableHTML += '</tbody></table>';
        this.tableContainer.innerHTML = tableHTML;
    }

    showError(message) {
        this.plotContainer.innerHTML = `<div class="error">Error: ${message}</div>`;
        this.tableContainer.innerHTML = '';
    }

    initializePlot() {
        // Initialize empty plot
        this.plotContainer.innerHTML = '<p>Select a variable to view its data</p>';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScientificDataViewer();
});
```

**media/viewer.css** - Frontend styles:
```css
/* Scientific Data Viewer Styles */
.container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
}

.header {
    padding: 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-panel-background);
}

.header h1 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
}

.file-info {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: var(--vscode-descriptionForeground);
}

.file-name {
    font-weight: 500;
}

.content {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.sidebar {
    width: 300px;
    padding: 16px;
    border-right: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-sideBar-background);
    overflow-y: auto;
}

.sidebar h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--vscode-foreground);
}

.variables-list, .dimensions-list, .attributes-list {
    margin-bottom: 24px;
}

.variable-item, .dimension-item, .attribute-item {
    padding: 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.variable-item:hover, .variable-item.selected {
    background-color: var(--vscode-list-hoverBackground);
}

.variable-item.selected {
    background-color: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}

.variable-name, .dim-name, .attr-name {
    font-weight: 500;
    display: block;
}

.variable-dims, .variable-type, .dim-size, .attr-value {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    margin-top: 2px;
}

.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
    overflow: hidden;
}

.plot-container {
    flex: 1;
    margin-bottom: 16px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    background-color: var(--vscode-editor-background);
}

.data-table-container {
    height: 200px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    background-color: var(--vscode-editor-background);
    overflow: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.data-table th, .data-table td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.data-table th {
    background-color: var(--vscode-panel-background);
    font-weight: 600;
}

.error {
    color: var(--vscode-errorForeground);
    padding: 16px;
    text-align: center;
}

/* Scrollbar styling */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--vscode-scrollbarSlider-background);
}

::-webkit-scrollbar-thumb {
    background: var(--vscode-scrollbarSlider-hoverBackground);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--vscode-scrollbarSlider-activeBackground);
}
```

## Documentation

### Installation en mode développement

1. **Prérequis** :
   - Node.js (version 16 ou supérieure)
   - Python 3.7+ avec les packages : `xarray`, `netCDF4`, `numpy`, `pandas`
   - VSCode

2. **Installation** :
   ```bash
   # Cloner le repository
   git clone <repository-url>
   cd scientific-data-viewer
   
   # Installer les dépendances
   npm install
   
   # Compiler l'extension
   npm run compile
   ```

3. **Test en mode développement** :
   - Ouvrir le projet dans VSCode
   - Appuyer sur `F5` pour lancer une nouvelle fenêtre VSCode avec l'extension
   - Ouvrir un fichier `.nc` ou `.zarr` pour tester

### Configuration

L'extension peut être configurée via les paramètres VSCode :

- `scientificDataViewer.pythonPath` : Chemin vers l'interpréteur Python
- `scientificDataViewer.maxFileSize` : Taille maximale de fichier en MB
- `scientificDataViewer.autoRefresh` : Actualisation automatique

### Maintenance

1. **Mise à jour des dépendances** :
   ```bash
   npm update
   ```

2. **Tests** :
   ```bash
   npm test
   ```

3. **Linting** :
   ```bash
   npm run lint
   ```

### Publication sur le Marketplace VSCode

1. **Installation de vsce** :
   ```bash
   npm install -g @vscode/vsce
   ```

2. **Connexion à Azure DevOps** :
   ```bash
   vsce login <publisher-name>
   ```

3. **Emballage de l'extension** :
   ```bash
   vsce package
   ```

4. **Publication** :
   ```bash
   vsce publish
   ```

### Structure du projet

```
scientific-data-viewer/
├── src/
│   ├── extension.ts              # Point d'entrée principal
│   ├── dataViewerManager.ts      # Gestionnaire de données
│   ├── pythonExecutor.ts         # Intégration Python
│   ├── types.ts                  # Définitions de types
│   └── providers/                # Fournisseurs d'éditeurs personnalisés
├── python/                       # Scripts Python
├── media/                        # Ressources frontend
├── package.json                  # Manifest de l'extension
└── tsconfig.json                 # Configuration TypeScript
```

Cette extension offre une solution complète pour visualiser les fichiers de données scientifiques directement dans VSCode, avec une interface utilisateur moderne et des fonctionnalités avancées de visualisation.

```json
{
  "name": "scientific-data-viewer",
  "displayName": "Scientific Data Viewer",
  "description": "View and analyze scientific data files (NetCDF, Zarr, HDF5) directly in VSCode",
  "version": "1.0.0",
  "publisher": "your-company",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Data Science",
    "Visualization",
    "Other"
  ],
  "keywords": [
    "netcdf",
    "zarr",
    "hdf5",
    "scientific",
    "data",
    "visualization",
    "xarray"
  ],
  "activationEvents": [
    "onCommand:scientificDataViewer.openFile",
    "onCustomEditor:scientificDataViewer.netcdfViewer"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "scientificDataViewer.openFile",
        "title": "Open with Scientific Data Viewer",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.refreshView",
        "title": "Refresh View",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.exportData",
        "title": "Export Data",
        "category": "Scientific Data"
      }
    ],
    "customEditors": [
      {
        "viewType": "scientificDataViewer.netcdfViewer",
        "displayName": "NetCDF Viewer",
        "selector": [
          {
            "filenamePattern": "*.nc"
          },
          {
            "filenamePattern": "*.netcdf"
          }
        ]
      },
      {
        "viewType": "scientificDataViewer.zarrViewer",
        "displayName": "Zarr Viewer",
        "selector": [
          {
            "filenamePattern": "*.zarr"
          }
        ]
      }
    ],
    "menus": {
      "explorer/context": [
        {
          "command": "scientificDataViewer.openFile",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ],
      "editor/title": [
        {
          "command": "scientificDataViewer.refreshView",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        },
        {
          "command": "scientificDataViewer.exportData",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "Scientific Data Viewer",
      "properties": {
        "scientificDataViewer.pythonPath": {
          "type": "string",
          "default": "python",
          "description": "Path to Python interpreter"
        },
        "scientificDataViewer.maxFileSize": {
          "type": "number",
          "default": 100,
          "description": "Maximum file size in MB to load"
        },
        "scientificDataViewer.autoRefresh": {
          "type": "boolean",
          "default": true,
          "description": "Automatically refresh view when file changes"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile && npm run lint",
    "lint": "eslint src --ext ts",
    "test": "node ./out/test/runTest.js"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "16.x",
    "@typescript-eslint/eslint-plugin": "^5.45.0",
    "@typescript-eslint/parser": "^5.45.0",
    "eslint": "^8.28.0",
    "typescript": "^4.9.4"
  },
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": [
      "ES2020"
    ],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true
  },
  "exclude": [
    "node_modules",
    ".vscode-test"
  ]
}
```

```typescript
import * as vscode from 'vscode';
import { NetCDFViewerProvider } from './providers/netcdfViewerProvider';
import { ZarrViewerProvider } from './providers/zarrViewerProvider';
import { DataViewerManager } from './dataViewerManager';
import { PythonExecutor } from './pythonExecutor';

export function activate(context: vscode.ExtensionContext) {
    console.log('Scientific Data Viewer extension is now active!');

    const pythonExecutor = new PythonExecutor();
    const dataViewerManager = new DataViewerManager(pythonExecutor);

    // Register custom editors
    const netcdfProvider = new NetCDFViewerProvider(dataViewerManager);
    const zarrProvider = new ZarrViewerProvider(dataViewerManager);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'scientificDataViewer.netcdfViewer',
            netcdfProvider,
            {
                supportsMultipleEditorsPerDocument: false,
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'scientificDataViewer.zarrViewer',
            zarrProvider,
            {
                supportsMultipleEditorsPerDocument: false,
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Register commands
    const openFileCommand = vscode.commands.registerCommand(
        'scientificDataViewer.openFile',
        async (uri: vscode.Uri) => {
            if (uri) {
                await vscode.commands.executeCommand('vscode.openWith', uri, 'scientificDataViewer.netcdfViewer');
            }
        }
    );

    const refreshCommand = vscode.commands.registerCommand(
        'scientificDataViewer.refreshView',
        () => {
            dataViewerManager.refreshCurrentView();
        }
    );

    const exportCommand = vscode.commands.registerCommand(
        'scientificDataViewer.exportData',
        () => {
            dataViewerManager.exportCurrentData();
        }
    );

    context.subscriptions.push(openFileCommand, refreshCommand, exportCommand);

    // Check Python environment on activation
    pythonExecutor.checkPythonEnvironment().then(isValid => {
        if (!isValid) {
            vscode.window.showWarningMessage(
                'Scientific Data Viewer: Python environment not properly configured. ' +
                'Please ensure Python with xarray and netCDF4 is installed.'
            );
        }
    });
}

export function deactivate() {
    console.log('Scientific Data Viewer extension is now deactivated!');
}
```

```typescript
import * as vscode from 'vscode';
import { PythonExecutor } from './pythonExecutor';
import { DataFileInfo, VariableInfo } from './types';

export class DataViewerManager {
    private currentView: vscode.WebviewPanel | undefined;
    private pythonExecutor: PythonExecutor;

    constructor(pythonExecutor: PythonExecutor) {
        this.pythonExecutor = pythonExecutor;
    }

    async openFile(uri: vscode.Uri, webview: vscode.Webview): Promise<void> {
        try {
            const fileInfo = await this.pythonExecutor.readDataFile(uri.fsPath);
            this.updateWebview(webview, fileInfo);
        } catch (error) {
            this.showError(webview, `Failed to open file: ${error}`);
        }
    }

    async refreshCurrentView(): Promise<void> {
        if (this.currentView) {
            const uri = this.currentView.webview.uri;
            if (uri) {
                await this.openFile(uri, this.currentView.webview);
            }
        }
    }

    async exportCurrentData(): Promise<void> {
        if (this.currentView) {
            const uri = this.currentView.webview.uri;
            if (uri) {
                const fileInfo = await this.pythonExecutor.readDataFile(uri.fsPath);
                const exportData = this.prepareExportData(fileInfo);
                
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`${uri.fsPath}.export.json`),
                    filters: {
                        'JSON': ['json'],
                        'CSV': ['csv'],
                        'All Files': ['*']
                    }
                });

                if (saveUri) {
                    await this.pythonExecutor.exportData(fileInfo, saveUri.fsPath);
                    vscode.window.showInformationMessage(`Data exported to ${saveUri.fsPath}`);
                }
            }
        }
    }

    setCurrentView(panel: vscode.WebviewPanel): void {
        this.currentView = panel;
    }

    private updateWebview(webview: vscode.Webview, fileInfo: DataFileInfo): void {
        const html = this.generateWebviewContent(webview, fileInfo);
        webview.html = html;
    }

    private showError(webview: vscode.Webview, message: string): void {
        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Scientific Data Viewer - Error</title>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
                    .error { color: var(--vscode-errorForeground); padding: 20px; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>Error</h2>
                    <p>${message}</p>
                </div>
            </body>
            </html>
        `;
        webview.html = html;
    }

    private generateWebviewContent(webview: vscode.Webview, fileInfo: DataFileInfo): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
            vscode.Uri.file(__dirname), '..', 'media', 'viewer.js'
        ));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(
            vscode.Uri.file(__dirname), '..', 'media', 'viewer.css'
        ));

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Scientific Data Viewer</title>
                <link href="${styleUri}" rel="stylesheet">
                <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            </head>
            <body>
                <div class="container">
                    <header class="header">
                        <h1>Scientific Data Viewer</h1>
                        <div class="file-info">
                            <span class="file-name">${fileInfo.fileName}</span>
                            <span class="file-size">${this.formatFileSize(fileInfo.fileSize)}</span>
                        </div>
                    </header>
                    
                    <div class="content">
                        <div class="sidebar">
                            <h3>Variables</h3>
                            <div class="variables-list">
                                ${fileInfo.variables.map(variable => `
                                    <div class="variable-item" data-variable="${variable.name}">
                                        <div class="variable-name">${variable.name}</div>
                                        <div class="variable-dims">${variable.dimensions.join(' × ')}</div>
                                        <div class="variable-type">${variable.type}</div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <h3>Dimensions</h3>
                            <div class="dimensions-list">
                                ${fileInfo.dimensions.map(dim => `
                                    <div class="dimension-item">
                                        <span class="dim-name">${dim.name}</span>
                                        <span class="dim-size">${dim.size}</span>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <h3>Attributes</h3>
                            <div class="attributes-list">
                                ${fileInfo.attributes.map(attr => `
                                    <div class="attribute-item">
                                        <span class="attr-name">${attr.name}</span>
                                        <span class="attr-value">${attr.value}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="main-content">
                            <div class="plot-container">
                                <div id="plot-area"></div>
                            </div>
                            <div class="data-table-container">
                                <div id="data-table"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script>
                    window.fileData = ${JSON.stringify(fileInfo)};
                </script>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

    private prepareExportData(fileInfo: DataFileInfo): any {
        return {
            fileName: fileInfo.fileName,
            fileSize: fileInfo.fileSize,
            format: fileInfo.format,
            variables: fileInfo.variables,
            dimensions: fileInfo.dimensions,
            attributes: fileInfo.attributes,
            timestamp: new Date().toISOString()
        };
    }

    private formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}
```

```typescript
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { DataFileInfo, VariableInfo, DimensionInfo, AttributeInfo } from './types';

export class PythonExecutor {
    private pythonPath: string;

    constructor() {
        this.pythonPath = vscode.workspace.getConfiguration('scientificDataViewer').get('pythonPath', 'python');
    }

    async checkPythonEnvironment(): Promise<boolean> {
        try {
            const result = await this.executePythonScript('check_environment.py');
            return result.success;
        } catch (error) {
            return false;
        }
    }

    async readDataFile(filePath: string): Promise<DataFileInfo> {
        const scriptPath = path.join(__dirname, '..', 'python', 'read_data_file.py');
        const result = await this.executePythonScript(scriptPath, [filePath]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to read data file');
        }

        return result.data;
    }

    async exportData(fileInfo: DataFileInfo, outputPath: string): Promise<void> {
        const scriptPath = path.join(__dirname, '..', 'python', 'export_data.py');
        const result = await this.executePythonScript(scriptPath, [
            JSON.stringify(fileInfo),
            outputPath
        ]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to export data');
        }
    }

    async getVariableData(filePath: string, variableName: string): Promise<any> {
        const scriptPath = path.join(__dirname, '..', 'python', 'get_variable_data.py');
        const result = await this.executePythonScript(scriptPath, [filePath, variableName]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to get variable data');
        }

        return result.data;
    }

    private executePythonScript(scriptPath: string, args: string[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            const pythonArgs = [scriptPath, ...args];
            const process = child_process.spawn(this.pythonPath, pythonArgs, {
                cwd: path.dirname(scriptPath)
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse Python output: ${stdout}`));
                    }
                } else {
                    reject(new Error(`Python script failed: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }
}
```

```typescript
export interface DataFileInfo {
    fileName: string;
    fileSize: number;
    format: string;
    variables: VariableInfo[];
    dimensions: DimensionInfo[];
    attributes: AttributeInfo[];
}

export interface VariableInfo {
    name: string;
    dimensions: string[];
    type: string;
    shape: number[];
    attributes: AttributeInfo[];
}

export interface DimensionInfo {
    name: string;
    size: number;
    attributes: AttributeInfo[];
}

export interface AttributeInfo {
    name: string;
    value: any;
    type: string;
}
```

```typescript
import * as vscode from 'vscode';
import { DataViewerManager } from '../dataViewerManager';

export class NetCDFViewerProvider implements vscode.CustomTextEditorProvider {
    constructor(private dataViewerManager: DataViewerManager) {}

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.dataViewerManager.setCurrentView(webviewPanel);
        await this.dataViewerManager.openFile(document.uri, webviewPanel.webview);

        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'getVariableData':
                        try {
                            const data = await this.dataViewerManager.getVariableData(
                                document.uri.fsPath,
                                message.variableName
                            );
                            webviewPanel.webview.postMessage({
                                type: 'variableData',
                                data: data
                            });
                        } catch (error) {
                            webviewPanel.webview.postMessage({
                                type: 'error',
                                message: error.message
                            });
                        }
                        break;
                }
            }
        );
    }
}
```

```typescript
import * as vscode from 'vscode';
import { DataViewerManager } from '../dataViewerManager';

export class ZarrViewerProvider implements vscode.CustomTextEditorProvider {
    constructor(private dataViewerManager: DataViewerManager) {}

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.dataViewerManager.setCurrentView(webviewPanel);
        await this.dataViewerManager.openFile(document.uri, webviewPanel.webview);

        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'getVariableData':
                        try {
                            const data = await this.dataViewerManager.getVariableData(
                                document.uri.fsPath,
                                message.variableName
                            );
                            webviewPanel.webview.postMessage({
                                type: 'variableData',
                                data: data
                            });
                        } catch (error) {
                            webviewPanel.webview.postMessage({
                                type: 'error',
                                message: error.message
                            });
                        }
                        break;
                }
            }
        );
    }
}
```

```python
#!/usr/bin/env python3
"""
Python script to read scientific data files and return metadata.
"""

import sys
import json
import os
import xarray as xr
import numpy as np
from pathlib import Path

def read_data_file(file_path):
    """Read a scientific data file and return metadata."""
    try:
        # Determine file format
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
            format_name = 'NetCDF'
        elif file_ext == '.zarr':
            ds = xr.open_zarr(file_path)
            format_name = 'Zarr'
        else:
            # Try to open as generic xarray dataset
            ds = xr.open_dataset(file_path)
            format_name = 'Unknown'
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Extract variables information
        variables = []
        for var_name, var in ds.variables.items():
            var_info = {
                'name': var_name,
                'dimensions': list(var.dims),
                'type': str(var.dtype),
                'shape': list(var.shape),
                'attributes': [{'name': k, 'value': str(v), 'type': type(v).__name__} 
                              for k, v in var.attrs.items()]
            }
            variables.append(var_info)
        
        # Extract dimensions information
        dimensions = []
        for dim_name, dim_size in ds.dims.items():
            dim_info = {
                'name': dim_name,
                'size': dim_size,
                'attributes': []
            }
            dimensions.append(dim_info)
        
        # Extract global attributes
        attributes = [{'name': k, 'value': str(v), 'type': type(v).__name__} 
                    for k, v in ds.attrs.items()]
        
        # Create result
        result = {
            'fileName': os.path.basename(file_path),
            'fileSize': file_size,
            'format': format_name,
            'variables': variables,
            'dimensions': dimensions,
            'attributes': attributes
        }
        
        return {'success': True, 'data': result}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({'success': False, 'error': 'Usage: python read_data_file.py <file_path>'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = read_data_file(file_path)
    print(json.dumps(result))
```

```python
#!/usr/bin/env python3
"""
Check if required Python packages are available.
"""

import sys
import json

def check_environment():
    """Check if required packages are installed."""
    required_packages = ['xarray', 'netCDF4', 'numpy', 'pandas']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        return {
            'success': False,
            'error': f'Missing packages: {", ".join(missing_packages)}'
        }
    else:
        return {'success': True}

if __name__ == '__main__':
    result = check_environment()
    print(json.dumps(result))
```

```python
#!/usr/bin/env python3
"""
Extract variable data for visualization.
"""

import sys
import json
import xarray as xr
import numpy as np

def get_variable_data(file_path, variable_name):
    """Get data for a specific variable."""
    try:
        # Open dataset
        file_ext = file_path.split('.')[-1].lower()
        if file_ext in ['nc', 'netcdf']:
            ds = xr.open_dataset(file_path)
        elif file_ext == 'zarr':
            ds = xr.open_zarr(file_path)
        else:
            ds = xr.open_dataset(file_path)
        
        # Get variable
        if variable_name not in ds.variables:
            return {'success': False, 'error': f'Variable {variable_name} not found'}
        
        var = ds.variables[variable_name]
        
        # Convert to numpy array for JSON serialization
        data = var.values
        
        # Handle different data types
        if data.dtype.kind in ['U', 'S']:  # String types
            data = data.astype(str).tolist()
        elif data.dtype.kind in ['f', 'i']:  # Numeric types
            # Convert NaN to None for JSON serialization
            data = np.where(np.isnan(data), None, data).tolist()
        else:
            data = data.tolist()
        
        result = {
            'name': variable_name,
            'data': data,
            'shape': list(var.shape),
            'dims': list(var.dims),
            'attributes': dict(var.attrs)
        }
        
        return {'success': True, 'data': result}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({'success': False, 'error': 'Usage: python get_variable_data.py <file_path> <variable_name>'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    variable_name = sys.argv[2]
    result = get_variable_data(file_path, variable_name)
    print(json.dumps(result))
```

```python
#!/usr/bin/env python3
"""
Export scientific data to various formats.
"""

import sys
import json
import xarray as xr
import pandas as pd
from pathlib import Path

def export_data(file_info_json, output_path):
    """Export data to specified format."""
    try:
        file_info = json.loads(file_info_json)
        file_path = file_info.get('originalPath', '')
        
        if not file_path:
            return {'success': False, 'error': 'No file path provided'}
        
        # Open dataset
        file_ext = Path(file_path).suffix.lower()
        if file_ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
        elif file_ext == '.zarr':
            ds = xr.open_zarr(file_path)
        else:
            ds = xr.open_dataset(file_path)
        
        # Determine output format
        output_ext = Path(output_path).suffix.lower()
        
        if output_ext == '.json':
            # Export as JSON
            export_data = {
                'metadata': file_info,
                'variables': {}
            }
            
            for var_name in ds.variables:
                var = ds.variables[var_name]
                export_data['variables'][var_name] = {
                    'data': var.values.tolist() if hasattr(var.values, 'tolist') else str(var.values),
                    'dims': list(var.dims),
                    'attributes': dict(var.attrs)
                }
            
            with open(output_path, 'w') as f:
                json.dump(export_data, f, indent=2)
                
        elif output_ext == '.csv':
            # Export first variable as CSV
            first_var = list(ds.variables.keys())[0]
            var = ds.variables[first_var]
            
            if var.ndim == 1:
                df = pd.DataFrame({first_var: var.values})
            elif var.ndim == 2:
                df = pd.DataFrame(var.values)
            else:
                # Flatten higher dimensional data
                df = pd.DataFrame(var.values.reshape(-1, 1), columns=[first_var])
            
            df.to_csv(output_path, index=False)
            
        else:
            return {'success': False, 'error': f'Unsupported output format: {output_ext}'}
        
        return {'success': True}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({'success': False, 'error': 'Usage: python export_data.py <file_info_json> <output_path>'}))
        sys.exit(1)
    
    file_info_json = sys.argv[1]
    output_path = sys.argv[2]
    result = export_data(file_info_json, output_path)
    print(json.dumps(result))
```

```javascript
// Scientific Data Viewer Frontend
class ScientificDataViewer {
    constructor() {
        this.currentVariable = null;
        this.plotContainer = document.getElementById('plot-area');
        this.tableContainer = document.getElementById('data-table');
        
        this.initializeEventListeners();
        this.initializePlot();
    }

    initializeEventListeners() {
        // Variable selection
        document.querySelectorAll('.variable-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const variableName = e.currentTarget.dataset.variable;
                this.selectVariable(variableName);
            });
        });

        // Listen for messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'variableData':
                    this.displayVariableData(message.data);
                    break;
                case 'error':
                    this.showError(message.message);
                    break;
            }
        });
    }

    selectVariable(variableName) {
        // Update UI
        document.querySelectorAll('.variable-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-variable="${variableName}"]`).classList.add('selected');
        
        this.currentVariable = variableName;
        
        // Request variable data
        this.requestVariableData(variableName);
    }

    requestVariableData(variableName) {
        // Send message to extension
        if (window.vscode) {
            window.vscode.postMessage({
                type: 'getVariableData',
                variableName: variableName
            });
        }
    }

    displayVariableData(data) {
        this.plotData(data);
        this.displayDataTable(data);
    }

    plotData(data) {
        if (!data.data || data.data.length === 0) {
            this.plotContainer.innerHTML = '<p>No data to plot</p>';
            return;
        }

        const plotData = this.preparePlotData(data);
        
        const layout = {
            title: data.name,
            xaxis: { title: 'Index' },
            yaxis: { title: 'Value' },
            margin: { t: 50, r: 50, b: 50, l: 50 }
        };

        Plotly.newPlot(this.plotContainer, plotData, layout, {responsive: true});
    }

    preparePlotData(data) {
        const values = data.data;
        
        if (Array.isArray(values) && values.length > 0) {
            if (typeof values[0] === 'number') {
                // 1D data
                return [{
                    x: Array.from({length: values.length}, (_, i) => i),
                    y: values,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: data.name
                }];
            } else if (Array.isArray(values[0])) {
                // 2D data
                return [{
                    z: values,
                    type: 'heatmap',
                    name: data.name
                }];
            }
        }
        
        return [{
            x: [0],
            y: [0],
            type: 'scatter',
            mode: 'markers',
            name: 'No valid data'
        }];
    }

    displayDataTable(data) {
        if (!data.data || data.data.length === 0) {
            this.tableContainer.innerHTML = '<p>No data to display</p>';
            return;
        }

        const values = data.data;
        let tableHTML = '<table class="data-table"><thead><tr><th>Index</th><th>Value</th></tr></thead><tbody>';
        
        if (Array.isArray(values)) {
            values.slice(0, 100).forEach((value, index) => {
                tableHTML += `<tr><td>${index}</td><td>${value}</td></tr>`;
            });
            
            if (values.length > 100) {
                tableHTML += `<tr><td colspan="2">... and ${values.length - 100} more rows</td></tr>`;
            }
        }
        
        tableHTML += '</tbody></table>';
        this.tableContainer.innerHTML = tableHTML;
    }

    showError(message) {
        this.plotContainer.innerHTML = `<div class="error">Error: ${message}</div>`;
        this.tableContainer.innerHTML = '';
    }

    initializePlot() {
        // Initialize empty plot
        this.plotContainer.innerHTML = '<p>Select a variable to view its data</p>';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScientificDataViewer();
});
```

```css
/* Scientific Data Viewer Styles */
.container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
}

.header {
    padding: 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-panel-background);
}

.header h1 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
}

.file-info {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: var(--vscode-descriptionForeground);
}

.file-name {
    font-weight: 500;
}

.content {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.sidebar {
    width: 300px;
    padding: 16px;
    border-right: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-sideBar-background);
    overflow-y: auto;
}

.sidebar h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--vscode-foreground);
}

.variables-list, .dimensions-list, .attributes-list {
    margin-bottom: 24px;
}

.variable-item, .dimension-item, .attribute-item {
    padding: 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.variable-item:hover, .variable-item.selected {
    background-color: var(--vscode-list-hoverBackground);
}

.variable-item.selected {
    background-color: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}

.variable-name, .dim-name, .attr-name {
    font-weight: 500;
    display: block;
}

.variable-dims, .variable-type, .dim-size, .attr-value {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    margin-top: 2px;
}

.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
    overflow: hidden;
}

.plot-container {
    flex: 1;
    margin-bottom: 16px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    background-color: var(--vscode-editor-background);
}

.data-table-container {
    height: 200px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    background-color: var(--vscode-editor-background);
    overflow: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.data-table th, .data-table td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.data-table th {
    background-color: var(--vscode-panel-background);
    font-weight: 600;
}

.error {
    color: var(--vscode-errorForeground);
    padding: 16px;
    text-align: center;
}

/* Scrollbar styling */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--vscode-scrollbarSlider-background);
}

::-webkit-scrollbar-thumb {
    background: var(--vscode-scrollbarSlider-hoverBackground);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--vscode-scrollbarSlider-activeBackground);
}
```

```shellscript
   # Cloner le repository
   git clone <repository-url>
   cd scientific-data-viewer
   
   # Installer les dépendances
   npm install
   
   # Compiler l'extension
   npm run compile
```

```shellscript
   npm update
```

```shellscript
   npm test
```

```shellscript
   npm run lint
```

```shellscript
   npm install -g @vscode/vsce
```

```shellscript
   vsce login <publisher-name>
```

```shellscript
   vsce package
```

```shellscript
   vsce publish
```

```plaintext
scientific-data-viewer/
├── src/
│   ├── extension.ts              # Point d'entrée principal
│   ├── dataViewerManager.ts      # Gestionnaire de données
│   ├── pythonExecutor.ts         # Intégration Python
│   ├── types.ts                  # Définitions de types
│   └── providers/                # Fournisseurs d'éditeurs personnalisés
├── python/                       # Scripts Python
├── media/                        # Ressources frontend
├── package.json                  # Manifest de l'extension
└── tsconfig.json                 # Configuration TypeScript
```

---

**User**

Okay, so now can you please create a project and open in in this workspace ?

---

**Cursor**

I'll create the VSCode extension project structure in your workspace. Let me start by creating the main project directory and all the necessary files.


Let me check what's available in the current workspace:


It seems we need to create the workspace first. Let me create the complete VSCode extension project structure:


I'll create the complete VSCode extension project structure. Let me start by creating the main project files:

## Creating the Scientific Data Viewer VSCode Extension

I'll create all the necessary files for the extension project:

**1. package.json** - Extension manifest:
```json
{
  "name": "scientific-data-viewer",
  "displayName": "Scientific Data Viewer",
  "description": "View and analyze scientific data files (NetCDF, Zarr, HDF5) directly in VSCode",
  "version": "1.0.0",
  "publisher": "your-company",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Data Science",
    "Visualization",
    "Other"
  ],
  "keywords": [
    "netcdf",
    "zarr",
    "hdf5",
    "scientific",
    "data",
    "visualization",
    "xarray"
  ],
  "activationEvents": [
    "onCommand:scientificDataViewer.openFile",
    "onCustomEditor:scientificDataViewer.netcdfViewer"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "scientificDataViewer.openFile",
        "title": "Open with Scientific Data Viewer",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.refreshView",
        "title": "Refresh View",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.exportData",
        "title": "Export Data",
        "category": "Scientific Data"
      }
    ],
    "customEditors": [
      {
        "viewType": "scientificDataViewer.netcdfViewer",
        "displayName": "NetCDF Viewer",
        "selector": [
          {
            "filenamePattern": "*.nc"
          },
          {
            "filenamePattern": "*.netcdf"
          }
        ]
      },
      {
        "viewType": "scientificDataViewer.zarrViewer",
        "displayName": "Zarr Viewer",
        "selector": [
          {
            "filenamePattern": "*.zarr"
          }
        ]
      }
    ],
    "menus": {
      "explorer/context": [
        {
          "command": "scientificDataViewer.openFile",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ],
      "editor/title": [
        {
          "command": "scientificDataViewer.refreshView",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        },
        {
          "command": "scientificDataViewer.exportData",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "Scientific Data Viewer",
      "properties": {
        "scientificDataViewer.pythonPath": {
          "type": "string",
          "default": "python",
          "description": "Path to Python interpreter"
        },
        "scientificDataViewer.maxFileSize": {
          "type": "number",
          "default": 100,
          "description": "Maximum file size in MB to load"
        },
        "scientificDataViewer.autoRefresh": {
          "type": "boolean",
          "d

```json
{
  "name": "scientific-data-viewer",
  "displayName": "Scientific Data Viewer",
  "description": "View and analyze scientific data files (NetCDF, Zarr, HDF5) directly in VSCode",
  "version": "1.0.0",
  "publisher": "your-company",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Data Science",
    "Visualization",
    "Other"
  ],
  "keywords": [
    "netcdf",
    "zarr",
    "hdf5",
    "scientific",
    "data",
    "visualization",
    "xarray"
  ],
  "activationEvents": [
    "onCommand:scientificDataViewer.openFile",
    "onCustomEditor:scientificDataViewer.netcdfViewer"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "scientificDataViewer.openFile",
        "title": "Open with Scientific Data Viewer",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.refreshView",
        "title": "Refresh View",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.exportData",
        "title": "Export Data",
        "category": "Scientific Data"
      }
    ],
    "customEditors": [
      {
        "viewType": "scientificDataViewer.netcdfViewer",
        "displayName": "NetCDF Viewer",
        "selector": [
          {
            "filenamePattern": "*.nc"
          },
          {
            "filenamePattern": "*.netcdf"
          }
        ]
      },
      {
        "viewType": "scientificDataViewer.zarrViewer",
        "displayName": "Zarr Viewer",
        "selector": [
          {
            "filenamePattern": "*.zarr"
          }
        ]
      }
    ],
    "menus": {
      "explorer/context": [
        {
          "command": "scientificDataViewer.openFile",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ],
      "editor/title": [
        {
          "command": "scientificDataViewer.refreshView",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        },
        {
          "command": "scientificDataViewer.exportData",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "Scientific Data Viewer",
      "properties": {
        "scientificDataViewer.pythonPath": {
          "type": "string",
          "default": "python",
          "description": "Path to Python interpreter"
        },
        "scientificDataViewer.maxFileSize": {
          "type": "number",
          "default": 100,
          "description": "Maximum file size in MB to load"
        },
        "scientificDataViewer.autoRefresh": {
          "type": "boolean",
          "d
```

---

**User**

No, please create a directory with all the files you created in your first answer. I want you to help me open it in Cursor afterwards

---

**Cursor**

I'll create the complete VSCode extension project structure with all the files. Let me create the directory and all the necessary files for the Scientific Data Viewer extension.

First, let me create the main project directory and structure:

**Creating the project structure:**

1. **package.json** - Extension manifest
2. **tsconfig.json** - TypeScript configuration  
3. **src/** directory with all TypeScript files
4. **python/** directory with Python scripts
5. **media/** directory with frontend assets
6. **README.md** - Documentation
7. **.gitignore** - Git ignore file

Let me create these files systematically:

**package.json:**
```json
{
  "name": "scientific-data-viewer",
  "displayName": "Scientific Data Viewer",
  "description": "View and analyze scientific data files (NetCDF, Zarr, HDF5) directly in VSCode",
  "version": "1.0.0",
  "publisher": "your-company",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Data Science",
    "Visualization",
    "Other"
  ],
  "keywords": [
    "netcdf",
    "zarr",
    "hdf5",
    "scientific",
    "data",
    "visualization",
    "xarray"
  ],
  "activationEvents": [
    "onCommand:scientificDataViewer.openFile",
    "onCustomEditor:scientificDataViewer.netcdfViewer"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "scientificDataViewer.openFile",
        "title": "Open with Scientific Data Viewer",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.refreshView",
        "title": "Refresh View",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.exportData",
        "title": "Export Data",
        "category": "Scientific Data"
      }
    ],
    "customEditors": [
      {
        "viewType": "scientificDataViewer.netcdfViewer",
        "displayName": "NetCDF Viewer",
        "selector": [
          {
            "filenamePattern": "*.nc"
          },
          {
            "filenamePattern": "*.netcdf"
          }
        ]
      },
      {
        "viewType": "scientificDataViewer.zarrViewer",
        "displayName": "Zarr Viewer",
        "selector": [
          {
            "filenamePattern": "*.zarr"
          }
        ]
      }
    ],
    "menus": {
      "explorer/context": [
        {
          "command": "scientificDataViewer.openFile",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ],
      "editor/title": [
        {
          "command": "scientificDataViewer.refreshView",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        },
        {
          "command": "scientificDataViewer.exportData",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "Scientific Data Viewer",
      "properties": {
        "scientificDataViewer.pythonPath": {
          "type": "string",
          "default": "python",
          "description": "Path to Python interpreter"
        },
        "scientificDataViewer.maxFileSize": {
          "type": "number",
          "default": 100,
          "description": "Maximum file size in MB to load"
        },
        "scientificDataViewer.autoRefresh": {
          "type": "boolean",
          "default": true,
          "description": "Automatically refresh view when file changes"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile && npm run lint",
    "lint": "eslint src --ext ts",
    "test": "node ./out/test/runTest.js"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "16.x",
    "@typescript-eslint/eslint-plugin": "^5.45.0",
    "@typescript-eslint/parser": "^5.45.0",
    "eslint": "^8.28.0",
    "typescript": "^4.9.4"
  },
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": [
      "ES2020"
    ],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true
  },
  "exclude": [
    "node_modules",
    ".vscode-test"
  ]
}
```

**src/extension.ts:**
```typescript
import * as vscode from 'vscode';
import { NetCDFViewerProvider } from './providers/netcdfViewerProvider';
import { ZarrViewerProvider } from './providers/zarrViewerProvider';
import { DataViewerManager } from './dataViewerManager';
import { PythonExecutor } from './pythonExecutor';

export function activate(context: vscode.ExtensionContext) {
    console.log('Scientific Data Viewer extension is now active!');

    const pythonExecutor = new PythonExecutor();
    const dataViewerManager = new DataViewerManager(pythonExecutor);

    // Register custom editors
    const netcdfProvider = new NetCDFViewerProvider(dataViewerManager);
    const zarrProvider = new ZarrViewerProvider(dataViewerManager);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'scientificDataViewer.netcdfViewer',
            netcdfProvider,
            {
                supportsMultipleEditorsPerDocument: false,
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'scientificDataViewer.zarrViewer',
            zarrProvider,
            {
                supportsMultipleEditorsPerDocument: false,
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Register commands
    const openFileCommand = vscode.commands.registerCommand(
        'scientificDataViewer.openFile',
        async (uri: vscode.Uri) => {
            if (uri) {
                await vscode.commands.executeCommand('vscode.openWith', uri, 'scientificDataViewer.netcdfViewer');
            }
        }
    );

    const refreshCommand = vscode.commands.registerCommand(
        'scientificDataViewer.refreshView',
        () => {
            dataViewerManager.refreshCurrentView();
        }
    );

    const exportCommand = vscode.commands.registerCommand(
        'scientificDataViewer.exportData',
        () => {
            dataViewerManager.exportCurrentData();
        }
    );

    context.subscriptions.push(openFileCommand, refreshCommand, exportCommand);

    // Check Python environment on activation
    pythonExecutor.checkPythonEnvironment().then(isValid => {
        if (!isValid) {
            vscode.window.showWarningMessage(
                'Scientific Data Viewer: Python environment not properly configured. ' +
                'Please ensure Python with xarray and netCDF4 is installed.'
            );
        }
    });
}

export function deactivate() {
    console.log('Scientific Data Viewer extension is now deactivated!');
}
```

**src/types.ts:**
```typescript
export interface DataFileInfo {
    fileName: string;
    fileSize: number;
    format: string;
    variables: VariableInfo[];
    dimensions: DimensionInfo[];
    attributes: AttributeInfo[];
}

export interface VariableInfo {
    name: string;
    dimensions: string[];
    type: string;
    shape: number[];
    attributes: AttributeInfo[];
}

export interface DimensionInfo {
    name: string;
    size: number;
    attributes: AttributeInfo[];
}

export interface AttributeInfo {
    name: string;
    value: any;
    type: string;
}
```

**src/dataViewerManager.ts:**
```typescript
import * as vscode from 'vscode';
import { PythonExecutor } from './pythonExecutor';
import { DataFileInfo, VariableInfo } from './types';

export class DataViewerManager {
    private currentView: vscode.WebviewPanel | undefined;
    private pythonExecutor: PythonExecutor;

    constructor(pythonExecutor: PythonExecutor) {
        this.pythonExecutor = pythonExecutor;
    }

    async openFile(uri: vscode.Uri, webview: vscode.Webview): Promise<void> {
        try {
            const fileInfo = await this.pythonExecutor.readDataFile(uri.fsPath);
            this.updateWebview(webview, fileInfo);
        } catch (error) {
            this.showError(webview, `Failed to open file: ${error}`);
        }
    }

    async refreshCurrentView(): Promise<void> {
        if (this.currentView) {
            const uri = this.currentView.webview.uri;
            if (uri) {
                await this.openFile(uri, this.currentView.webview);
            }
        }
    }

    async exportCurrentData(): Promise<void> {
        if (this.currentView) {
            const uri = this.currentView.webview.uri;
            if (uri) {
                const fileInfo = await this.pythonExecutor.readDataFile(uri.fsPath);
                const exportData = this.prepareExportData(fileInfo);
                
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`${uri.fsPath}.export.json`),
                    filters: {
                        'JSON': ['json'],
                        'CSV': ['csv'],
                        'All Files': ['*']
                    }
                });

                if (saveUri) {
                    await this.pythonExecutor.exportData(fileInfo, saveUri.fsPath);
                    vscode.window.showInformationMessage(`Data exported to ${saveUri.fsPath}`);
                }
            }
        }
    }

    setCurrentView(panel: vscode.WebviewPanel): void {
        this.currentView = panel;
    }

    private updateWebview(webview: vscode.Webview, fileInfo: DataFileInfo): void {
        const html = this.generateWebviewContent(webview, fileInfo);
        webview.html = html;
    }

    private showError(webview: vscode.Webview, message: string): void {
        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Scientific Data Viewer - Error</title>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
                    .error { color: var(--vscode-errorForeground); padding: 20px; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>Error</h2>
                    <p>${message}</p>
                </div>
            </body>
            </html>
        `;
        webview.html = html;
    }

    private generateWebviewContent(webview: vscode.Webview, fileInfo: DataFileInfo): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
            vscode.Uri.file(__dirname), '..', 'media', 'viewer.js'
        ));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(
            vscode.Uri.file(__dirname), '..', 'media', 'viewer.css'
        ));

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Scientific Data Viewer</title>
                <link href="${styleUri}" rel="stylesheet">
                <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            </head>
            <body>
                <div class="container">
                    <header class="header">
                        <h1>Scientific Data Viewer</h1>
                        <div class="file-info">
                            <span class="file-name">${fileInfo.fileName}</span>
                            <span class="file-size">${this.formatFileSize(fileInfo.fileSize)}</span>
                        </div>
                    </header>
                    
                    <div class="content">
                        <div class="sidebar">
                            <h3>Variables</h3>
                            <div class="variables-list">
                                ${fileInfo.variables.map(variable => `
                                    <div class="variable-item" data-variable="${variable.name}">
                                        <div class="variable-name">${variable.name}</div>
                                        <div class="variable-dims">${variable.dimensions.join(' × ')}</div>
                                        <div class="variable-type">${variable.type}</div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <h3>Dimensions</h3>
                            <div class="dimensions-list">
                                ${fileInfo.dimensions.map(dim => `
                                    <div class="dimension-item">
                                        <span class="dim-name">${dim.name}</span>
                                        <span class="dim-size">${dim.size}</span>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <h3>Attributes</h3>
                            <div class="attributes-list">
                                ${fileInfo.attributes.map(attr => `
                                    <div class="attribute-item">
                                        <span class="attr-name">${attr.name}</span>
                                        <span class="attr-value">${attr.value}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="main-content">
                            <div class="plot-container">
                                <div id="plot-area"></div>
                            </div>
                            <div class="data-table-container">
                                <div id="data-table"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script>
                    window.fileData = ${JSON.stringify(fileInfo)};
                </script>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

    private prepareExportData(fileInfo: DataFileInfo): any {
        return {
            fileName: fileInfo.fileName,
            fileSize: fileInfo.fileSize,
            format: fileInfo.format,
            variables: fileInfo.variables,
            dimensions: fileInfo.dimensions,
            attributes: fileInfo.attributes,
            timestamp: new Date().toISOString()
        };
    }

    private formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}
```

**src/pythonExecutor.ts:**
```typescript
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { DataFileInfo, VariableInfo, DimensionInfo, AttributeInfo } from './types';

export class PythonExecutor {
    private pythonPath: string;

    constructor() {
        this.pythonPath = vscode.workspace.getConfiguration('scientificDataViewer').get('pythonPath', 'python');
    }

    async checkPythonEnvironment(): Promise<boolean> {
        try {
            const result = await this.executePythonScript('check_environment.py');
            return result.success;
        } catch (error) {
            return false;
        }
    }

    async readDataFile(filePath: string): Promise<DataFileInfo> {
        const scriptPath = path.join(__dirname, '..', 'python', 'read_data_file.py');
        const result = await this.executePythonScript(scriptPath, [filePath]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to read data file');
        }

        return result.data;
    }

    async exportData(fileInfo: DataFileInfo, outputPath: string): Promise<void> {
        const scriptPath = path.join(__dirname, '..', 'python', 'export_data.py');
        const result = await this.executePythonScript(scriptPath, [
            JSON.stringify(fileInfo),
            outputPath
        ]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to export data');
        }
    }

    async getVariableData(filePath: string, variableName: string): Promise<any> {
        const scriptPath = path.join(__dirname, '..', 'python', 'get_variable_data.py');
        const result = await this.executePythonScript(scriptPath, [filePath, variableName]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to get variable data');
        }

        return result.data;
    }

    private executePythonScript(scriptPath: string, args: string[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            const pythonArgs = [scriptPath, ...args];
            const process = child_process.spawn(this.pythonPath, pythonArgs, {
                cwd: path.dirname(scriptPath)
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse Python output: ${stdout}`));
                    }
                } else {
                    reject(new Error(`Python script failed: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }
}
```

**src/providers/netcdfViewerProvider.ts:**
```typescript
import * as vscode from 'vscode';
import { DataViewerManager } from '../dataViewerManager';

export class NetCDFViewerProvider implements vscode.CustomTextEditorProvider {
    constructor(private dataViewerManager: DataViewerManager) {}

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.dataViewerManager.setCurrentView(webviewPanel);
        await this.dataViewerManager.openFile(document.uri, webviewPanel.webview);

        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'getVariableData':
                        try {
                            const data = await this.dataViewerManager.getVariableData(
                                document.uri.fsPath,
                                message.variableName
                            );
                            webviewPanel.webview.postMessage({
                                type: 'variableData',
                                data: data
                            });
                        } catch (error) {
                            webviewPanel.webview.postMessage({
                                type: 'error',
                                message: error.message
                            });
                        }
                        break;
                }
            }
        );
    }
}
```

**src/providers/zarrViewerProvider.ts:**
```typescript
import * as vscode from 'vscode';
import { DataViewerManager } from '../dataViewerManager';

export class ZarrViewerProvider implements vscode.CustomTextEditorProvider {
    constructor(private dataViewerManager: DataViewerManager) {}

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.dataViewerManager.setCurrentView(webviewPanel);
        await this.dataViewerManager.openFile(document.uri, webviewPanel.webview);

        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'getVariableData':
                        try {
                            const data = await this.dataViewerManager.getVariableData(
                                document.uri.fsPath,
                                message.variableName
                            );
                            webviewPanel.webview.postMessage({
                                type: 'variableData',
                                data: data
                            });
                        } catch (error) {
                            webviewPanel.webview.postMessage({
                                type: 'error',
                                message: error.message
                            });
                        }
                        break;
                }
            }
        );
    }
}
```

**python/read_data_file.py:**
```python
#!/usr/bin/env python3
"""
Python script to read scientific data files and return metadata.
"""

import sys
import json
import os
import xarray as xr
import numpy as np
from pathlib import Path

def read_data_file(file_path):
    """Read a scientific data file and return metadata."""
    try:
        # Determine file format
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
            format_name = 'NetCDF'
        elif file_ext == '.zarr':
            ds = xr.open_zarr(file_path)
            format_name = 'Zarr'
        else:
            # Try to open as generic xarray dataset
            ds = xr.open_dataset(file_path)
            format_name = 'Unknown'
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Extract variables information
        variables = []
        for var_name, var in ds.variables.items():
            var_info = {
                'name': var_name,
                'dimensions': list(var.dims),
                'type': str(var.dtype),
                'shape': list(var.shape),
                'attributes': [{'name': k, 'value': str(v), 'type': type(v).__name__} 
                              for k, v in var.attrs.items()]
            }
            variables.append(var_info)
        
        # Extract dimensions information
        dimensions = []
        for dim_name, dim_size in ds.dims.items():
            dim_info = {
                'name': dim_name,
                'size': dim_size,
                'attributes': []
            }
            dimensions.append(dim_info)
        
        # Extract global attributes
        attributes = [{'name': k, 'value': str(v), 'type': type(v).__name__} 
                    for k, v in ds.attrs.items()]
        
        # Create result
        result = {
            'fileName': os.path.basename(file_path),
            'fileSize': file_size,
            'format': format_name,
            'variables': variables,
            'dimensions': dimensions,
            'attributes': attributes
        }
        
        return {'success': True, 'data': result}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({'success': False, 'error': 'Usage: python read_data_file.py <file_path>'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = read_data_file(file_path)
    print(json.dumps(result))
```

**python/check_environment.py:**
```python
#!/usr/bin/env python3
"""
Check if required Python packages are available.
"""

import sys
import json

def check_environment():
    """Check if required packages are installed."""
    required_packages = ['xarray', 'netCDF4', 'numpy', 'pandas']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        return {
            'success': False,
            'error': f'Missing packages: {", ".join(missing_packages)}'
        }
    else:
        return {'success': True}

if __name__ == '__main__':
    result = check_environment()
    print(json.dumps(result))
```

**python/get_variable_data.py:**
```python
#!/usr/bin/env python3
"""
Extract variable data for visualization.
"""

import sys
import json
import xarray as xr
import numpy as np

def get_variable_data(file_path, variable_name):
    """Get data for a specific variable."""
    try:
        # Open dataset
        file_ext = file_path.split('.')[-1].lower()
        if file_ext in ['nc', 'netcdf']:
            ds = xr.open_dataset(file_path)
        elif file_ext == 'zarr':
            ds = xr.open_zarr(file_path)
        else:
            ds = xr.open_dataset(file_path)
        
        # Get variable
        if variable_name not in ds.variables:
            return {'success': False, 'error': f'Variable {variable_name} not found'}
        
        var = ds.variables[variable_name]
        
        # Convert to numpy array for JSON serialization
        data = var.values
        
        # Handle different data types
        if data.dtype.kind in ['U', 'S']:  # String types
            data = data.astype(str).tolist()
        elif data.dtype.kind in ['f', 'i']:  # Numeric types
            # Convert NaN to None for JSON serialization
            data = np.where(np.isnan(data), None, data).tolist()
        else:
            data = data.tolist()
        
        result = {
            'name': variable_name,
            'data': data,
            'shape': list(var.shape),
            'dims': list(var.dims),
            'attributes': dict(var.attrs)
        }
        
        return {'success': True, 'data': result}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({'success': False, 'error': 'Usage: python get_variable_data.py <file_path> <variable_name>'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    variable_name = sys.argv[2]
    result = get_variable_data(file_path, variable_name)
    print(json.dumps(result))
```

**python/export_data.py:**
```python
#!/usr/bin/env python3
"""
Export scientific data to various formats.
"""

import sys
import json
import xarray as xr
import pandas as pd
from pathlib import Path

def export_data(file_info_json, output_path):
    """Export data to specified format."""
    try:
        file_info = json.loads(file_info_json)
        file_path = file_info.get('originalPath', '')
        
        if not file_path:
            return {'success': False, 'error': 'No file path provided'}
        
        # Open dataset
        file_ext = Path(file_path).suffix.lower()
        if file_ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
        elif file_ext == '.zarr':
            ds = xr.open_zarr(file_path)
        else:
            ds = xr.open_dataset(file_path)
        
        # Determine output format
        output_ext = Path(output_path).suffix.lower()
        
        if output_ext == '.json':
            # Export as JSON
            export_data = {
                'metadata': file_info,
                'variables': {}
            }
            
            for var_name in ds.variables:
                var = ds.variables[var_name]
                export_data['variables'][var_name] = {
                    'data': var.values.tolist() if hasattr(var.values, 'tolist') else str(var.values),
                    'dims': list(var.dims),
                    'attributes': dict(var.attrs)
                }
            
            with open(output_path, 'w') as f:
                json.dump(export_data, f, indent=2)
                
        elif output_ext == '.csv':
            # Export first variable as CSV
            first_var = list(ds.variables.keys())[0]
            var = ds.variables[first_var]
            
            if var.ndim == 1:
                df = pd.DataFrame({first_var: var.values})
            elif var.ndim == 2:
                df = pd.DataFrame(var.values)
            else:
                # Flatten higher dimensional data
                df = pd.DataFrame(var.values.reshape(-1, 1), columns=[first_var])
            
            df.to_csv(output_path, index=False)
            
        else:
            return {'success': False, 'error': f'Unsupported output format: {output_ext}'}
        
        return {'success': True}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({'success': False, 'error': 'Usage: python export_data.py <file_info_json> <output_path>'}))
        sys.exit(1)
    
    file_info_json = sys.argv[1]
    output_path = sys.argv[2]
    result = export_data(file_info_json, output_path)
    print(json.dumps(result))
```

**media/viewer.js:**
```javascript
// Scientific Data Viewer Frontend
class ScientificDataViewer {
    constructor() {
        this.currentVariable = null;
        this.plotContainer = document.getElementById('plot-area');
        this.tableContainer = document.getElementById('data-table');
        
        this.initializeEventListeners();
        this.initializePlot();
    }

    initializeEventListeners() {
        // Variable selection
        document.querySelectorAll('.variable-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const variableName = e.currentTarget.dataset.variable;
                this.selectVariable(variableName);
            });
        });

        // Listen for messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'variableData':
                    this.displayVariableData(message.data);
                    break;
                case 'error':
                    this.showError(message.message);
                    break;
            }
        });
    }

    selectVariable(variableName) {
        // Update UI
        document.querySelectorAll('.variable-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-variable="${variableName}"]`).classList.add('selected');
        
        this.currentVariable = variableName;
        
        // Request variable data
        this.requestVariableData(variableName);
    }

    requestVariableData(variableName) {
        // Send message to extension
        if (window.vscode) {
            window.vscode.postMessage({
                type: 'getVariableData',
                variableName: variableName
            });
        }
    }

    displayVariableData(data) {
        this.plotData(data);
        this.displayDataTable(data);
    }

    plotData(data) {
        if (!data.data || data.data.length === 0) {
            this.plotContainer.innerHTML = '<p>No data to plot</p>';
            return;
        }

        const plotData = this.preparePlotData(data);
        
        const layout = {
            title: data.name,
            xaxis: { title: 'Index' },
            yaxis: { title: 'Value' },
            margin: { t: 50, r: 50, b: 50, l: 50 }
        };

        Plotly.newPlot(this.plotContainer, plotData, layout, {responsive: true});
    }

    preparePlotData(data) {
        const values = data.data;
        
        if (Array.isArray(values) && values.length > 0) {
            if (typeof values[0] === 'number') {
                // 1D data
                return [{
                    x: Array.from({length: values.length}, (_, i) => i),
                    y: values,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: data.name
                }];
            } else if (Array.isArray(values[0])) {
                // 2D data
                return [{
                    z: values,
                    type: 'heatmap',
                    name: data.name
                }];
            }
        }
        
        return [{
            x: [0],
            y: [0],
            type: 'scatter',
            mode: 'markers',
            name: 'No valid data'
        }];
    }

    displayDataTable(data) {
        if (!data.data || data.data.length === 0) {
            this.tableContainer.innerHTML = '<p>No data to display</p>';
            return;
        }

        const values = data.data;
        let tableHTML = '<table class="data-table"><thead><tr><th>Index</th><th>Value</th></tr></thead><tbody>';
        
        if (Array.isArray(values)) {
            values.slice(0, 100).forEach((value, index) => {
                tableHTML += `<tr><td>${index}</td><td>${value}</td></tr>`;
            });
            
            if (values.length > 100) {
                tableHTML += `<tr><td colspan="2">... and ${values.length - 100} more rows</td></tr>`;
            }
        }
        
        tableHTML += '</tbody></table>';
        this.tableContainer.innerHTML = tableHTML;
    }

    showError(message) {
        this.plotContainer.innerHTML = `<div class="error">Error: ${message}</div>`;
        this.tableContainer.innerHTML = '';
    }

    initializePlot() {
        // Initialize empty plot
        this.plotContainer.innerHTML = '<p>Select a variable to view its data</p>';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScientificDataViewer();
});
```

**media/viewer.css:**
```css
/* Scientific Data Viewer Styles */
.container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
}

.header {
    padding: 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-panel-background);
}

.header h1 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
}

.file-info {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: var(--vscode-descriptionForeground);
}

.file-name {
    font-weight: 500;
}

.content {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.sidebar {
    width: 300px;
    padding: 16px;
    border-right: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-sideBar-background);
    overflow-y: auto;
}

.sidebar h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--vscode-foreground);
}

.variables-list, .dimensions-list, .attributes-list {
    margin-bottom: 24px;
}

.variable-item, .dimension-item, .attribute-item {
    padding: 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.variable-item:hover, .variable-item.selected {
    background-color: var(--vscode-list-hoverBackground);
}

.variable-item.selected {
    background-color: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}

.variable-name, .dim-name, .attr-name {
    font-weight: 500;
    display: block;
}

.variable-dims, .variable-type, .dim-size, .attr-value {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    margin-top: 2px;
}

.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
    overflow: hidden;
}

.plot-container {
    flex: 1;
    margin-bottom: 16px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    background-color: var(--vscode-editor-background);
}

.data-table-container {
    height: 200px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    background-color: var(--vscode-editor-background);
    overflow: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.data-table th, .data-table td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.data-table th {
    background-color: var(--vscode-panel-background);
    font-weight: 600;
}

.error {
    color: var(--vscode-errorForeground);
    padding: 16px;
    text-align: center;
}

/* Scrollbar styling */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--vscode-scrollbarSlider-background);
}

::-webkit-scrollbar-thumb {
    background: var(--vscode-scrollbarSlider-hoverBackground);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--vscode-scrollbarSlider-activeBackground);
}
```

**README.md:**
```markdown
# Scientific Data Viewer - VSCode Extension

A powerful VSCode extension for viewing and analyzing scientific data files (NetCDF, Zarr, HDF5) directly in the editor.

## Features

- **Interactive Data Visualization**: View scientific data with interactive plots and tables
- **Multiple Format Support**: NetCDF, Zarr, and other xarray-compatible formats
- **Python Integration**: Uses your existing Python environment with xarray
- **Modern UI**: Clean, responsive interface that follows VSCode design principles
- **Export Capabilities**: Export data to JSON, CSV, and other formats

## Installation

### Development Mode

1. **Prerequisites**:
   - Node.js (version 16 or higher)
   - Python 3.7+ with required packages: `xarray`, `netCDF4`, `numpy`, `pandas`
   - VSCode

2. **Setup**:
   ```bash
   # Clone the repository
   git clone <repository-url>
   cd scientific-data-viewer
   
   # Install dependencies
   npm install
   
   # Compile the extension
   npm run compile
   ```

3. **Run in Development**:
   - Open the project in VSCode
   - Press `F5` to launch a new VSCode window with the extension
   - Open a `.nc` or `.zarr` file to test

### Production Installation

1. Install from VSCode Marketplace (when published)
2. Or install from `.vsix` file:
   ```bash
   code --install-extension scientific-data-viewer-1.0.0.vsix
   ```

## Configuration

Configure the extension in VSCode settings:

- `scientificDataViewer.pythonPath`: Path to Python interpreter (default: "python")
- `scientificDataViewer.maxFileSize`: Maximum file size in MB (default: 100)
- `scientificDataViewer.autoRefresh`: Auto-refresh when file changes (default: true)

## Usage

1. **Open Files**: Right-click on `.nc`, `.netcdf`, or `.zarr` files in the explorer and select "Open with Scientific Data Viewer"
2. **View Data**: Browse variables, dimensions, and attributes in the sidebar
3. **Visualize**: Click on variables to see interactive plots and data tables
4. **Export**: Use the export command to save data in various formats

## Development

### Project Structure

```
scientific-data-viewer/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── dataViewerManager.ts      # Core data management
│   ├── pythonExecutor.ts         # Python integration
│   ├── types.ts                  # TypeScript type definitions
│   └── providers/                # Custom editor providers
├── python/                       # Python scripts for data processing
├── media/                        # Frontend assets (CSS, JS)
├── package.json                  # Extension manifest
└── tsconfig.json                 # TypeScript configuration
```

### Building

```bash
# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Run tests
npm test

# Lint code
npm run lint
```

### Publishing

1. **Install vsce**:
   ```bash
   npm install -g @vscode/vsce
   ```

2. **Package extension**:
   ```bash
   vsce package
   ```

3. **Publish to marketplace**:
   ```bash
   vsce publish
   ```

## Requirements

- **Python Packages**: xarray, netCDF4, numpy, pandas
- **Node.js**: 16+ for development
- **VSCode**: 1.74.0+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation
- Review existing issues

## Changelog

### 1.0.0
- Initial release
- NetCDF and Zarr support
- Interactive visualization
- Export capabilities
- Python integration
```

**.gitignore:**
```gitignore
# Dependencies
node_modules/
npm-debug.log*

# Build outputs
out/
dist/
*.vsix

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.venv/

# Logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/
```

Now you have a complete VSCode extension project structure! To open this in Cursor:

1. **Create the project directory** (if not already created):
   ```bash
   mkdir scientific-data-viewer
   cd scientific-data-viewer
   ```

2. **Create all the files** I've provided above in their respective directories

3. **Open in Cursor**:
   ```bash
   cursor .
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Compile the extension**:
   ```bash
   npm run compile
   ```

6. **Test the extension**:
   - Press `F5` in Cursor to launch a new VSCode window with your extension
   - Open a NetCDF or Zarr file to test the functionality

The extension provides a complete solution for viewing scientific data files with an interactive interface, Python integration, and modern VSCode integration patterns.

```json
{
  "name": "scientific-data-viewer",
  "displayName": "Scientific Data Viewer",
  "description": "View and analyze scientific data files (NetCDF, Zarr, HDF5) directly in VSCode",
  "version": "1.0.0",
  "publisher": "your-company",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Data Science",
    "Visualization",
    "Other"
  ],
  "keywords": [
    "netcdf",
    "zarr",
    "hdf5",
    "scientific",
    "data",
    "visualization",
    "xarray"
  ],
  "activationEvents": [
    "onCommand:scientificDataViewer.openFile",
    "onCustomEditor:scientificDataViewer.netcdfViewer"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "scientificDataViewer.openFile",
        "title": "Open with Scientific Data Viewer",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.refreshView",
        "title": "Refresh View",
        "category": "Scientific Data"
      },
      {
        "command": "scientificDataViewer.exportData",
        "title": "Export Data",
        "category": "Scientific Data"
      }
    ],
    "customEditors": [
      {
        "viewType": "scientificDataViewer.netcdfViewer",
        "displayName": "NetCDF Viewer",
        "selector": [
          {
            "filenamePattern": "*.nc"
          },
          {
            "filenamePattern": "*.netcdf"
          }
        ]
      },
      {
        "viewType": "scientificDataViewer.zarrViewer",
        "displayName": "Zarr Viewer",
        "selector": [
          {
            "filenamePattern": "*.zarr"
          }
        ]
      }
    ],
    "menus": {
      "explorer/context": [
        {
          "command": "scientificDataViewer.openFile",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ],
      "editor/title": [
        {
          "command": "scientificDataViewer.refreshView",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        },
        {
          "command": "scientificDataViewer.exportData",
          "when": "resourceExtname == '.nc' || resourceExtname == '.netcdf' || resourceExtname == '.zarr'",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "Scientific Data Viewer",
      "properties": {
        "scientificDataViewer.pythonPath": {
          "type": "string",
          "default": "python",
          "description": "Path to Python interpreter"
        },
        "scientificDataViewer.maxFileSize": {
          "type": "number",
          "default": 100,
          "description": "Maximum file size in MB to load"
        },
        "scientificDataViewer.autoRefresh": {
          "type": "boolean",
          "default": true,
          "description": "Automatically refresh view when file changes"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile && npm run lint",
    "lint": "eslint src --ext ts",
    "test": "node ./out/test/runTest.js"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "16.x",
    "@typescript-eslint/eslint-plugin": "^5.45.0",
    "@typescript-eslint/parser": "^5.45.0",
    "eslint": "^8.28.0",
    "typescript": "^4.9.4"
  },
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": [
      "ES2020"
    ],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true
  },
  "exclude": [
    "node_modules",
    ".vscode-test"
  ]
}
```

```typescript
import * as vscode from 'vscode';
import { NetCDFViewerProvider } from './providers/netcdfViewerProvider';
import { ZarrViewerProvider } from './providers/zarrViewerProvider';
import { DataViewerManager } from './dataViewerManager';
import { PythonExecutor } from './pythonExecutor';

export function activate(context: vscode.ExtensionContext) {
    console.log('Scientific Data Viewer extension is now active!');

    const pythonExecutor = new PythonExecutor();
    const dataViewerManager = new DataViewerManager(pythonExecutor);

    // Register custom editors
    const netcdfProvider = new NetCDFViewerProvider(dataViewerManager);
    const zarrProvider = new ZarrViewerProvider(dataViewerManager);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'scientificDataViewer.netcdfViewer',
            netcdfProvider,
            {
                supportsMultipleEditorsPerDocument: false,
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'scientificDataViewer.zarrViewer',
            zarrProvider,
            {
                supportsMultipleEditorsPerDocument: false,
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Register commands
    const openFileCommand = vscode.commands.registerCommand(
        'scientificDataViewer.openFile',
        async (uri: vscode.Uri) => {
            if (uri) {
                await vscode.commands.executeCommand('vscode.openWith', uri, 'scientificDataViewer.netcdfViewer');
            }
        }
    );

    const refreshCommand = vscode.commands.registerCommand(
        'scientificDataViewer.refreshView',
        () => {
            dataViewerManager.refreshCurrentView();
        }
    );

    const exportCommand = vscode.commands.registerCommand(
        'scientificDataViewer.exportData',
        () => {
            dataViewerManager.exportCurrentData();
        }
    );

    context.subscriptions.push(openFileCommand, refreshCommand, exportCommand);

    // Check Python environment on activation
    pythonExecutor.checkPythonEnvironment().then(isValid => {
        if (!isValid) {
            vscode.window.showWarningMessage(
                'Scientific Data Viewer: Python environment not properly configured. ' +
                'Please ensure Python with xarray and netCDF4 is installed.'
            );
        }
    });
}

export function deactivate() {
    console.log('Scientific Data Viewer extension is now deactivated!');
}
```

```typescript
export interface DataFileInfo {
    fileName: string;
    fileSize: number;
    format: string;
    variables: VariableInfo[];
    dimensions: DimensionInfo[];
    attributes: AttributeInfo[];
}

export interface VariableInfo {
    name: string;
    dimensions: string[];
    type: string;
    shape: number[];
    attributes: AttributeInfo[];
}

export interface DimensionInfo {
    name: string;
    size: number;
    attributes: AttributeInfo[];
}

export interface AttributeInfo {
    name: string;
    value: any;
    type: string;
}
```

```typescript
import * as vscode from 'vscode';
import { PythonExecutor } from './pythonExecutor';
import { DataFileInfo, VariableInfo } from './types';

export class DataViewerManager {
    private currentView: vscode.WebviewPanel | undefined;
    private pythonExecutor: PythonExecutor;

    constructor(pythonExecutor: PythonExecutor) {
        this.pythonExecutor = pythonExecutor;
    }

    async openFile(uri: vscode.Uri, webview: vscode.Webview): Promise<void> {
        try {
            const fileInfo = await this.pythonExecutor.readDataFile(uri.fsPath);
            this.updateWebview(webview, fileInfo);
        } catch (error) {
            this.showError(webview, `Failed to open file: ${error}`);
        }
    }

    async refreshCurrentView(): Promise<void> {
        if (this.currentView) {
            const uri = this.currentView.webview.uri;
            if (uri) {
                await this.openFile(uri, this.currentView.webview);
            }
        }
    }

    async exportCurrentData(): Promise<void> {
        if (this.currentView) {
            const uri = this.currentView.webview.uri;
            if (uri) {
                const fileInfo = await this.pythonExecutor.readDataFile(uri.fsPath);
                const exportData = this.prepareExportData(fileInfo);
                
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`${uri.fsPath}.export.json`),
                    filters: {
                        'JSON': ['json'],
                        'CSV': ['csv'],
                        'All Files': ['*']
                    }
                });

                if (saveUri) {
                    await this.pythonExecutor.exportData(fileInfo, saveUri.fsPath);
                    vscode.window.showInformationMessage(`Data exported to ${saveUri.fsPath}`);
                }
            }
        }
    }

    setCurrentView(panel: vscode.WebviewPanel): void {
        this.currentView = panel;
    }

    private updateWebview(webview: vscode.Webview, fileInfo: DataFileInfo): void {
        const html = this.generateWebviewContent(webview, fileInfo);
        webview.html = html;
    }

    private showError(webview: vscode.Webview, message: string): void {
        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Scientific Data Viewer - Error</title>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
                    .error { color: var(--vscode-errorForeground); padding: 20px; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>Error</h2>
                    <p>${message}</p>
                </div>
            </body>
            </html>
        `;
        webview.html = html;
    }

    private generateWebviewContent(webview: vscode.Webview, fileInfo: DataFileInfo): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
            vscode.Uri.file(__dirname), '..', 'media', 'viewer.js'
        ));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(
            vscode.Uri.file(__dirname), '..', 'media', 'viewer.css'
        ));

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Scientific Data Viewer</title>
                <link href="${styleUri}" rel="stylesheet">
                <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            </head>
            <body>
                <div class="container">
                    <header class="header">
                        <h1>Scientific Data Viewer</h1>
                        <div class="file-info">
                            <span class="file-name">${fileInfo.fileName}</span>
                            <span class="file-size">${this.formatFileSize(fileInfo.fileSize)}</span>
                        </div>
                    </header>
                    
                    <div class="content">
                        <div class="sidebar">
                            <h3>Variables</h3>
                            <div class="variables-list">
                                ${fileInfo.variables.map(variable => `
                                    <div class="variable-item" data-variable="${variable.name}">
                                        <div class="variable-name">${variable.name}</div>
                                        <div class="variable-dims">${variable.dimensions.join(' × ')}</div>
                                        <div class="variable-type">${variable.type}</div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <h3>Dimensions</h3>
                            <div class="dimensions-list">
                                ${fileInfo.dimensions.map(dim => `
                                    <div class="dimension-item">
                                        <span class="dim-name">${dim.name}</span>
                                        <span class="dim-size">${dim.size}</span>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <h3>Attributes</h3>
                            <div class="attributes-list">
                                ${fileInfo.attributes.map(attr => `
                                    <div class="attribute-item">
                                        <span class="attr-name">${attr.name}</span>
                                        <span class="attr-value">${attr.value}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="main-content">
                            <div class="plot-container">
                                <div id="plot-area"></div>
                            </div>
                            <div class="data-table-container">
                                <div id="data-table"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script>
                    window.fileData = ${JSON.stringify(fileInfo)};
                </script>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

    private prepareExportData(fileInfo: DataFileInfo): any {
        return {
            fileName: fileInfo.fileName,
            fileSize: fileInfo.fileSize,
            format: fileInfo.format,
            variables: fileInfo.variables,
            dimensions: fileInfo.dimensions,
            attributes: fileInfo.attributes,
            timestamp: new Date().toISOString()
        };
    }

    private formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}
```

```typescript
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { DataFileInfo, VariableInfo, DimensionInfo, AttributeInfo } from './types';

export class PythonExecutor {
    private pythonPath: string;

    constructor() {
        this.pythonPath = vscode.workspace.getConfiguration('scientificDataViewer').get('pythonPath', 'python');
    }

    async checkPythonEnvironment(): Promise<boolean> {
        try {
            const result = await this.executePythonScript('check_environment.py');
            return result.success;
        } catch (error) {
            return false;
        }
    }

    async readDataFile(filePath: string): Promise<DataFileInfo> {
        const scriptPath = path.join(__dirname, '..', 'python', 'read_data_file.py');
        const result = await this.executePythonScript(scriptPath, [filePath]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to read data file');
        }

        return result.data;
    }

    async exportData(fileInfo: DataFileInfo, outputPath: string): Promise<void> {
        const scriptPath = path.join(__dirname, '..', 'python', 'export_data.py');
        const result = await this.executePythonScript(scriptPath, [
            JSON.stringify(fileInfo),
            outputPath
        ]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to export data');
        }
    }

    async getVariableData(filePath: string, variableName: string): Promise<any> {
        const scriptPath = path.join(__dirname, '..', 'python', 'get_variable_data.py');
        const result = await this.executePythonScript(scriptPath, [filePath, variableName]);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to get variable data');
        }

        return result.data;
    }

    private executePythonScript(scriptPath: string, args: string[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            const pythonArgs = [scriptPath, ...args];
            const process = child_process.spawn(this.pythonPath, pythonArgs, {
                cwd: path.dirname(scriptPath)
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse Python output: ${stdout}`));
                    }
                } else {
                    reject(new Error(`Python script failed: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }
}
```

```typescript
import * as vscode from 'vscode';
import { DataViewerManager } from '../dataViewerManager';

export class NetCDFViewerProvider implements vscode.CustomTextEditorProvider {
    constructor(private dataViewerManager: DataViewerManager) {}

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.dataViewerManager.setCurrentView(webviewPanel);
        await this.dataViewerManager.openFile(document.uri, webviewPanel.webview);

        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'getVariableData':
                        try {
                            const data = await this.dataViewerManager.getVariableData(
                                document.uri.fsPath,
                                message.variableName
                            );
                            webviewPanel.webview.postMessage({
                                type: 'variableData',
                                data: data
                            });
                        } catch (error) {
                            webviewPanel.webview.postMessage({
                                type: 'error',
                                message: error.message
                            });
                        }
                        break;
                }
            }
        );
    }
}
```

```typescript
import * as vscode from 'vscode';
import { DataViewerManager } from '../dataViewerManager';

export class ZarrViewerProvider implements vscode.CustomTextEditorProvider {
    constructor(private dataViewerManager: DataViewerManager) {}

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.dataViewerManager.setCurrentView(webviewPanel);
        await this.dataViewerManager.openFile(document.uri, webviewPanel.webview);

        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'getVariableData':
                        try {
                            const data = await this.dataViewerManager.getVariableData(
                                document.uri.fsPath,
                                message.variableName
                            );
                            webviewPanel.webview.postMessage({
                                type: 'variableData',
                                data: data
                            });
                        } catch (error) {
                            webviewPanel.webview.postMessage({
                                type: 'error',
                                message: error.message
                            });
                        }
                        break;
                }
            }
        );
    }
}
```

```python
#!/usr/bin/env python3
"""
Python script to read scientific data files and return metadata.
"""

import sys
import json
import os
import xarray as xr
import numpy as np
from pathlib import Path

def read_data_file(file_path):
    """Read a scientific data file and return metadata."""
    try:
        # Determine file format
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
            format_name = 'NetCDF'
        elif file_ext == '.zarr':
            ds = xr.open_zarr(file_path)
            format_name = 'Zarr'
        else:
            # Try to open as generic xarray dataset
            ds = xr.open_dataset(file_path)
            format_name = 'Unknown'
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Extract variables information
        variables = []
        for var_name, var in ds.variables.items():
            var_info = {
                'name': var_name,
                'dimensions': list(var.dims),
                'type': str(var.dtype),
                'shape': list(var.shape),
                'attributes': [{'name': k, 'value': str(v), 'type': type(v).__name__} 
                              for k, v in var.attrs.items()]
            }
            variables.append(var_info)
        
        # Extract dimensions information
        dimensions = []
        for dim_name, dim_size in ds.dims.items():
            dim_info = {
                'name': dim_name,
                'size': dim_size,
                'attributes': []
            }
            dimensions.append(dim_info)
        
        # Extract global attributes
        attributes = [{'name': k, 'value': str(v), 'type': type(v).__name__} 
                    for k, v in ds.attrs.items()]
        
        # Create result
        result = {
            'fileName': os.path.basename(file_path),
            'fileSize': file_size,
            'format': format_name,
            'variables': variables,
            'dimensions': dimensions,
            'attributes': attributes
        }
        
        return {'success': True, 'data': result}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({'success': False, 'error': 'Usage: python read_data_file.py <file_path>'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = read_data_file(file_path)
    print(json.dumps(result))
```

```python
#!/usr/bin/env python3
"""
Check if required Python packages are available.
"""

import sys
import json

def check_environment():
    """Check if required packages are installed."""
    required_packages = ['xarray', 'netCDF4', 'numpy', 'pandas']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        return {
            'success': False,
            'error': f'Missing packages: {", ".join(missing_packages)}'
        }
    else:
        return {'success': True}

if __name__ == '__main__':
    result = check_environment()
    print(json.dumps(result))
```

```python
#!/usr/bin/env python3
"""
Extract variable data for visualization.
"""

import sys
import json
import xarray as xr
import numpy as np

def get_variable_data(file_path, variable_name):
    """Get data for a specific variable."""
    try:
        # Open dataset
        file_ext = file_path.split('.')[-1].lower()
        if file_ext in ['nc', 'netcdf']:
            ds = xr.open_dataset(file_path)
        elif file_ext == 'zarr':
            ds = xr.open_zarr(file_path)
        else:
            ds = xr.open_dataset(file_path)
        
        # Get variable
        if variable_name not in ds.variables:
            return {'success': False, 'error': f'Variable {variable_name} not found'}
        
        var = ds.variables[variable_name]
        
        # Convert to numpy array for JSON serialization
        data = var.values
        
        # Handle different data types
        if data.dtype.kind in ['U', 'S']:  # String types
            data = data.astype(str).tolist()
        elif data.dtype.kind in ['f', 'i']:  # Numeric types
            # Convert NaN to None for JSON serialization
            data = np.where(np.isnan(data), None, data).tolist()
        else:
            data = data.tolist()
        
        result = {
            'name': variable_name,
            'data': data,
            'shape': list(var.shape),
            'dims': list(var.dims),
            'attributes': dict(var.attrs)
        }
        
        return {'success': True, 'data': result}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({'success': False, 'error': 'Usage: python get_variable_data.py <file_path> <variable_name>'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    variable_name = sys.argv[2]
    result = get_variable_data(file_path, variable_name)
    print(json.dumps(result))
```

```python
#!/usr/bin/env python3
"""
Export scientific data to various formats.
"""

import sys
import json
import xarray as xr
import pandas as pd
from pathlib import Path

def export_data(file_info_json, output_path):
    """Export data to specified format."""
    try:
        file_info = json.loads(file_info_json)
        file_path = file_info.get('originalPath', '')
        
        if not file_path:
            return {'success': False, 'error': 'No file path provided'}
        
        # Open dataset
        file_ext = Path(file_path).suffix.lower()
        if file_ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
        elif file_ext == '.zarr':
            ds = xr.open_zarr(file_path)
        else:
            ds = xr.open_dataset(file_path)
        
        # Determine output format
        output_ext = Path(output_path).suffix.lower()
        
        if output_ext == '.json':
            # Export as JSON
            export_data = {
                'metadata': file_info,
                'variables': {}
            }
            
            for var_name in ds.variables:
                var = ds.variables[var_name]
                export_data['variables'][var_name] = {
                    'data': var.values.tolist() if hasattr(var.values, 'tolist') else str(var.values),
                    'dims': list(var.dims),
                    'attributes': dict(var.attrs)
                }
            
            with open(output_path, 'w') as f:
                json.dump(export_data, f, indent=2)
                
        elif output_ext == '.csv':
            # Export first variable as CSV
            first_var = list(ds.variables.keys())[0]
            var = ds.variables[first_var]
            
            if var.ndim == 1:
                df = pd.DataFrame({first_var: var.values})
            elif var.ndim == 2:
                df = pd.DataFrame(var.values)
            else:
                # Flatten higher dimensional data
                df = pd.DataFrame(var.values.reshape(-1, 1), columns=[first_var])
            
            df.to_csv(output_path, index=False)
            
        else:
            return {'success': False, 'error': f'Unsupported output format: {output_ext}'}
        
        return {'success': True}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({'success': False, 'error': 'Usage: python export_data.py <file_info_json> <output_path>'}))
        sys.exit(1)
    
    file_info_json = sys.argv[1]
    output_path = sys.argv[2]
    result = export_data(file_info_json, output_path)
    print(json.dumps(result))
```

```javascript
// Scientific Data Viewer Frontend
class ScientificDataViewer {
    constructor() {
        this.currentVariable = null;
        this.plotContainer = document.getElementById('plot-area');
        this.tableContainer = document.getElementById('data-table');
        
        this.initializeEventListeners();
        this.initializePlot();
    }

    initializeEventListeners() {
        // Variable selection
        document.querySelectorAll('.variable-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const variableName = e.currentTarget.dataset.variable;
                this.selectVariable(variableName);
            });
        });

        // Listen for messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'variableData':
                    this.displayVariableData(message.data);
                    break;
                case 'error':
                    this.showError(message.message);
                    break;
            }
        });
    }

    selectVariable(variableName) {
        // Update UI
        document.querySelectorAll('.variable-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-variable="${variableName}"]`).classList.add('selected');
        
        this.currentVariable = variableName;
        
        // Request variable data
        this.requestVariableData(variableName);
    }

    requestVariableData(variableName) {
        // Send message to extension
        if (window.vscode) {
            window.vscode.postMessage({
                type: 'getVariableData',
                variableName: variableName
            });
        }
    }

    displayVariableData(data) {
        this.plotData(data);
        this.displayDataTable(data);
    }

    plotData(data) {
        if (!data.data || data.data.length === 0) {
            this.plotContainer.innerHTML = '<p>No data to plot</p>';
            return;
        }

        const plotData = this.preparePlotData(data);
        
        const layout = {
            title: data.name,
            xaxis: { title: 'Index' },
            yaxis: { title: 'Value' },
            margin: { t: 50, r: 50, b: 50, l: 50 }
        };

        Plotly.newPlot(this.plotContainer, plotData, layout, {responsive: true});
    }

    preparePlotData(data) {
        const values = data.data;
        
        if (Array.isArray(values) && values.length > 0) {
            if (typeof values[0] === 'number') {
                // 1D data
                return [{
                    x: Array.from({length: values.length}, (_, i) => i),
                    y: values,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: data.name
                }];
            } else if (Array.isArray(values[0])) {
                // 2D data
                return [{
                    z: values,
                    type: 'heatmap',
                    name: data.name
                }];
            }
        }
        
        return [{
            x: [0],
            y: [0],
            type: 'scatter',
            mode: 'markers',
            name: 'No valid data'
        }];
    }

    displayDataTable(data) {
        if (!data.data || data.data.length === 0) {
            this.tableContainer.innerHTML = '<p>No data to display</p>';
            return;
        }

        const values = data.data;
        let tableHTML = '<table class="data-table"><thead><tr><th>Index</th><th>Value</th></tr></thead><tbody>';
        
        if (Array.isArray(values)) {
            values.slice(0, 100).forEach((value, index) => {
                tableHTML += `<tr><td>${index}</td><td>${value}</td></tr>`;
            });
            
            if (values.length > 100) {
                tableHTML += `<tr><td colspan="2">... and ${values.length - 100} more rows</td></tr>`;
            }
        }
        
        tableHTML += '</tbody></table>';
        this.tableContainer.innerHTML = tableHTML;
    }

    showError(message) {
        this.plotContainer.innerHTML = `<div class="error">Error: ${message}</div>`;
        this.tableContainer.innerHTML = '';
    }

    initializePlot() {
        // Initialize empty plot
        this.plotContainer.innerHTML = '<p>Select a variable to view its data</p>';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScientificDataViewer();
});
```

```css
/* Scientific Data Viewer Styles */
.container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
}

.header {
    padding: 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-panel-background);
}

.header h1 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
}

.file-info {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: var(--vscode-descriptionForeground);
}

.file-name {
    font-weight: 500;
}

.content {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.sidebar {
    width: 300px;
    padding: 16px;
    border-right: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-sideBar-background);
    overflow-y: auto;
}

.sidebar h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--vscode-foreground);
}

.variables-list, .dimensions-list, .attributes-list {
    margin-bottom: 24px;
}

.variable-item, .dimension-item, .attribute-item {
    padding: 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.variable-item:hover, .variable-item.selected {
    background-color: var(--vscode-list-hoverBackground);
}

.variable-item.selected {
    background-color: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}

.variable-name, .dim-name, .attr-name {
    font-weight: 500;
    display: block;
}

.variable-dims, .variable-type, .dim-size, .attr-value {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    margin-top: 2px;
}

.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
    overflow: hidden;
}

.plot-container {
    flex: 1;
    margin-bottom: 16px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    background-color: var(--vscode-editor-background);
}

.data-table-container {
    height: 200px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    background-color: var(--vscode-editor-background);
    overflow: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.data-table th, .data-table td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.data-table th {
    background-color: var(--vscode-panel-background);
    font-weight: 600;
}

.error {
    color: var(--vscode-errorForeground);
    padding: 16px;
    text-align: center;
}

/* Scrollbar styling */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--vscode-scrollbarSlider-background);
}

::-webkit-scrollbar-thumb {
    background: var(--vscode-scrollbarSlider-hoverBackground);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--vscode-scrollbarSlider-activeBackground);
}
```

```markdown
# Scientific Data Viewer - VSCode Extension

A powerful VSCode extension for viewing and analyzing scientific data files (NetCDF, Zarr, HDF5) directly in the editor.

## Features

- **Interactive Data Visualization**: View scientific data with interactive plots and tables
- **Multiple Format Support**: NetCDF, Zarr, and other xarray-compatible formats
- **Python Integration**: Uses your existing Python environment with xarray
- **Modern UI**: Clean, responsive interface that follows VSCode design principles
- **Export Capabilities**: Export data to JSON, CSV, and other formats

## Installation

### Development Mode

1. **Prerequisites**:
   - Node.js (version 16 or higher)
   - Python 3.7+ with required packages: `xarray`, `netCDF4`, `numpy`, `pandas`
   - VSCode

2. **Setup**:
   ```bash
   # Clone the repository
   git clone <repository-url>
   cd scientific-data-viewer
   
   # Install dependencies
   npm install
   
   # Compile the extension
   npm run compile
   ```

3. **Run in Development**:
   - Open the project in VSCode
   - Press `F5` to launch a new VSCode window with the extension
   - Open a `.nc` or `.zarr` file to test

### Production Installation

1. Install from VSCode Marketplace (when published)
2. Or install from `.vsix` file:
   ```bash
   code --install-extension scientific-data-viewer-1.0.0.vsix
   ```

## Configuration

Configure the extension in VSCode settings:

- `scientificDataViewer.pythonPath`: Path to Python interpreter (default: "python")
- `scientificDataViewer.maxFileSize`: Maximum file size in MB (default: 100)
- `scientificDataViewer.autoRefresh`: Auto-refresh when file changes (default: true)

## Usage

1. **Open Files**: Right-click on `.nc`, `.netcdf`, or `.zarr` files in the explorer and select "Open with Scientific Data Viewer"
2. **View Data**: Browse variables, dimensions, and attributes in the sidebar
3. **Visualize**: Click on variables to see interactive plots and data tables
4. **Export**: Use the export command to save data in various formats

## Development

### Project Structure

```

```plaintext

### Building

```bash
# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Run tests
npm test

# Lint code
npm run lint
```

### Publishing

1. **Install vsce**:
   ```bash
   npm install -g @vscode/vsce
   ```

2. **Package extension**:
   ```bash
   vsce package
   ```

3. **Publish to marketplace**:
   ```bash
   vsce publish
   ```

## Requirements

- **Python Packages**: xarray, netCDF4, numpy, pandas
- **Node.js**: 16+ for development
- **VSCode**: 1.74.0+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation
- Review existing issues

## Changelog

### 1.0.0
- Initial release
- NetCDF and Zarr support
- Interactive visualization
- Export capabilities
- Python integration
```

```plaintext
# Dependencies
node_modules/
npm-debug.log*

# Build outputs
out/
dist/
*.vsix

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.venv/

# Logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/
```

```shellscript
   mkdir scientific-data-viewer
   cd scientific-data-viewer
```

```shellscript
   cursor .
```

```shellscript
   npm install
```

```shellscript
   npm run compile
```

