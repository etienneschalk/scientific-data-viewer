/**
 * Data display component for showing file information, dimensions, variables, etc.
 */

import { BaseComponent, ComponentProps } from './BaseComponent';

export interface DataDisplayProps extends ComponentProps {
    data: any;
    filePath: string;
    onVariableClick?: (variable: string) => void;
}

export class DataDisplayComponent extends BaseComponent {
    constructor(props: DataDisplayProps) {
        super(props);
    }

    render(): string {
        const { data, filePath } = this.props as DataDisplayProps;
        
        if (!data) {
            return '<div class="no-data">No data available</div>';
        }

        return `
            <div class="data-display">
                ${this.renderFileInfo(data, filePath)}
                ${this.renderDimensions(data)}
                ${this.renderDataSections(data)}
            </div>
        `;
    }

    mount(element: HTMLElement): void {
        this.element = element;
        this.setupEventListeners();
        this.componentDidMount();
    }

    unmount(): void {
        this.removeEventListeners();
        this.element = null;
    }

    private renderFileInfo(data: any, filePath: string): string {
        return `
            <div class="info-section">
                <h3>File Information</h3>
                <div class="file-path-container">
                    <p><strong>File Path:</strong></p>
                    <code class="file-path-code">${filePath}</code>
                    <button class="copy-button" data-copy-target="filePath">📋 Copy</button>
                </div>
                <div class="file-info">
                    ${this.renderFormatInfo(data)}
                </div>
            </div>
        `;
    }

    private renderFormatInfo(data: any): string {
        let formatInfo = `<p><strong>Format:</strong> ${data.format || 'Unknown'}</p>`;
        
        if (data.format_info) {
            formatInfo += `
                <p><strong>File Extension:</strong> ${data.format_info.extension}</p>
                <p><strong>Available Engines:</strong> ${data.format_info.available_engines?.join(', ') || 'None'}</p>
                ${data.used_engine ? `<p><strong>Used Engine:</strong> ${data.used_engine}</p>` : ''}
            `;
        }
        
        if (data.fileSize) {
            formatInfo += `<p><strong>Size:</strong> ${this.formatFileSize(data.fileSize)}</p>`;
        }
        
        return formatInfo;
    }

    private renderDimensions(data: any): string {
        return `
            <div class="info-section">
                <h3>Dimensions</h3>
                <div class="dimensions">
                    ${data.dimensions ? 
                        Object.entries(data.dimensions)
                            .map(([name, size]) => `<div class="dimension-item">${name}: ${size}</div>`)
                            .join('') :
                        '<p>No dimensions found</p>'
                    }
                </div>
            </div>
        `;
    }

    private renderDataSections(data: any): string {
        if (data.datatree_flag) {
            return this.renderDatatreeSections(data);
        } else {
            return `
                ${this.renderCoordinates(data)}
                ${this.renderVariables(data)}
                ${this.renderHtmlRepresentation(data)}
                ${this.renderTextRepresentation(data)}
            `;
        }
    }

    private renderDatatreeSections(data: any): string {
        const groups = Object.keys(data.coordinates_flattened || {});
        let sections = '';

        // Render dimensions for each group
        groups.forEach(groupName => {
            sections += this.renderGroupDimensions(groupName, data.dimensions_flattened[groupName]);
        });

        // Render coordinates for each group
        groups.forEach(groupName => {
            sections += this.renderGroupCoordinates(groupName, data.coordinates_flattened[groupName]);
        });

        // Render variables for each group
        groups.forEach(groupName => {
            sections += this.renderGroupVariables(groupName, data.variables_flattened[groupName]);
        });

        // Render HTML representations for each group
        if (data.xarray_html_repr_flattened) {
            sections += this.renderGroupHtmlRepresentations(data.xarray_html_repr_flattened);
        }

        // Render text representations for each group
        if (data.xarray_text_repr_flattened) {
            sections += this.renderGroupTextRepresentations(data.xarray_text_repr_flattened);
        }

        return sections;
    }

    private renderGroupDimensions(groupName: string, dimensions: { [key: string]: number }): string {
        return `
            <div class="info-section">
                <h3>Dimensions for ${groupName}</h3>
                <div class="dimensions">
                    ${dimensions && Object.keys(dimensions).length > 0 ?
                        Object.entries(dimensions)
                            .map(([dimName, dimSize]) => `
                                <div class="dimension-item">
                                    <span class="dimension-name">${dimName}</span>
                                    <span class="dimension-size">${dimSize}</span>
                                </div>
                            `).join('') :
                        '<p>No dimensions found in this group.</p>'
                    }
                </div>
            </div>
        `;
    }

    private renderGroupCoordinates(groupName: string, coordinates: any[]): string {
        return `
            <div class="info-section">
                <h3>Coordinates for ${groupName}</h3>
                <div class="coordinates">
                    ${coordinates && coordinates.length > 0 ?
                        coordinates
                            .map((coord: any) => this.renderVariableItem(coord, 'coordinate'))
                            .join('') :
                        '<p>No coordinates found in this group.</p>'
                    }
                </div>
            </div>
        `;
    }

    private renderGroupVariables(groupName: string, variables: any[]): string {
        return `
            <div class="info-section">
                <h3>Variables for ${groupName}</h3>
                <div class="variables">
                    ${variables && variables.length > 0 ?
                        variables
                            .map((variable: any) => this.renderVariableItem(variable, 'variable', groupName))
                            .join('') :
                        '<p>No variables found in this group.</p>'
                    }
                </div>
            </div>
        `;
    }

