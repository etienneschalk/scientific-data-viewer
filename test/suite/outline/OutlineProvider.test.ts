import * as assert from 'assert';
import * as vscode from 'vscode';
import { OutlineProvider, HeaderItem } from '../../../src/outline/OutlineProvider';

suite('OutlineProvider Test Suite', () => {
    let outlineProvider: OutlineProvider;

    setup(() => {
        outlineProvider = new OutlineProvider();
    });

    teardown(() => {
        // Clean up any resources
        if (outlineProvider) {
            outlineProvider.clear(undefined);
        }
    });

    test('should create OutlineProvider instance', () => {
        assert.ok(outlineProvider);
    });

    test('should provide children for root', () => {
        const children = outlineProvider.getChildren();
        
        assert.ok(children);
        assert.ok(Array.isArray(children));
        // Initially should be empty until headers are set
        assert.strictEqual(children.length, 0);
    });

    test('should provide children for element', () => {
        const mockElement: HeaderItem = {
            label: 'Test Header',
            level: 1,
            id: 'test-header',
            children: [
                {
                    label: 'Child Header',
                    level: 2,
                    id: 'child-header',
                    children: []
                }
            ]
        };

        const children = outlineProvider.getChildren(mockElement);
        
        assert.ok(children);
        assert.ok(Array.isArray(children));
        assert.strictEqual(children.length, 1);
        assert.strictEqual(children[0].label, 'Child Header');
    });

    test('should update headers', () => {
        const mockHeaders: HeaderItem[] = [
            {
                label: 'Main Header',
                level: 1,
                id: 'main-header',
                children: []
            }
        ];
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        outlineProvider.updateHeaders(mockHeaders, mockUri);
        
        const children = outlineProvider.getChildren();
        assert.strictEqual(children.length, 1);
        assert.strictEqual(children[0].label, 'Main Header');
    });

    test('should get tree item for element', () => {
        const mockElement: HeaderItem = {
            label: 'Test Header',
            level: 1,
            id: 'test-header',
            children: []
        };

        const treeItem = outlineProvider.getTreeItem(mockElement);
        
        assert.ok(treeItem);
        assert.strictEqual(treeItem.label, 'Test Header');
        assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
    });

    test('should get tree item for element with children', () => {
        const mockElement: HeaderItem = {
            label: 'Test Header',
            level: 1,
            id: 'test-header',
            children: [
                {
                    label: 'Child Header',
                    level: 2,
                    id: 'child-header',
                    children: []
                }
            ]
        };

        const treeItem = outlineProvider.getTreeItem(mockElement);
        
        assert.ok(treeItem);
        assert.strictEqual(treeItem.label, 'Test Header');
        assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    });

    test('should get parent of element', () => {
        const childElement: HeaderItem = {
            label: 'Child Header',
            level: 2,
            id: 'child-header',
            children: []
        };
        const parentElement: HeaderItem = {
            label: 'Parent Header',
            level: 1,
            id: 'parent-header',
            children: [childElement]
        };

        // Set up the provider with the parent-child relationship
        const mockHeaders = [parentElement];
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        outlineProvider.updateHeaders(mockHeaders, mockUri);

        const parent = outlineProvider.getParent(childElement);
        
        assert.ok(parent);
        assert.strictEqual(parent?.label, 'Parent Header');
    });

    test('should get current file', () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const mockHeaders: HeaderItem[] = [];
        outlineProvider.updateHeaders(mockHeaders, mockUri);

        const currentFile = outlineProvider.getCurrentFile();
        
        assert.ok(currentFile);
        assert.strictEqual(currentFile?.fsPath, '/path/to/test.nc');
    });

    test('should switch to different file', () => {
        const mockUri1 = vscode.Uri.file('/path/to/test1.nc');
        const mockUri2 = vscode.Uri.file('/path/to/test2.nc');
        const mockHeaders1: HeaderItem[] = [
            { label: 'Header 1', level: 1, id: 'header1', children: [] }
        ];
        const mockHeaders2: HeaderItem[] = [
            { label: 'Header 2', level: 1, id: 'header2', children: [] }
        ];

        outlineProvider.updateHeaders(mockHeaders1, mockUri1);
        outlineProvider.updateHeaders(mockHeaders2, mockUri2);

        outlineProvider.switchToFile(mockUri2);
        
        const children = outlineProvider.getChildren();
        assert.strictEqual(children.length, 1);
        assert.strictEqual(children[0].label, 'Header 2');
    });

    test('should check if file is supported', () => {
        const supportedUri = vscode.Uri.file('/path/to/test.nc');
        const unsupportedUri = vscode.Uri.file('/path/to/test.txt');

        assert.ok(outlineProvider.isFileSupported(supportedUri));
        assert.strictEqual(outlineProvider.isFileSupported(unsupportedUri), false);
    });

    test('should get headers for specific file', () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const mockHeaders: HeaderItem[] = [
            { label: 'Test Header', level: 1, id: 'test-header', children: [] }
        ];

        outlineProvider.updateHeaders(mockHeaders, mockUri);

        const headers = outlineProvider.getHeadersForFile(mockUri);
        
        assert.ok(headers);
        assert.strictEqual(headers?.length, 1);
        assert.strictEqual(headers?.[0].label, 'Test Header');
    });

    test('should handle refresh', () => {
        // Refresh should not throw an error
        assert.doesNotThrow(() => {
            outlineProvider.refresh();
        });
    });

    test('should handle expand all', () => {
        // Expand all should not throw an error even without tree view
        assert.doesNotThrow(() => {
            outlineProvider.expandAll();
        });
    });

    test('should handle null file URI in clear', () => {
        // Should not throw an error
        assert.doesNotThrow(() => {
            outlineProvider.clear(undefined);
        });
    });

    test('should handle invalid file URI in clear', () => {
        // Should not throw an error
        assert.doesNotThrow(() => {
            outlineProvider.clear(vscode.Uri.file(''));
        });
    });

    test('should handle switch to non-existent file', () => {
        const mockUri = vscode.Uri.file('/path/to/nonexistent.nc');
        
        // Should not throw an error
        assert.doesNotThrow(() => {
            outlineProvider.switchToFile(mockUri);
        });
        
        const children = outlineProvider.getChildren();
        assert.strictEqual(children.length, 0);
    });

    test('should handle get headers for invalid file', () => {
        const invalidUri = vscode.Uri.file('');
        
        const headers = outlineProvider.getHeadersForFile(invalidUri);
        assert.strictEqual(headers, undefined);
    });

    test('should handle get parent for root element', () => {
        const mockElement: HeaderItem = {
            label: 'Root Header',
            level: 1,
            id: 'root-header',
            children: []
        };

        const parent = outlineProvider.getParent(mockElement);
        assert.strictEqual(parent, undefined);
    });

    test('should handle tree item with command', () => {
        const mockElement: HeaderItem = {
            label: 'Test Header',
            level: 1,
            id: 'test-header',
            children: []
        };

        const treeItem = outlineProvider.getTreeItem(mockElement);
        
        assert.ok(treeItem);
        assert.ok(treeItem.command);
        assert.strictEqual(treeItem.command?.command, 'scientificDataViewer.scrollToHeader');
    });

    test('should handle different header levels', () => {
        const mockElement1: HeaderItem = {
            label: 'Level 1',
            level: 1,
            id: 'level1',
            children: []
        };
        const mockElement2: HeaderItem = {
            label: 'Level 2',
            level: 2,
            id: 'level2',
            children: []
        };
        const mockElement3: HeaderItem = {
            label: 'Level 3',
            level: 3,
            id: 'level3',
            children: []
        };

        const treeItem1 = outlineProvider.getTreeItem(mockElement1);
        const treeItem2 = outlineProvider.getTreeItem(mockElement2);
        const treeItem3 = outlineProvider.getTreeItem(mockElement3);

        assert.ok(treeItem1);
        assert.ok(treeItem2);
        assert.ok(treeItem3);
        // All should have different context values
        assert.notStrictEqual(treeItem1.contextValue, treeItem2.contextValue);
        assert.notStrictEqual(treeItem2.contextValue, treeItem3.contextValue);
    });
});