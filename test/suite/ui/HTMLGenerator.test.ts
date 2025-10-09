import * as assert from 'assert';
import { HTMLGenerator } from '../../../src/panel/HTMLGenerator';

suite('HTMLGenerator Test Suite', () => {
    test('should generate main HTML', () => {
        const lastLoadTime = '2023-01-01T00:00:00Z';
        const html = HTMLGenerator.generateMainHTML(
            true,
            lastLoadTime,
            1,
           
        );

        assert.ok(html);
        assert.ok(typeof html === 'string');
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.includes('<html lang="en">'));
        assert.ok(html.includes('<head>'));
        assert.ok(html.includes('<body>'));
        assert.ok(html.includes('Scientific Data Viewer'));
    });

    test('should generate main HTML without plotting capabilities', () => {
        const lastLoadTime = '2023-01-01T00:00:00Z';
        const html = HTMLGenerator.generateMainHTML(
            false,
            lastLoadTime,
            1,
           
        );

        assert.ok(html);
        assert.ok(typeof html === 'string');
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.includes('Scientific Data Viewer'));
    });

    test('should generate main HTML in dev mode', () => {
        const lastLoadTime = '2023-01-01T00:00:00Z';
        const html = HTMLGenerator.generateMainHTML(
            true,
            lastLoadTime,
            1,
           
        );

        assert.ok(html);
        assert.ok(typeof html === 'string');
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.includes('Scientific Data Viewer'));
    });

    test('should generate header', () => {
        const header = HTMLGenerator.generateHeader(
            true,
            '2023-01-01T00:00:00Z',
            1,
           
        );

        assert.ok(header);
        assert.ok(typeof header === 'string');
        assert.ok(header.includes('header'));
        assert.ok(header.includes('Scientific Data Viewer'));
    });

    test('should generate header without timestamp', () => {
        const header = HTMLGenerator.generateHeader(true, null, 1,);

        assert.ok(header);
        assert.ok(typeof header === 'string');
        assert.ok(header.includes('header'));
        assert.ok(header.includes('Scientific Data Viewer'));
    });

    test('should generate timestamp', () => {
        const timestamp = HTMLGenerator.generateTimestamp(
            '2023-01-01T00:00:00Z'
        );

        assert.ok(timestamp);
        assert.ok(typeof timestamp === 'string');
        assert.ok(timestamp.includes('timestamp'));
        // The timestamp gets formatted to local time, so we check for the formatted version
        const date = new Date('2023-01-01T00:00:00Z');
        const expectedFormattedTime = date.toISOString();
        assert.ok(timestamp.includes(expectedFormattedTime));
    });

    test('should generate timestamp for null value', () => {
        const timestamp = HTMLGenerator.generateTimestamp(null);

        assert.ok(timestamp);
        assert.ok(typeof timestamp === 'string');
        assert.ok(timestamp.includes('timestamp'));
        assert.ok(timestamp.includes('loaded: --'));
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
        assert.ok(content.includes('group-info-container'));
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
        const header = HTMLGenerator.generateHeader(
            true,
            '2023-01-01T00:00:00Z',
            1,
           
        );
        const html = HTMLGenerator.generateMainHTML(
            true,
            '2023-01-01T00:00:00Z',
            1,
           
        );

        assert.ok(html);
        assert.ok(typeof html === 'string');
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.includes('<html lang="en">'));
        assert.ok(html.includes('<head>'));
        assert.ok(html.includes('<body>'));
        assert.ok(html.includes('Scientific Data Viewer'));
    });
});
