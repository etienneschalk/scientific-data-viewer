"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const dataProcessor_1 = require("../../src/dataProcessor");
suite('DataProcessor Test Suite', () => {
    let dataProcessor;
    let pythonManager;
    suiteSetup(() => {
        // Mock PythonManager for testing
        pythonManager = {
            isReady: () => true,
            executePythonScript: async (script) => {
                // Mock response for testing
                return {
                    format: 'NetCDF',
                    fileSize: 1024,
                    dimensions: { time: 100, lat: 180, lon: 360 },
                    variables: [
                        { name: 'temperature', dtype: 'float32', shape: [100, 180, 360] },
                        { name: 'time', dtype: 'datetime64', shape: [100] }
                    ]
                };
            }
        };
        dataProcessor = new dataProcessor_1.DataProcessor(pythonManager);
    });
    test('should create DataProcessor instance', () => {
        assert.ok(dataProcessor);
    });
    test('should get data info for valid file', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const dataInfo = await dataProcessor.getDataInfo(mockUri);
        assert.ok(dataInfo);
        assert.strictEqual(dataInfo?.format, 'NetCDF');
        assert.ok(dataInfo?.dimensions);
        assert.ok(dataInfo?.variables);
    });
    test('should get variable list', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const variables = await dataProcessor.getVariableList(mockUri);
        assert.ok(Array.isArray(variables));
        assert.ok(variables.length > 0);
    });
    test('should get dimension list', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const dimensions = await dataProcessor.getDimensionList(mockUri);
        assert.ok(Array.isArray(dimensions));
        assert.ok(dimensions.length > 0);
    });
    test('should handle Python environment not ready', async () => {
        const mockPythonManager = {
            isReady: () => false
        };
        const processor = new dataProcessor_1.DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        try {
            await processor.getDataInfo(mockUri);
            assert.fail('Should have thrown an error');
        }
        catch (error) {
            assert.ok(error instanceof Error);
            assert.strictEqual(error.message, 'Python environment not ready');
        }
    });
});
//# sourceMappingURL=dataProcessor.test.js.map