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
                ${this.renderCoordinates(data)}
                ${this.renderVariables(data)}
                ${this.renderHtmlRepresentation(data)}
                ${this.renderTextRepresentation(data)}
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

    private renderVariableItem(item: any, type: string): string {
        const clickable = type === 'variable' && this.props.onVariableClick;
        const className = `variable-item ${clickable ? 'clickable' : ''}`;
        const dataAttributes = clickable ? `data-variable="${item.name}"` : '';
        
        return `
            <div class="${className}" ${dataAttributes}>
                <strong>${item.name}</strong><br>
                <small>
                    ${item.dtype} ${item.shape ? '(' + item.shape.join(', ') + ')' : ''}<br>
                    ${item.dimensions && item.dimensions.length > 0 ? 'Dims: ' + item.dimensions.join(', ') : ''}<br>
                    ${item.size_bytes ? 'Size: ' + this.formatFileSize(item.size_bytes) : ''}
                </small>
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
                const textElement = this.element?.querySelector('.text-representation');
                textToCopy = textElement?.textContent || '';
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
