/**
 * Types for the parts of package.json the extension reads at runtime
 * (see src/common/vscodeutils.ts). Extend them when reading new fields.
 */

// Language definition (contributes.languages)
export interface Language {
    id: string;
    extensions: string[];
    aliases: string[];
}

// Custom editor (contributes.customEditors)
export interface CustomEditor {
    viewType: string;
}

export interface PackageJson {
    displayName: string;
    version: string;
    contributes: {
        languages: Language[];
        customEditors: CustomEditor[];
    };
}
