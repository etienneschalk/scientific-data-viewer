/**
 * Element ids shared by the webview (which renders them) and the outline
 * (`HeaderExtractor`, which links to them). Pure module: no DOM, no vscode.
 */

/** Join id parts with `___`, replacing every character outside [a-zA-Z0-9_] by `-`. */
export function joinId(parts: string[]): string {
    return parts
        .map((part) => String(part).replace(/[^a-zA-Z0-9_]/g, '-'))
        .join('___');
}
