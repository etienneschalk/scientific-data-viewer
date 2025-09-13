import * as vscode from 'vscode';
import { PythonManager } from './pythonManager';
import { Logger } from './logger';

export interface DataInfo {
    format: string;
    dimensions?: { [key: string]: number };
    variables?: Array<{
        name: string;
        dtype: string;
        shape: number[];
        attributes?: { [key: string]: any };
    }>;
    attributes?: { [key: string]: any };
    fileSize?: number;
    error?: string;
}

export interface DataSlice {
    variable: string;
    data: any;
    shape: number[];
    dtype: string;
}

export class DataProcessor {
    constructor(private pythonManager: PythonManager) {}

    get pythonManagerInstance(): PythonManager {
        return this.pythonManager;
    }

    async getDataInfo(uri: vscode.Uri): Promise<DataInfo | null> {
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const filePath = uri.fsPath;
        const script = `
import json
import os
import sys
import xarray as xr
import numpy as np

def get_file_info(file_path):
    try:
        # Determine file format
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.nc', '.netcdf']:
            format_name = 'NetCDF'
        elif ext == '.zarr':
            format_name = 'Zarr'
        elif ext in ['.h5', '.hdf5']:
            format_name = 'HDF5'
        else:
            format_name = 'Unknown'
        
        # Open dataset
        if ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
        elif ext == '.zarr':
            ds = xr.open_zarr(file_path)
        elif ext in ['.h5', '.hdf5']:
            ds = xr.open_dataset(file_path, engine='h5netcdf')
        else:
            return None
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Extract information
        info = {
            'format': format_name,
            'fileSize': file_size,
            'dimensions': dict(ds.dims),
            'variables': [],
            'attributes': dict(ds.attrs) if hasattr(ds, 'attrs') else {}
        }
        
        # Process variables
        for var_name, var in ds.data_vars.items():
            var_info = {
                'name': var_name,
                'dtype': str(var.dtype),
                'shape': list(var.shape),
                'attributes': dict(var.attrs) if hasattr(var, 'attrs') else {}
            }
            info['variables'].append(var_info)
        
        # Add coordinate variables
        for coord_name, coord in ds.coords.items():
            coord_info = {
                'name': coord_name,
                'dtype': str(coord.dtype),
                'shape': list(coord.shape),
                'attributes': dict(coord.attrs) if hasattr(coord, 'attrs') else {}
            }
            info['variables'].append(coord_info)
        
        ds.close()
        return info
        
    except Exception as e:
        return {'error': str(e)}

result = get_file_info('${filePath.replace(/\\/g, '\\\\')}')
print(json.dumps(result))
`;

        try {
            const result = await this.pythonManager.executePythonScript(script);
            if (result.error) {
                throw new Error(result.error);
            }
            return result;
        } catch (error) {
            Logger.error(`Error processing data file: ${error}`);
            return null;
        }
    }

    async getDataSlice(uri: vscode.Uri, variable: string, sliceSpec?: any): Promise<DataSlice | null> {
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const filePath = uri.fsPath;
        const script = `
import json
import os
import xarray as xr
import numpy as np

def get_data_slice(file_path, variable_name, slice_spec=None):
    try:
        # Determine file format and open
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
        elif ext == '.zarr':
            ds = xr.open_zarr(file_path)
        elif ext in ['.h5', '.hdf5']:
            ds = xr.open_dataset(file_path, engine='h5netcdf')
        else:
            return None
        
        # Get variable
        if variable_name in ds.data_vars:
            var = ds[variable_name]
        elif variable_name in ds.coords:
            var = ds[variable_name]
        else:
            return None
        
        # Apply slicing if specified
        if slice_spec:
            # Convert slice specification to actual slicing
            # This is a simplified version - in practice, you'd want more sophisticated slicing
            if 'start' in slice_spec and 'stop' in slice_spec:
                var = var.isel({slice_spec.get('dim', 0): slice(slice_spec['start'], slice_spec['stop'])})
        
        # Convert to numpy array for JSON serialization
        data = var.values
        
        # Handle different data types
        if data.dtype.kind in ['U', 'S']:  # Unicode or byte strings
            data = data.astype(str).tolist()
        elif data.dtype.kind == 'O':  # Object arrays
            data = data.astype(str).tolist()
        else:
            data = data.tolist()
        
        result = {
            'variable': variable_name,
            'data': data,
            'shape': list(var.shape),
            'dtype': str(var.dtype)
        }
        
        ds.close()
        return result
        
    except Exception as e:
        return {'error': str(e)}

result = get_data_slice('${filePath.replace(/\\/g, '\\\\')}', '${variable}', ${sliceSpec ? JSON.stringify(sliceSpec) : 'None'})
print(json.dumps(result))
`;

        try {
            const result = await this.pythonManager.executePythonScript(script);
            if (result.error) {
                throw new Error(result.error);
            }
            return result;
        } catch (error) {
            Logger.error(`Error getting data slice: ${error}`);
            return null;
        }
    }

    async getVariableList(uri: vscode.Uri): Promise<string[]> {
        const dataInfo = await this.getDataInfo(uri);
        if (!dataInfo || !dataInfo.variables) {
            return [];
        }
        return dataInfo.variables.map(v => v.name);
    }

    async getDimensionList(uri: vscode.Uri): Promise<string[]> {
        const dataInfo = await this.getDataInfo(uri);
        if (!dataInfo || !dataInfo.dimensions) {
            return [];
        }
        return Object.keys(dataInfo.dimensions);
    }

    async createPlot(uri: vscode.Uri, variable: string, plotType: string = 'line'): Promise<string | null> {
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const filePath = uri.fsPath;
        const script = `
import json
import os
import xarray as xr
import matplotlib.pyplot as plt
import numpy as np
import base64
from io import BytesIO

def create_plot(file_path, variable_name, plot_type='line'):
    try:
        # Open dataset
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.nc', '.netcdf']:
            ds = xr.open_dataset(file_path)
        elif ext == '.zarr':
            ds = xr.open_zarr(file_path)
        elif ext in ['.h5', '.hdf5']:
            ds = xr.open_dataset(file_path, engine='h5netcdf')
        else:
            return None
        
        # Get variable
        if variable_name in ds.data_vars:
            var = ds[variable_name]
        elif variable_name in ds.coords:
            var = ds[variable_name]
        else:
            return None
        
        # Create plot
        plt.figure(figsize=(10, 6))
        
        if plot_type == 'line' and var.ndim == 1:
            var.plot()
        elif plot_type == 'heatmap' and var.ndim == 2:
            var.plot()
        elif plot_type == 'histogram':
            var.plot.hist()
        else:
            # Default plot
            var.plot()
        
        plt.title(f'{variable_name}')
        plt.tight_layout()
        
        # Convert to base64 string
        buffer = BytesIO()
        plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()
        
        ds.close()
        return image_base64
        
    except Exception as e:
        return None

result = create_plot('${filePath.replace(/\\/g, '\\\\')}', '${variable}', '${plotType}')
if result:
    print(result)
else:
    print(json.dumps({'error': 'Failed to create plot'}))
`;

        try {
            const result = await this.pythonManager.executePythonScript(script);
            if (typeof result === 'string' && result.startsWith('iVBOR')) {
                return result; // Base64 image data
            } else if (result.error) {
                throw new Error(result.error);
            }
            return null;
        } catch (error) {
            Logger.error(`Error creating plot: ${error}`);
            return null;
        }
    }
}
