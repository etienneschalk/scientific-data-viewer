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

type VariableEntry = DataInfoResult['variables_flattened'][string][number];

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

        // Add coordinates and variables sections
        const variableSections: Array<
            ['coordinate' | 'variable', string, VariableEntry[]]
        > = [
            [
                'coordinate',
                'Coordinates',
                dataInfo.coordinates_flattened[groupName] || [],
            ],
            [
                'variable',
                'Variables',
                dataInfo.variables_flattened[groupName] || [],
            ],
        ];
        for (const [kind, label, variables] of variableSections) {
            if (variables.length === 0) {
                continue;
            }
            subHeaders.push({
                label: `${label} (${variables.length})`,
                level: 3,
                id: HeaderExtractor.joinId([
                    'data-group',
                    groupName,
                    `${kind}s`,
                ]),
                children: variables
                    .filter(
                        (variable) =>
                            variable.name && variable.name.trim() !== '',
                    ) // Filter out empty variable names
                    .map((variable) => {
                        const idParts = [
                            'data-group',
                            groupName,
                            kind,
                            variable.name,
                        ];
                        return {
                            label: `${variable.name} (${variable.dtype})`,
                            level: 4,
                            id: HeaderExtractor.joinId(idParts),
                            children: [
                                this.createKeyValueSection(
                                    'Attributes',
                                    variable.attributes,
                                    idParts,
                                    'attributes',
                                    'attribute',
                                    5,
                                ),
                                this.createKeyValueSection(
                                    'Xarray Encoding',
                                    variable.encoding,
                                    idParts,
                                    'encoding',
                                    'encoding-entry',
                                    5,
                                ),
                            ].filter(
                                (header): header is HeaderItem =>
                                    header !== undefined,
                            ),
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

        // Add xarray encoding section (same ids as the webview)
        const encodingSection = this.createKeyValueSection(
            'Xarray Encoding',
            dataInfo.encoding_flattened?.[groupName],
            ['data-group', groupName],
            'encoding',
            'encoding-entry',
            3,
        );
        if (encodingSection) {
            subHeaders.push(encodingSection);
        }

        return subHeaders;
    }

    /**
     * Header of a flat `name: value` section (attributes or encoding) with
     * one child per entry, or undefined when there is no entry. Ids are the
     * webview's: `[...parentIdParts, sectionId]` and
     * `[...parentIdParts, itemKind, name]`.
     */
    private static createKeyValueSection(
        label: string,
        entries: Record<string, unknown> | undefined,
        parentIdParts: string[],
        sectionId: string,
        itemKind: string,
        level: number,
    ): HeaderItem | undefined {
        const items = Object.entries(entries ?? {}).filter(
            ([name]) => name && name.trim() !== '',
        ); // Filter out empty names
        if (items.length === 0) {
            return undefined;
        }
        return {
            label: `${label} (${items.length})`,
            level,
            id: HeaderExtractor.joinId([...parentIdParts, sectionId]),
            children: items.map(([name, value]) => ({
                label: formatAttributeLabel(name, value),
                level: level + 1,
                id: HeaderExtractor.joinId([...parentIdParts, itemKind, name]),
                children: [],
            })),
        };
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
