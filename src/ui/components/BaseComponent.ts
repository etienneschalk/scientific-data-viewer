/**
 * Base component class for UI components
 */

export interface ComponentProps {
    [key: string]: any;
}

export interface ComponentState {
    [key: string]: any;
}

export abstract class BaseComponent {
    protected props: ComponentProps;
    protected state: ComponentState;
    protected element: HTMLElement | null = null;
    protected parent: BaseComponent | null = null;
    protected children: BaseComponent[] = [];

    constructor(props: ComponentProps = {}) {
        this.props = { ...props };
        this.state = {};
    }

    // Abstract methods that must be implemented
    abstract render(): string;
    abstract mount(element: HTMLElement): void;
    abstract unmount(): void;

    // Lifecycle methods
    componentDidMount(): void {
        // Override in subclasses
    }

    componentDidUpdate(prevProps: ComponentProps, prevState: ComponentState): void {
        // Override in subclasses
    }

    componentWillUnmount(): void {
        // Override in subclasses
    }

    // State management
    setState(newState: Partial<ComponentState>): void {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...newState };
        this.componentDidUpdate(this.props, prevState);
        this.rerender();
    }

    // Props management
    setProps(newProps: ComponentProps): void {
        const prevProps = { ...this.props };
        this.props = { ...this.props, ...newProps };
        this.componentDidUpdate(prevProps, this.state);
        this.rerender();
    }

    // Rendering
    protected rerender(): void {
        if (this.element && this.parent) {
            this.parent.rerenderChild(this);
        }
    }

    protected rerenderChild(child: BaseComponent): void {
        const childIndex = this.children.indexOf(child);
        if (childIndex !== -1 && this.element) {
            const childElement = this.element.children[childIndex] as HTMLElement;
            if (childElement) {
                childElement.outerHTML = child.render();
                child.mount(childElement);
            }
        }
    }

    // Child management
    addChild(child: BaseComponent): void {
        child.parent = this;
        this.children.push(child);
    }

    removeChild(child: BaseComponent): void {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            child.unmount();
            child.parent = null;
            this.children.splice(index, 1);
        }
    }

    // Utility methods
    protected createElement(tag: string, attributes: Record<string, string> = {}, content: string = ''): string {
        const attrs = Object.entries(attributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');
        
        return `<${tag}${attrs ? ' ' + attrs : ''}>${content}</${tag}>`;
    }

    protected createElementSelfClosing(tag: string, attributes: Record<string, string> = {}): string {
        const attrs = Object.entries(attributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');
        
        return `<${tag}${attrs ? ' ' + attrs : ''} />`;
    }

    protected addClass(className: string): string {
        return this.state.className ? `${this.state.className} ${className}` : className;
    }

    protected formatFileSize(bytes: number): string {
        const sizes = ['B', 'kB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    protected formatTimestamp(isoString: string): string {
        const date = new Date(isoString);
        return date.toLocaleTimeString();
    }

    // Event handling
    protected addEventListener(event: string, handler: (event: Event) => void): void {
        if (this.element) {
            this.element.addEventListener(event, handler);
        }
    }

    protected removeEventListener(event: string, handler: (event: Event) => void): void {
        if (this.element) {
            this.element.removeEventListener(event, handler);
        }
    }

    // Cleanup
    dispose(): void {
        this.componentWillUnmount();
        this.children.forEach(child => child.dispose());
        this.children = [];
        this.unmount();
    }
}
