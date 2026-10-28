import { Logger } from '../common/Logger';
import { getNestedAttributesView } from '../common/config';
import { getDisplayName } from '../common/vscodeutils';
import { DataInfoResult, HeaderItem } from '../types';
import { joinId } from '../shared/ids';

export interface DataViewerHeaderOptions {
    /**
     * Group attributes shown as a collapsible tree (webview
     * `nestedAttributesView`); defaults to the extension setting.
     */
    nestedAttributesView?: boolean;
}

function formatAttributeLabel(name: string, value: unknown): string {
    return `${name}: ${typeof value === 'string' ? value : JSON.stringify(value)}`;
}

function isAttributeObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class HeaderExtractor {
    // Same ids as the webview renders (shared implementation)
    static joinId(parts: string[]): string {
        return joinId(parts);
    }

    /**
     * Main sections of the data viewer page
     */
    private static createDataViewerHeaders(): HeaderItem[] {
        const section = (label: string, id: string): HeaderItem => ({
            label,
            level: 1,
            id,
            children: [],
        });
        return [
            section(getDisplayName(), 'top-level-title'),
            section('File Information', 'section-file-information'),
            section(
                'Xarray HTML Representation',
                'section-html-representation',
            ),
            section(
                'Xarray Text Representation',
                'section-text-representation',
            ),
            section(
                'Xarray HTML Representation (for each group)',
                'section-html-representation-for-groups',
            ),
            section(
                'Xarray Text Representation (for each group)',
                'section-text-representation-for-groups',
            ),
            section('Global Plot Controls', 'section-global-plot-controls'),
            section('Data Groups', 'section-data-groups'),
            section('Troubleshooting', 'section-troubleshooting'),
        ];
    }

    /**
     * Create dynamic headers based on data information, including group details
     */
    static createDynamicDataViewerHeaders(
        dataInfo?: DataInfoResult,
        options: DataViewerHeaderOptions = {},
    ): HeaderItem[] {
        const baseHeaders = this.createDataViewerHeaders();
        const nestedAttributesView =
            options.nestedAttributesView ?? getNestedAttributesView();

        if (!dataInfo) {
            return baseHeaders;
        }

        // Match webview Data Groups order (dimensions_flattened); respects
        // scientificDataViewer.orderGroupsAlphabetically via Python get_data_info.
        const groupNames = Object.keys(
            dataInfo.dimensions_flattened || {},
        ).filter((groupName) => groupName && groupName.trim() !== '');

        const reprGroupNames = groupNames.filter(
            (groupName) =>
                groupName in (dataInfo.xarray_html_repr_flattened || {}),
        );

        // Find sections that should be enriched with group information
        const enrichedHeaders = baseHeaders.map((header) => {
            // Enrich group representation sections
            if (
                header.id === 'section-html-representation-for-groups' ||
                header.id === 'section-text-representation-for-groups'
            ) {
                if (reprGroupNames.length > 0) {
                    const groupHeaders: HeaderItem[] = reprGroupNames.map(
                        (groupName) => ({
                            label: groupName || 'Unnamed Group',
                            level: 2,
                            id: HeaderExtractor.joinId([header.id, groupName]),
                            children: [],
                        }),
                    );

                    return {
                        ...header,
                        children: groupHeaders,
                    };
                }
            }

            // Enrich Data Groups section with actual group information
            if (header.id === 'section-data-groups') {
                if (groupNames.length > 0) {
                    const groupHeaders: HeaderItem[] = groupNames.map(
                        (groupName) => ({
                            label: groupName || 'Unnamed Group',
                            level: 2,
                            id: HeaderExtractor.joinId([
                                'data-group',
                                groupName,
                            ]),
                            children: this.createDataGroupSubHeaders(
                                groupName,
                                dataInfo,
                                nestedAttributesView,
                            ),
                        }),
                    );

                    return {
                        ...header,
                        children: groupHeaders,
                    };
                }
            }

            return header;
        });

        Logger.info(
            `📋 Created dynamic outline with ${enrichedHeaders.length} main sections and group information`,
        );
        return enrichedHeaders;
    }

    /**
     * Create sub-headers for data group sections (Dimensions, Coordinates, Variables)
     */
    private static createDataGroupSubHeaders(
        groupName: string,
        dataInfo: DataInfoResult,
        nestedAttributesView: boolean,
    ): HeaderItem[] {
        const subHeaders: HeaderItem[] = [];

        // Add dimensions section
        const dimensions = dataInfo.dimensions_flattened[groupName] || {};
        const dimensionEntries = Object.entries(dimensions);
        if (dimensionEntries.length > 0) {
            subHeaders.push({
                label: `Dimensions (${dimensionEntries.length})`,
                level: 3,
                id: HeaderExtractor.joinId([
                    'data-group',
                    groupName,
                    'dimensions',
                ]),
                children: dimensionEntries
                    .filter(([dimName]) => dimName && dimName.trim() !== '') // Filter out empty dimension names
                    .map(([dimName, size]) => ({
                        label: `${dimName}: ${size}`,
                        level: 4,
                        id: HeaderExtractor.joinId([
                            'data-group',
                            groupName,
                            'dimension',
                            dimName,
                        ]),
                        children: [],
                    })),
            });
        }

        // Add coordinates section
        const coordinates = dataInfo.coordinates_flattened[groupName] || [];
        if (coordinates.length > 0) {
            subHeaders.push({
                label: `Coordinates (${coordinates.length})`,
                level: 3,
                id: HeaderExtractor.joinId([
                    'data-group',
                    groupName,
                    'coordinates',
                ]),
                children: coordinates
                    .filter((coord) => coord.name && coord.name.trim() !== '') // Filter out empty coordinate names
                    .map((coord) => {
                        const coordChildren: HeaderItem[] = [];

                        // Add attributes for this coordinate if they exist
                        if (
                            coord.attributes &&
                            Object.keys(coord.attributes).length > 0
                        ) {
                            const attrEntries = Object.entries(
                                coord.attributes,
                            ).filter(
                                ([attrName]) =>
                                    attrName && attrName.trim() !== '',
                            ); // Filter out empty attribute names
                            if (attrEntries.length > 0) {
                                coordChildren.push({
                                    label: `Attributes (${attrEntries.length})`,
                                    level: 5,
                                    id: HeaderExtractor.joinId([
                                        'data-group',
                                        groupName,
                                        'coordinate',
                                        coord.name,
                                        'attributes',
                                    ]),
                                    children: attrEntries.map(
                                        ([attrName, value]) => ({
                                            label: formatAttributeLabel(
                                                attrName,
                                                value,
                                            ),
                                            level: 6,
                                            id: HeaderExtractor.joinId([
                                                'data-group',
                                                groupName,
                                                'coordinate',
                                                coord.name,
                                                'attribute',
                                                attrName,
                                            ]),
                                            children: [],
                                        }),
                                    ),
                                });
                            }
                        }

                        return {
                            label: `${coord.name} (${coord.dtype})`,
                            level: 4,
                            id: HeaderExtractor.joinId([
                                'data-group',
                                groupName,
                                'coordinate',
                                coord.name,
                            ]),
                            children: coordChildren,
                        };
                    }),
            });
        }

        // Add variables section
        const variables = dataInfo.variables_flattened[groupName] || [];
        if (variables.length > 0) {
            subHeaders.push({
                label: `Variables (${variables.length})`,
                level: 3,
                id: HeaderExtractor.joinId([
                    'data-group',
                    groupName,
                    'variables',
                ]),
                children: variables
                    .filter(
                        (variable) =>
                            variable.name && variable.name.trim() !== '',
                    ) // Filter out empty variable names
                    .map((variable) => {
                        const varChildren: HeaderItem[] = [];

                        // Add attributes for this variable if they exist
                        if (
                            variable.attributes &&
                            Object.keys(variable.attributes).length > 0
                        ) {
                            const attrEntries = Object.entries(
                                variable.attributes,
                            ).filter(
                                ([attrName]) =>
                                    attrName && attrName.trim() !== '',
                            ); // Filter out empty attribute names
                            if (attrEntries.length > 0) {
                                varChildren.push({
                                    label: `Attributes (${attrEntries.length})`,
                                    level: 5,
                                    id: HeaderExtractor.joinId([
                                        'data-group',
                                        groupName,
                                        'variable',
                                        variable.name,
                                        'attributes',
                                    ]),
                                    children: attrEntries.map(
                                        ([attrName, value]) => ({
                                            label: formatAttributeLabel(
                                                attrName,
                                                value,
                                            ),
                                            level: 6,
                                            id: HeaderExtractor.joinId([
                                                'data-group',
                                                groupName,
                                                'variable',
                                                variable.name,
                                                'attribute',
                                                attrName,
                                            ]),
                                            children: [],
                                        }),
                                    ),
                                });
                            }
                        }

                        return {
                            label: `${variable.name} (${variable.dtype})`,
                            level: 4,
                            id: HeaderExtractor.joinId([
                                'data-group',
                                groupName,
                                'variable',
                                variable.name,
                            ]),
                            children: varChildren,
                        };
                    }),
            });
        }

        // Add attributes section (ids follow the webview: flat list, or
        // collapsible tree when nestedAttributesView is on)
        const attributes = dataInfo.attributes_flattened[groupName] || {};
        const attributeEntries = Object.entries(attributes);
        if (attributeEntries.length > 0) {
            const sectionIdParts = ['data-group', groupName, 'attributes'];
            subHeaders.push({
                label: `Attributes (${attributeEntries.length})`,
                level: 3,
                id: HeaderExtractor.joinId(sectionIdParts),
                children: nestedAttributesView
                    ? this.createNestedAttributeHeaders(
                          attributes,
                          sectionIdParts,
                          4,
                      )
                    : attributeEntries
                          .filter(
                              ([attrName]) =>
                                  attrName && attrName.trim() !== '',
                          ) // Filter out empty attribute names
                          .map(([attrName, value]) => ({
                              label: formatAttributeLabel(attrName, value),
                              level: 4,
                              id: HeaderExtractor.joinId([
                                  'data-group',
                                  groupName,
                                  'attribute',
                                  attrName,
                              ]),
                              children: [],
                          })),
            });
        }

        return subHeaders;
    }

    /**
     * Headers of a nested attributes tree, with the webview's ids:
     * `[...parentIdParts, 'attr', key]`, recursively for object values.
     */
    private static createNestedAttributeHeaders(
        attributes: Record<string, unknown>,
        parentIdParts: string[],
        level: number,
    ): HeaderItem[] {
        return Object.entries(attributes)
            .filter(([key]) => key && key.trim() !== '')
            .map(([key, value]) => {
                const idParts = [...parentIdParts, 'attr', key];
                const nested = isAttributeObject(value);
                return {
                    label: nested ? key : formatAttributeLabel(key, value),
                    level,
                    id: HeaderExtractor.joinId(idParts),
                    children: nested
                        ? this.createNestedAttributeHeaders(
                              value,
                              idParts,
                              level + 1,
                          )
                        : [],
                };
            });
    }
}
