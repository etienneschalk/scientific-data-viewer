import { HeaderItem } from './OutlineProvider';
import { Logger } from '../logger';
import { DataInfoResult } from '../dataProcessor';

export class HeaderExtractor {

    // JoinId is used to join parts of an id together with a separator
    // Must be similar to the one used in the HeaderExtractor.ts
    static joinId(parts: string[]) {
        return parts.map(part => part.replace(/[^a-zA-Z0-9_]/g, '-')).join('___');
    }

    /**
     * Extract headers from HTML content and organize them into a hierarchical structure
     */
    static extractHeaders(htmlContent: string): HeaderItem[] {
        try {
            // Create a temporary DOM parser
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            // Find all header elements (h1, h2, h3, h4, h5, h6)
            const headerElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
            
            const headers: HeaderItem[] = [];
            const stack: HeaderItem[] = [];

            headerElements.forEach((element, index) => {
                const level = parseInt(element.tagName.charAt(1));
                const text = element.textContent?.trim() || '';
                const id = element.id || `header-${index}`;
                
                // Ensure element has an ID for navigation
                if (!element.id) {
                    element.id = id;
                }

                const headerItem: HeaderItem = {
                    label: text,
                    level: level,
                    id: id,
                    children: []
                };

                // Find the appropriate parent based on header level
                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                if (stack.length === 0) {
                    // Top-level header
                    headers.push(headerItem);
                } else {
                    // Child header
                    stack[stack.length - 1].children.push(headerItem);
                }

                stack.push(headerItem);
            });

            Logger.info(`📋 Extracted ${headers.length} top-level headers from HTML content`);
            return headers;

        } catch (error) {
            Logger.error(`❌ Error extracting headers from HTML: ${error}`);
            return [];
        }
    }

    /**
     * Create a simple header structure for the main sections of the data viewer
     */
    static createDataViewerHeaders(): HeaderItem[] {
        return [
            {
                label: 'Scientific Data Viewer',
                level: 1,
                id: 'top-level-title',
                children: []
            },
            {
                label: 'File Information',
                level: 1,
                id: 'section-file-information',
                children: []
            },
            {
                label: 'Xarray HTML Representation',
                level: 1,
                id: 'section-html-representation',
                children: []
            },
            {
                label: 'Xarray Text Representation',
                level: 1,
                id: 'section-text-representation',
                children: []
            },
            {
                label: 'Xarray HTML Representation (for each group)',
                level: 1,
                id: 'section-html-representation-for-groups',
                children: []
            },
            {
                label: 'Xarray Text Representation (for each group)',
                level: 1,
                id: 'section-text-representation-for-groups',
                children: []
            },
            {
                label: 'Global Plot Controls',
                level: 1,
                id: 'section-global-plot-controls',
                children: []
            },
            {
                label: 'Data Groups',
                level: 1,
                id: 'section-data-groups',
                children: []
            },
            {
                label: 'Troubleshooting',
                level: 1,
                id: 'section-troubleshooting',
                children: []
            }
        ];
    }

    /**
     * Create dynamic headers based on data information, including group details
     */
    static createDynamicDataViewerHeaders(dataInfo?: DataInfoResult): HeaderItem[] {
        const baseHeaders = this.createDataViewerHeaders();
        
        if (!dataInfo) {
            return baseHeaders;
        }

        // Find sections that should be enriched with group information
        const enrichedHeaders = baseHeaders.map(header => {
            const groupNames = Object.keys(dataInfo.xarray_html_repr_flattened || {})
                .filter(groupName => groupName && groupName.trim() !== ''); // Filter out empty group names
            
            // Enrich group representation sections
            if (header.id === 'section-html-representation-for-groups' || header.id === 'section-text-representation-for-groups') {
                if (groupNames.length > 0) {
                    const groupHeaders: HeaderItem[] = groupNames.map(groupName => ({
                        label: groupName || 'Unnamed Group',
                        level: 2,
                        id: HeaderExtractor.joinId([header.id, groupName]),
                        children: []
                    }));

                    return {
                        ...header,
                        children: groupHeaders
                    };
                }
            }
            
            // Enrich Data Groups section with actual group information
            if (header.id === 'section-data-groups') {
                if (groupNames.length > 0) {
                    const groupHeaders: HeaderItem[] = groupNames.map(groupName => ({
                        label: groupName || 'Unnamed Group',
                        level: 2,
                        id: HeaderExtractor.joinId(['data-group', groupName]),
                        children: this.createDataGroupSubHeaders(groupName, dataInfo)
                    }));

                    return {
                        ...header,
                        children: groupHeaders
                    };
                }
            }
            
            return header;
        });

        Logger.info(`📋 Created dynamic outline with ${enrichedHeaders.length} main sections and group information`);
        return enrichedHeaders;
    }