    private renderGroupHtmlRepresentations(htmlReprs: { [groupName: string]: string }): string {
        const groups = Object.keys(htmlReprs);
        return `
            <div class="info-section">
                <h3>Xarray HTML representation (for each group)</h3>
                ${groups.map(groupName => `
                    <div class="group-section">
                        <h4>${groupName}</h4>
                        <div class="html-representation">
                            ${htmlReprs[groupName] || '<p>No HTML representation available</p>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private renderGroupTextRepresentations(textReprs: { [groupName: string]: string }): string {
        const groups = Object.keys(textReprs);
        return `
            <div class="info-section">
                <h3>Xarray Text representation (for each group)</h3>
                ${groups.map(groupName => `
                    <div class="group-section">
                        <h4>${groupName}</h4>
                        <div class="text-representation-container">
                            <button class="text-copy-button" data-copy-target="textRepresentation" data-group="${groupName}">📋 Copy</button>
                            <div class="text-representation">
                                ${textReprs[groupName] || 'No text representation available'}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private renderCoordinates(data: any): string {
        return `
            <div class="info-section">
                <h3>Coordinates</h3>
                <div class="coordinates">
                    ${data.coordinates && data.coordinates.length > 0 ?
                        data.coordinates
                            .map((coord: any) => this.renderVariableItem(coord, 'coordinate'))
                            .join('') :
                        '<p>No coordinates found at top-level group.</p>'
                    }
                </div>
            </div>
        `;
    }

    private renderVariables(data: any): string {
        return `
            <div class="info-section">
                <h3>Variables</h3>
                <div class="variables">
                    ${data.variables && data.variables.length > 0 ?
                        data.variables
                            .map((variable: any) => this.renderVariableItem(variable, 'variable'))
                            .join('') :
                        '<p>No variables found at top-level group.</p>'
                    }
                </div>
            </div>
        `;
    }

    private renderVariableItem(item: any, type: string, groupName?: string): string {
        const clickable = type === 'variable' && this.props.onVariableClick;
        const className = `variable-item ${clickable ? 'clickable' : ''}`;
        
        // For datatree variables, use full path (group/variable) for plotting
        const variableName = groupName ? `${groupName}/${item.name}` : item.name;
        const dataAttributes = clickable ? `data-variable="${variableName}"` : '';
        
        const shapeStr = item.shape ? `(${item.shape.join(', ')})` : '';
        const dimsStr = item.dimensions ? `Dims: (${item.dimensions.join(', ')})` : '';
        const sizeStr = item.size_bytes ? `Size: ${this.formatFileSize(item.size_bytes)}` : '';
        
        return `
            <div class="${className}" ${dataAttributes}>
                <span class="variable-name" title="${variableName}">${item.name}</span>
                <span class="dtype-shape">${item.dtype} ${shapeStr}</span>
                <span class="dims">${dimsStr}</span>
                ${sizeStr ? `<span class="size">${sizeStr}</span>` : ''}
            </div>
        `;
    }

    private renderHtmlRepresentation(data: any): string {
        return `
            <div class="info-section">
                <h3>Xarray HTML Representation</h3>
                <div class="html-representation">
                    ${data.xarray_html_repr || '<p>No HTML representation available</p>'}
                </div>
            </div>
        `;
    }

    private renderTextRepresentation(data: any): string {
        return `
            <div class="info-section">
                <h3>Xarray Text Representation</h3>
                <div class="text-representation-container">
                    <button class="text-copy-button" data-copy-target="textRepresentation">📋 Copy</button>
                    <div class="text-representation">
                        ${data.xarray_text_repr || 'No text representation available'}
                    </div>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.element) return;

        // Copy buttons
        const copyButtons = this.element.querySelectorAll('.copy-button, .text-copy-button');
        copyButtons.forEach((button: Element) => {
            button.addEventListener('click', async (e: Event) => {
                const target = e.target as HTMLButtonElement;
                const copyTarget = target.getAttribute('data-copy-target');
                await this.handleCopy(copyTarget, target);
            });
        });

        // Variable clicks
        const variableItems = this.element.querySelectorAll('.variable-item.clickable');
        variableItems.forEach((item: Element) => {
            item.addEventListener('click', (e: Event) => {
                const target = e.currentTarget as HTMLElement;
                const variableName = target.getAttribute('data-variable');
                if (variableName && this.props.onVariableClick) {
                    this.props.onVariableClick(variableName);
                }
            });
        });
    }

    private removeEventListeners(): void {
        // Event listeners are automatically removed when elements are destroyed
    }

    private async handleCopy(copyTarget: string | null, button: any): Promise<void> {
        if (!copyTarget) return;

        let textToCopy = '';
        
        switch (copyTarget) {
            case 'filePath':
                textToCopy = this.props.filePath;
                break;
            case 'textRepresentation':
                const groupName = button.getAttribute('data-group');
                if (groupName) {
                    // For group-specific text representation
                    const groupElement = button.closest('.group-section');
                    const textElement = groupElement?.querySelector('.text-representation');
                    textToCopy = textElement?.textContent || '';
                } else {
                    // For regular text representation
                    const textElement = this.element?.querySelector('.text-representation');
                    textToCopy = textElement?.textContent || '';
                }
                break;
        }

        if (textToCopy) {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(textToCopy);
                    this.showCopySuccess(button);
                } else {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = textToCopy;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    this.showCopySuccess(button);
                }
            } catch (err) {
                this.showCopyError(button);
            }
        }
    }

    private showCopySuccess(button: any): void {
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    }

    private showCopyError(button: any): void {
        const originalText = button.textContent;
        button.textContent = '❌ Failed';
        
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    }

    // Public methods for external control
    updateData(data: any, filePath: string): void {
        this.setProps({ data, filePath });
    }

    componentDidMount(): void {
        // Override if needed
    }

    componentDidUpdate(prevProps: ComponentProps, prevState: any): void {
        // Override if needed
    }

    componentWillUnmount(): void {
        this.removeEventListeners();
    }
}
