import { HeaderItem } from './OutlineProvider';
import { Logger } from '../logger';

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
}


