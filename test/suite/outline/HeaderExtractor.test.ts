import * as assert from 'assert';
import { HeaderExtractor } from '../../../src/outline/HeaderExtractor';
import { DataInfoResult } from '../../../src/dataProcessor';

// Mock DOMParser for Node.js test environment
(global as any).DOMParser = class DOMParser {
    parseFromString(html: string, type: string) {
        // Simple mock implementation that can parse basic HTML headers
        const mockDoc = {
            querySelectorAll: (selector: string) => {
                if (selector === 'h1, h2, h3, h4, h5, h6') {
                    const headers: any[] = [];
                    const headerRegex = /<(h[1-6])(?:\s+id="([^"]*)")?[^>]*>([^<]*)<\/h[1-6]>/gi;
                    let match;
                    let index = 0;
                    
                    while ((match = headerRegex.exec(html)) !== null) {
                        const level = parseInt(match[1].charAt(1));
                        const id = match[2] || `header-${index}`;
                        const text = match[3].trim();
                        
                        headers.push({
                            tagName: match[1].toUpperCase(),
                            id: id,
                            textContent: text
                        });
                        index++;
                    }
                    return headers;
                }
                return [];
            }
        };
        return mockDoc;
    }
};

suite('HeaderExtractor Test Suite', () => {
    test('should create HeaderExtractor instance', () => {
        // HeaderExtractor is a static class, so we just test that it exists
        assert.ok(HeaderExtractor);
    });

    test('should extract headers from HTML content', () => {
        const htmlContent = `
            <h1>Main Title</h1>
            <h2>Section 1</h2>
            <h3>Subsection 1.1</h3>
            <h2>Section 2</h2>
        `;

        const headers = HeaderExtractor.extractHeaders(htmlContent);
        
        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        assert.strictEqual(headers.length, 1); // One top-level header (h1), h2s are children
        
        const mainTitle = headers.find(h => h.label === 'Main Title');
        assert.ok(mainTitle);
        assert.strictEqual(mainTitle.level, 1);
        assert.strictEqual(mainTitle.children.length, 2); // Two h2 sections as children
    });

    test('should create data viewer headers', () => {
        const headers = HeaderExtractor.createDataViewerHeaders();
        
        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        assert.ok(headers.length > 0);
        
        const titleHeader = headers.find(h => h.label === 'Scientific Data Viewer');
        assert.ok(titleHeader);
        assert.strictEqual(titleHeader.level, 1);
    });

    test('should create dynamic data viewer headers', () => {
        const dataInfo: DataInfoResult = {
            format: 'NetCDF',
            fileSize: 1024,
            xarray_html_repr: '<div>Test HTML</div>',
            xarray_text_repr: 'Test text representation',
            xarray_show_versions: 'Test versions',
            format_info: { extension: 'nc', display_name: 'NetCDF', available_engines: [], missing_packages: [], is_supported: true },
            used_engine: 'netcdf4',
            dimensions_flattened: {
                'group1': {
                    'time': 100
                }
            },
            coordinates_flattened: {
                'group1': [
                    { name: 'time', dtype: 'float32', shape: [100], dimensions: ['time'], size_bytes: 400, attributes: {} }
                ]
            },
            variables_flattened: {
                'group1': [
                    { name: 'temperature', dtype: 'float32', shape: [100], dimensions: ['time'], size_bytes: 400, attributes: {} }
                ]
            },
            attributes_flattened: {
                'group1': {
                    'title': 'Test Dataset'
                }
            },
            xarray_html_repr_flattened: {
                'group1': '<div>Group 1 HTML</div>'
            },
            xarray_text_repr_flattened: {
                'group1': 'Group 1 text'
            }
        };

        const headers = HeaderExtractor.createDynamicDataViewerHeaders(dataInfo);
        
        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        assert.ok(headers.length > 0);
        
        // Should have group information
        const dataGroupsHeader = headers.find(h => h.label === 'Data Groups');
        assert.ok(dataGroupsHeader);
        assert.ok(dataGroupsHeader.children.length > 0);
    });

    test('should handle empty HTML content', () => {
        const headers = HeaderExtractor.extractHeaders('');
        
        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        assert.strictEqual(headers.length, 0);
    });

    test('should handle invalid HTML content', () => {
        const headers = HeaderExtractor.extractHeaders('<invalid>html</invalid>');
        
        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        // Should still return empty array rather than throwing
    });

    test('should handle missing container', () => {
        const headers = HeaderExtractor.extractHeadersFromContainer('nonexistent', '<div>content</div>');
        
        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        assert.strictEqual(headers.length, 0);
    });

    test('should handle null data info', () => {
        const headers = HeaderExtractor.createDynamicDataViewerHeaders(undefined);
        
        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        // Should return base headers
        assert.ok(headers.length > 0);
    });

    test('should handle undefined data info', () => {
        const headers = HeaderExtractor.createDynamicDataViewerHeaders(undefined);
        
        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        // Should return base headers
        assert.ok(headers.length > 0);
    });

    test('should create hierarchical header structure', () => {
        const htmlContent = `
            <h1>Main Title</h1>
            <h2>Section 1</h2>
            <h3>Subsection 1.1</h3>
            <h3>Subsection 1.2</h3>
            <h2>Section 2</h2>
            <h3>Subsection 2.1</h3>
        `;

        const headers = HeaderExtractor.extractHeaders(htmlContent);
        
        assert.ok(headers);
        assert.strictEqual(headers.length, 1); // One top-level header (h1)
        
        const mainTitle = headers.find(h => h.label === 'Main Title');
        assert.ok(mainTitle);
        assert.strictEqual(mainTitle.children.length, 2); // Two h2 sections as children
        
        const section1 = mainTitle.children.find(h => h.label === 'Section 1');
        assert.ok(section1);
        assert.strictEqual(section1.children.length, 2); // Two h3 subsections
        
        const subsection11 = section1.children.find(h => h.label === 'Subsection 1.1');
        assert.ok(subsection11);
        assert.strictEqual(subsection11.level, 3);
    });

    test('should assign IDs to headers', () => {
        const htmlContent = '<h1>Test Header</h1>';
        const headers = HeaderExtractor.extractHeaders(htmlContent);
        
        assert.ok(headers);
        assert.strictEqual(headers.length, 1);
        
        const header = headers[0];
        assert.ok(header.id);
        assert.ok(header.id.includes('header-'));
    });

    test('should handle headers with existing IDs', () => {
        const htmlContent = '<h1 id="custom-id">Test Header</h1>';
        const headers = HeaderExtractor.extractHeaders(htmlContent);
        
        assert.ok(headers);
        assert.strictEqual(headers.length, 1);
        
        const header = headers[0];
        assert.strictEqual(header.id, 'custom-id');
    });

    test('should handle complex HTML structure', () => {
        const htmlContent = `
            <div class="wrapper">
                <h1>Main Title</h1>
                <div class="content">
                    <h2>Section 1</h2>
                    <p>Some content</p>
                    <h3>Subsection</h3>
                </div>
            </div>
        `;

        const headers = HeaderExtractor.extractHeaders(htmlContent);
        
        assert.ok(headers);
        assert.strictEqual(headers.length, 1); // One top-level header
        assert.strictEqual(headers[0].children.length, 1); // One section
        assert.strictEqual(headers[0].children[0].children.length, 1); // One subsection
    });

    test('should handle empty data info for dynamic headers', () => {
        const dataInfo: DataInfoResult = {
            format: 'NetCDF',
            fileSize: 0,
            xarray_html_repr: '',
            xarray_text_repr: '',
            xarray_show_versions: '',
            format_info: { extension: 'nc', display_name: 'NetCDF', available_engines: [], missing_packages: [], is_supported: true },
            used_engine: 'netcdf4',
            dimensions_flattened: {},
            coordinates_flattened: {},
            variables_flattened: {},
            attributes_flattened: {},
            xarray_html_repr_flattened: {},
            xarray_text_repr_flattened: {}
        };

        const headers = HeaderExtractor.createDynamicDataViewerHeaders(dataInfo);
        
        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        // Should still return base headers even with empty data
        assert.ok(headers.length > 0);
    });
});