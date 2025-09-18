/**
 * Header component for the data viewer
 */

import { BaseComponent, ComponentProps } from './BaseComponent';

export interface HeaderProps extends ComponentProps {
    plottingCapabilities: boolean;
    lastLoadTime: string | null;
    onRefresh: () => void;
    onVariableSelect: (variable: string) => void;
    onPlotTypeSelect: (plotType: string) => void;
    onCreatePlot: () => void;
}

export class HeaderComponent extends BaseComponent {
    private refreshButton: HTMLButtonElement | null = null;
    private variableSelect: HTMLSelectElement | null = null;
    private plotTypeSelect: HTMLSelectElement | null = null;
    private plotButton: HTMLButtonElement | null = null;

    constructor(props: HeaderProps) {
        super(props);
    }

    render(): string {
        const { plottingCapabilities, lastLoadTime } = this.props as HeaderProps;
        
        return `
            <div class="header">
                <div class="title">Scientific Data Viewer</div>
                <div class="controls">
                    ${this.renderPlottingControls(plottingCapabilities)}
                    ${this.renderTimestamp(lastLoadTime)}
                    <button id="refreshButton">Refresh</button>
                </div>
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

    private renderPlottingControls(plottingCapabilities: boolean): string {
        if (!plottingCapabilities) {
            return '';
        }
        
        return `
            <select id="variableSelect">
                <option value="">Select a variable...</option>
            </select>
            <select id="plotTypeSelect">
                <option value="auto" selected>Auto (Recommended)</option>
                <option value="line">Line Plot</option>
                <option value="heatmap">Heatmap</option>
                <option value="histogram">Histogram</option>
            </select>
            <button id="plotButton" disabled>Create Plot</button>
        `;
    }

    private renderTimestamp(lastLoadTime: string | null): string {
        if (!lastLoadTime) {
            return '<div id="timestamp" class="timestamp hidden"><span class="timestamp-icon">🕒</span><span id="timestampText">Last loaded: --</span></div>';
        }
        
        return `
            <div id="timestamp" class="timestamp">
                <span class="timestamp-icon">🕒</span>
                <span id="timestampText">Last loaded: ${this.formatTimestamp(lastLoadTime)}</span>
            </div>
        `;
    }

    private setupEventListeners(): void {
        if (!this.element) return;

        // Refresh button
        this.refreshButton = this.element.querySelector('#refreshButton') as HTMLButtonElement;
        if (this.refreshButton) {
            this.refreshButton.addEventListener('click', () => {
                const { onRefresh } = this.props as HeaderProps;
                onRefresh();
            });
        }

        // Plotting controls
        const { plottingCapabilities } = this.props as HeaderProps;
        if (plottingCapabilities) {
            this.variableSelect = this.element.querySelector('#variableSelect') as HTMLSelectElement;
            this.plotTypeSelect = this.element.querySelector('#plotTypeSelect') as HTMLSelectElement;
            this.plotButton = this.element.querySelector('#plotButton') as HTMLButtonElement;

            if (this.variableSelect) {
                this.variableSelect.addEventListener('change', (e: Event) => {
                    const target = e.target as HTMLSelectElement;
                    const { onVariableSelect } = this.props as HeaderProps;
                    onVariableSelect(target.value);
                    this.updatePlotButton();
                });
            }

            if (this.plotTypeSelect) {
                this.plotTypeSelect.addEventListener('change', (e: Event) => {
                    const target = e.target as HTMLSelectElement;
                    const { onPlotTypeSelect } = this.props as HeaderProps;
                    onPlotTypeSelect(target.value);
                });
            }

            if (this.plotButton) {
                this.plotButton.addEventListener('click', () => {
                    const { onCreatePlot } = this.props as HeaderProps;
                    onCreatePlot();
                });
            }
        }
    }

    private removeEventListeners(): void {
        // Event listeners are automatically removed when elements are destroyed
        this.refreshButton = null;
        this.variableSelect = null;
        this.plotTypeSelect = null;
        this.plotButton = null;
    }

    private updatePlotButton(): void {
        if (this.plotButton && this.variableSelect) {
            this.plotButton.disabled = !this.variableSelect.value;
        }
    }

    // Public methods for external control
    updateTimestamp(lastLoadTime: string | null): void {
        const timestampElement = this.element?.querySelector('#timestamp') as HTMLElement;
        const timestampText = this.element?.querySelector('#timestampText') as HTMLElement;
        
        if (timestampElement && timestampText) {
            if (lastLoadTime) {
                timestampText.textContent = `Last loaded: ${this.formatTimestamp(lastLoadTime)}`;
                timestampElement.classList.remove('hidden');
            } else {
                timestampElement.classList.add('hidden');
            }
        }
    }

    populateVariables(variables: string[]): void {
        if (!this.variableSelect) return;

        // Clear existing options except the first one
        this.variableSelect.innerHTML = '<option value="">Select a variable...</option>';
        
        // Add variable options
        variables.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable;
            option.textContent = variable;
            this.variableSelect?.appendChild(option);
        });
    }

    setSelectedVariable(variable: string | null): void {
        if (this.variableSelect) {
            this.variableSelect.value = variable || '';
            this.updatePlotButton();
        }
    }

    setPlotType(plotType: string): void {
        if (this.plotTypeSelect) {
            this.plotTypeSelect.value = plotType;
        }
    }

    componentDidMount(): void {
        // Override if needed
    }

    componentDidUpdate(prevProps: ComponentProps, prevState: any): void {
        const { plottingCapabilities, lastLoadTime } = this.props as HeaderProps;
        const prevHeaderProps = prevProps as HeaderProps;

        // Update timestamp if it changed
        if (lastLoadTime !== prevHeaderProps.lastLoadTime) {
            this.updateTimestamp(lastLoadTime);
        }

        // Update plotting controls if capabilities changed
        if (plottingCapabilities !== prevHeaderProps.plottingCapabilities) {
            this.rerender();
        }
    }

    componentWillUnmount(): void {
        this.removeEventListeners();
    }
}
