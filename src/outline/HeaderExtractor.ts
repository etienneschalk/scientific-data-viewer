import { HeaderItem } from './OutlineProvider';
import { Logger } from '../logger';
import { DataInfoResult } from '../dataProcessor';

export class HeaderExtractor {
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
     * Extract headers from a specific container element
     */
    static extractHeadersFromContainer(containerId: string, htmlContent: string): HeaderItem[] {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const container = doc.getElementById(containerId);
            
            if (!container) {
                Logger.warn(`📋 Container with ID '${containerId}' not found`);
                return [];
            }

            // Find headers within the container
            const headerElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
            
            const headers: HeaderItem[] = [];
            const stack: HeaderItem[] = [];

            headerElements.forEach((element, index) => {
                const level = parseInt(element.tagName.charAt(1));
                const text = element.textContent?.trim() || '';
                const id = element.id || `header-${containerId}-${index}`;
                
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

            Logger.info(`📋 Extracted ${headers.length} headers from container '${containerId}'`);
            return headers;

        } catch (error) {
            Logger.error(`❌ Error extracting headers from container '${containerId}': ${error}`);
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
                id: 'title',
                children: []
            },
            {
                label: 'File Information',
                level: 1,
                id: 'file-info',
                children: []
            },
            {
                label: 'Xarray HTML Representation',
                level: 1,
                id: 'html-representation',
                children: []
            },
            {
                label: 'Xarray Text Representation',
                level: 1,
                id: 'text-representation',
                children: []
            },
            {
                label: 'Xarray HTML Representation (for each group)',
                level: 1,
                id: 'html-representation-for-groups',
                children: []
            },
            {
                label: 'Xarray Text Representation (for each group)',
                level: 1,
                id: 'text-representation-for-groups',
                children: []
            },
            {
                label: 'Global Plot Controls',
                level: 1,
                id: 'plot-controls',
                children: []
            },
            {
                label: 'Troubleshooting',
                level: 1,
                id: 'troubleshooting',
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

        // Find the group representation sections and enrich them with group information
        const enrichedHeaders = baseHeaders.map(header => {
            if (header.id === 'html-representation-for-groups' || header.id === 'text-representation-for-groups') {
                const groupNames = Object.keys(dataInfo.xarray_html_repr_flattened || {});
                
                if (groupNames.length > 0) {
                    const groupHeaders: HeaderItem[] = groupNames.map(groupName => ({
                        label: groupName === '/' ? 'Root Group' : groupName,
                        level: 2,
                        id: `${header.id}-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}`,
                        children: this.createGroupSubHeaders(groupName, dataInfo, header.id || 'unknown')
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
     * Create sub-headers for a specific group (variables, coordinates, dimensions, attributes)
     */
    private static createGroupSubHeaders(groupName: string, dataInfo: DataInfoResult, parentHeaderId: string): HeaderItem[] {
        const subHeaders: HeaderItem[] = [];

        // Add variables section
        const variables = dataInfo.variables_flattened[groupName] || [];
        if (variables.length > 0) {
            subHeaders.push({
                label: `Variables (${variables.length})`,
                level: 3,
                id: `${parentHeaderId}-group-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}-variables`,
                children: variables.map(variable => ({
                    label: `${variable.name} (${variable.dtype})`,
                    level: 4,
                    id: `${parentHeaderId}-group-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}-var-${variable.name}`,
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
                id: `${parentHeaderId}-group-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}-coordinates`,
                children: coordinates.map(coord => ({
                    label: `${coord.name} (${coord.dtype})`,
                    level: 4,
                    id: `${parentHeaderId}-group-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}-coord-${coord.name}`,
                    children: []
                }))
            });
        }

        // Add dimensions section
        const dimensions = dataInfo.dimensions_flattened[groupName] || {};
        const dimensionEntries = Object.entries(dimensions);
        if (dimensionEntries.length > 0) {
            subHeaders.push({
                label: `Dimensions (${dimensionEntries.length})`,
                level: 3,
                id: `${parentHeaderId}-group-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}-dimensions`,
                children: dimensionEntries.map(([dimName, size]) => ({
                    label: `${dimName}: ${size}`,
                    level: 4,
                    id: `${parentHeaderId}-group-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}-dim-${dimName}`,
                    children: []
                }))
            });
        }

        // Add attributes section
        const attributes = dataInfo.attributes_flattened[groupName] || {};
        const attributeEntries = Object.entries(attributes);
        if (attributeEntries.length > 0) {
            subHeaders.push({
                label: `Attributes (${attributeEntries.length})`,
                level: 3,
                id: `${parentHeaderId}-group-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}-attributes`,
                children: attributeEntries.map(([attrName, value]) => ({
                    label: `${attrName}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
                    level: 4,
                    id: `${parentHeaderId}-group-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}-attr-${attrName}`,
                    children: []
                }))
            });
        }

        return subHeaders;
    }
}


