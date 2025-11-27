import type { INodeProperties } from 'n8n-workflow';

const showOnlyForWorkspaceSearch = {
    operation: ['search'],
    resource: ['workspace'],
};

export const workspaceSearchDescription: INodeProperties[] = [
    {
        displayName: 'Query Text',
        name: 'queryText',
        type: 'string',
        required: true,
        displayOptions: {
            show: showOnlyForWorkspaceSearch,
        },
        default: '',
        description: 'Search query text to use for this search',
    },
    {
        displayName: 'Query Image URL (Optional)',
        name: 'queryImage',
        type: 'string',
        displayOptions: {
            show: showOnlyForWorkspaceSearch,
        },
        default: '',
        description: 'Optional image URL to use as part of the search'
    },
    {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        displayOptions: {
            show: {
                ...showOnlyForWorkspaceSearch,
                returnAll: [false],
            },
        },
        typeOptions: {
            minValue: 1,
            maxValue: 100,
        },
        default: 50,
        description: 'Max number of results to return',
    },
    {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add option',
        default: {},
        displayOptions: {
            show: showOnlyForWorkspaceSearch
        },
        options: [
            {
                displayName: 'Datasets Filter',
                name: 'datasetIds',
                type: 'string',
                default: '',
                placeholder: 'eg. ds_123456,ds_789012',
                description: 'Filter by Dataset IDs. Comma-delimited.',
            }
        ]
    }
];