    /**
     * Create sub-headers for data group sections (Dimensions, Coordinates, Variables)
     */
    private static createDataGroupSubHeaders(groupName: string, dataInfo: DataInfoResult): HeaderItem[] {
        const subHeaders: HeaderItem[] = [];

        // Add dimensions section
        const dimensions = dataInfo.dimensions_flattened[groupName] || {};
        const dimensionEntries = Object.entries(dimensions);
        if (dimensionEntries.length > 0) {
            subHeaders.push({
                label: `Dimensions (${dimensionEntries.length})`,
                level: 3,
                id: HeaderExtractor.joinId(['data-group', groupName, 'dimensions']),
                children: dimensionEntries
                    .filter(([dimName]) => dimName && dimName.trim() !== '') // Filter out empty dimension names
                    .map(([dimName, size]) => ({
                        label: `${dimName}: ${size}`,
                        level: 4,
                        id: HeaderExtractor.joinId(['data-group', groupName, 'dimension', dimName]),
                        children: []
                    }))
            });
        }

        // Add coordinates section
        const coordinates = dataInfo.coordinates_flattened[groupName] || [];
        if (coordinates.length > 0) {
            subHeaders.push({
                label: `Coordinates (${coordinates.length})`,
                level: 3,
                id: HeaderExtractor.joinId(['data-group', groupName, 'coordinates']),
                children: coordinates
                    .filter(coord => coord.name && coord.name.trim() !== '') // Filter out empty coordinate names
                    .map(coord => {
                        const coordChildren: HeaderItem[] = [];
                        
                        // Add attributes for this coordinate if they exist
                        if (coord.attributes && Object.keys(coord.attributes).length > 0) {
                            const attrEntries = Object.entries(coord.attributes)
                                .filter(([attrName]) => attrName && attrName.trim() !== ''); // Filter out empty attribute names
                            if (attrEntries.length > 0) {
                                coordChildren.push({
                                    label: `Attributes (${attrEntries.length})`,
                                    level: 5,
                                    id: HeaderExtractor.joinId(['data-group', groupName, 'coordinate', coord.name, 'attributes']),
                                    children: attrEntries.map(([attrName, value]) => ({
                                        label: `${attrName}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
                                        level: 6,
                                        id: HeaderExtractor.joinId(['data-group', groupName, 'coordinate', coord.name, 'attribute', attrName]),
                                        children: []
                                    }))
                                });
                            }
                        }
                        
                        return {
                            label: `${coord.name} (${coord.dtype})`,
                            level: 4,
                            id: HeaderExtractor.joinId(['data-group', groupName, 'coordinate', coord.name]),
                            children: coordChildren
                        };
                    })
            });
        }

        // Add variables section
        const variables = dataInfo.variables_flattened[groupName] || [];
        if (variables.length > 0) {
            subHeaders.push({
                label: `Variables (${variables.length})`,
                level: 3,
                id: HeaderExtractor.joinId(['data-group', groupName, 'variables']),
                children: variables
                    .filter(variable => variable.name && variable.name.trim() !== '') // Filter out empty variable names
                    .map(variable => {
                        const varChildren: HeaderItem[] = [];
                        
                        // Add attributes for this variable if they exist
                        if (variable.attributes && Object.keys(variable.attributes).length > 0) {
                            const attrEntries = Object.entries(variable.attributes)
                                .filter(([attrName]) => attrName && attrName.trim() !== ''); // Filter out empty attribute names
                            if (attrEntries.length > 0) {
                                varChildren.push({
                                    label: `Attributes (${attrEntries.length})`,
                                    level: 5,
                                    id: HeaderExtractor.joinId(['data-group', groupName, 'variable', variable.name, 'attributes']),
                                    children: attrEntries.map(([attrName, value]) => ({
                                        label: `${attrName}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
                                        level: 6,
                                        id: HeaderExtractor.joinId(['data-group', groupName, 'variable', variable.name, 'attribute', attrName]),
                                        children: []
                                    }))
                                });
                            }
                        }
                        
                        return {
                            label: `${variable.name} (${variable.dtype})`,
                            level: 4,
                            id: HeaderExtractor.joinId(['data-group', groupName, 'variable', variable.name]),
                            children: varChildren
                        };
                    })
            });
        }

        // Add attributes section
        const attributes = dataInfo.attributes_flattened[groupName] || {};
        const attributeEntries = Object.entries(attributes);
        if (attributeEntries.length > 0) {
            subHeaders.push({
                label: `Attributes (${attributeEntries.length})`,
                level: 3,
                id: HeaderExtractor.joinId(['data-group', groupName, 'attributes']),
                children: attributeEntries
                    .filter(([attrName]) => attrName && attrName.trim() !== '') // Filter out empty attribute names
                    .map(([attrName, value]) => ({
                        label: `${attrName}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
                        level: 4,
                        id: HeaderExtractor.joinId(['data-group', groupName, 'attribute', attrName]),
                        children: []
                    }))
            });
        }

        return subHeaders;
    }
}


