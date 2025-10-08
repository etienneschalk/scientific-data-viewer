/**
 * TypeScript types generated from package.json
 * Lightweight structure-only type definitions for VSCode extension package configuration
 */

// Engine requirements
export interface Engines {
  vscode: string;
  node: string;
}

// Activation events
export type ActivationEvent = 
  | `onLanguage:${string}`
  | `onFileSystem:${string}`;

// Command definition
export interface Command {
  command: string;
  title: string;
  category: string;
  icon?: string;
}

// Menu item
export interface MenuItem {
  command: string;
  when?: string;
  group?: string;
}

// Menu configuration
export interface Menus {
  'explorer/context': MenuItem[];
  commandPalette: MenuItem[];
  'view/title': MenuItem[];
}

// Language definition
export interface Language {
  id: string;
  extensions: string[];
  aliases: string[];
  icon: {
    light: string;
    dark: string;
  };
}

// View definition
export interface View {
  id: string;
  name: string;
  type: 'tree';
  accessibilityHelpContent: string;
  visibility: 'visible' | 'hidden';
  when: string;
}

// Views configuration
export interface Views {
  explorer: View[];
}

// Custom editor selector
export interface CustomEditorSelector {
  filenamePattern: string;
}

// Custom editor
export interface CustomEditor {
  viewType: string;
  displayName: string;
  selector: CustomEditorSelector[];
  icon: {
    light: string;
    dark: string;
  };
}

// Configuration property
export interface ConfigurationProperty {
  type: 'string' | 'number' | 'boolean';
  default: any;
  order: number;
  description: string;
  enum?: string[];
  experimental?: boolean;
  markdownDescription?: string;
}

// Configuration
export interface Configuration {
  title: string;
  properties: Record<string, ConfigurationProperty>;
}

// Contributes section
export interface Contributes {
  commands: Command[];
  menus: Menus;
  languages: Language[];
  views: Views;
  customEditors: CustomEditor[];
  configuration: Configuration;
}

// Scripts
export interface Scripts {
  [key: string]: string;
}

// Repository information
export interface Repository {
  type: string;
  url: string;
}

// Bug tracking
export interface Bugs {
  url: string;
}

// Main package.json type
export interface PackageJson {
  name: string;
  displayName: string;
  description: string;
  version: string;
  publisher: string;
  icon: string;
  engines: Engines;
  extensionDependencies: string[];
  categories: string[];
  keywords: string[];
  activationEvents: ActivationEvent[];
  main: string;
  contributes: Contributes;
  scripts: Scripts;
  devDependencies: Record<string, string>;
  dependencies: Record<string, string>;
  repository: Repository;
  homepage: string;
  bugs: Bugs;
}

// Utility types for working with the package.json
export type PackageJsonKeys = keyof PackageJson;
export type ContributesKeys = keyof Contributes;
export type ScriptsKeys = keyof Scripts;
