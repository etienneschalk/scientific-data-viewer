import * as assert from 'assert';
import { HTMLGenerator } from '../../../src/ui/HTMLGenerator';

suite('HTMLGenerator Test Suite', () => {
    test('should generate main HTML', () => {
        const content = '<div>Test content</div>';
        const html = HTMLGenerator.generateMainHTML(true, content);
        
        assert.ok(html);
        assert.ok(typeof html === 'string');
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.includes('<html lang="en">'));
        assert.ok(html.includes('<head>'));
        assert.ok(html.includes('<body>'));
        assert.ok(html.includes(content));
    });

    test('should generate main HTML without plotting capabilities', () => {
        const content = '<div>Test content</div>';
        const html = HTMLGenerator.generateMainHTML(false, content);
        
        assert.ok(html);
        assert.ok(typeof html === 'string');
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.includes(content));
    });

    test('should generate main HTML in dev mode', () => {
        const content = '<div>Test content</div>';
        const html = HTMLGenerator.generateMainHTML(true, content);
        
        assert.ok(html);
        assert.ok(typeof html === 'string');
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.includes(content));
    });

    test('should generate header', () => {
        const header = HTMLGenerator.generateHeader('2023-01-01T00:00:00Z');
        
        assert.ok(header);
        assert.ok(typeof header === 'string');
        assert.ok(header.includes('header'));
        assert.ok(header.includes('Scientific Data Viewer'));
    });

    test('should generate header without timestamp', () => {
        const header = HTMLGenerator.generateHeader(null);
        
        assert.ok(header);
        assert.ok(typeof header === 'string');
        assert.ok(header.includes('header'));
        assert.ok(header.includes('Scientific Data Viewer'));
    });

    test('should generate timestamp', () => {
        const timestamp = HTMLGenerator.generateTimestamp('2023-01-01T00:00:00Z');
        
        assert.ok(timestamp);
        assert.ok(typeof timestamp === 'string');
        assert.ok(timestamp.includes('timestamp'));
        // The timestamp gets formatted to local time, so we check for the formatted version
        const date = new Date('2023-01-01T00:00:00Z');
        const expectedFormattedTime = date.toLocaleTimeString();
        assert.ok(timestamp.includes(expectedFormattedTime));
    });

    test('should generate timestamp for null value', () => {
        const timestamp = HTMLGenerator.generateTimestamp(null);
        
        assert.ok(timestamp);
        assert.ok(typeof timestamp === 'string');
        assert.ok(timestamp.includes('timestamp'));
        assert.ok(timestamp.includes('Last loaded: --'));
    });

    test('should generate loading and error content', () => {
        const content = HTMLGenerator.generateLoadingAndError();
        
        assert.ok(content);
        assert.ok(typeof content === 'string');
        assert.ok(content.includes('loading'));
        assert.ok(content.includes('error'));
    });

    test('should generate content', () => {
        const content = HTMLGenerator.generateContent();
        
        assert.ok(content);
        assert.ok(typeof content === 'string');
        assert.ok(content.includes('content'));
    });

    test('should generate file info', () => {
        const content = HTMLGenerator.generateFileInfo();
        
        assert.ok(content);
        assert.ok(typeof content === 'string');
        assert.ok(content.includes('File Information'));
    });

    test('should generate dimensions and variables', () => {
        const content = HTMLGenerator.generateDimensionsAndVariables();
        
        assert.ok(content);
        assert.ok(typeof content === 'string');
        assert.ok(content.includes('Dimensions'));
    });

    test('should generate HTML representation', () => {
        const content = HTMLGenerator.generateHtmlRepresentation();
        
        assert.ok(content);
        assert.ok(typeof content === 'string');
        assert.ok(content.includes('html-representation'));
    });

    test('should generate text representation', () => {
        const content = HTMLGenerator.generateTextRepresentation();
        
        assert.ok(content);
        assert.ok(typeof content === 'string');
        assert.ok(content.includes('text-representation'));
    });

    test('should generate troubleshooting', () => {
        const content = HTMLGenerator.generateTroubleshooting();
        
        assert.ok(content);
        assert.ok(typeof content === 'string');
        assert.ok(content.includes('troubleshooting'));
    });

    test('should generate complete HTML with all components', () => {
        const content = HTMLGenerator.generateContent();
        const header = HTMLGenerator.generateHeader('2023-01-01T00:00:00Z');
        const html = HTMLGenerator.generateMainHTML(true, '2023-01-01T00:00:00Z');
        
        assert.ok(html);
        assert.ok(typeof html === 'string');
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.includes('<html lang="en">'));
        assert.ok(html.includes('<head>'));
        assert.ok(html.includes('<body>'));
        assert.ok(html.includes('Scientific Data Viewer'));
    });
});