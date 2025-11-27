import {
    IExecuteFunctions,
    IHttpRequestMethods,
    ILoadOptionsFunctions,
    INodeExecutionData,
    INodeListSearchItems,
    INodeListSearchResult,
    NodeConnectionTypes,
    NodeOperationError,
    sleep,
    type INodeType,
    type INodeTypeDescription } from 'n8n-workflow';
import { workspaceDescription } from './resources/workspace';
import { datasetsDescription } from './resources/datasets';
import { jobsDescription } from './resources/jobs';

const SUBWORKFLOWAI_API_BASE_URL = 'https://api.subworkflow.ai/v1';
const CREDENTIAL_NAME = 'subworkflowAIApi';

export class SubworkflowAI implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'SubworkflowAI',
        name: 'subworkflowAi',
        icon: { light: 'file:../../icons/subworkflow-ai.svg', dark: 'file:../../icons/subworkflow-ai.dark.svg' },
        group: ['output'],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: 'Document Processing with SubworkflowAI API',
        defaults: {
            name: 'SubworkflowAI',
        },
        usableAsTool: true,
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        credentials: [
            {
                name: CREDENTIAL_NAME,
                required: true
            }
        ],
        properties: [
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                options: [
                    { name: 'Workspace', value: 'workspace' },
                    { name: 'Dataset', value: 'datasets' },
                    { name: 'Job', value: 'jobs' },
                ],
                default: 'workspace',
            },
            ...workspaceDescription,
            ...datasetsDescription,
            ...jobsDescription
        ]
    };

    methods = {
        listSearch: {
            async getDatasets(
                this: ILoadOptionsFunctions,
            ): Promise<INodeListSearchResult> {            
                 let responseData: {
                    success: boolean;
                    total: number;
                    data: { id: string; fileName: string; fileExt: string }[]
                } = {
                    success: false,
                    total: 0,
                    data: []
                };

                responseData = await this.helpers.httpRequestWithAuthentication.call(
                    this,
                    CREDENTIAL_NAME,
                    {
                        url: `${SUBWORKFLOWAI_API_BASE_URL}/datasets`,
                        qs: { offset: 0, limit: 6, sort: '-created', expiresInSeconds: 0 },
                    }
                );
            
                const results: INodeListSearchItems[] = responseData.data.map((item) => ({
                    name: `${item.fileName}.${item.fileExt}`,
                    value: item.id,
                    url: `https://api.subworkflow.ai/v1/datasets/${item.id}`
                }));
            
                return { results }
            },
            async getJobs(
                this: ILoadOptionsFunctions,
            ): Promise<INodeListSearchResult> {
                let responseData: {
                    success: boolean;
                    total: number;
                    data: { id: string; type: string; status: string }[]
                } = {
                    success: false,
                    total: 0,
                    data: []
                };

                responseData = await this.helpers.httpRequestWithAuthentication.call(
                    this,
                    CREDENTIAL_NAME,
                    {
                        url: `${SUBWORKFLOWAI_API_BASE_URL}/jobs`,
                        method: 'GET',
                        qs: { offset: 0, limit: 10 },
                    }
                );

                const results: INodeListSearchItems[] = responseData.data.map((item) => ({
                    name: `${item.id} - ${item.type} (${item.status})`,
                    value: item.id,
                    url: `https://api.subworkflow.ai/v1/jobs/${item.id}`
                }));

                return { results };
            }
        },
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            const resource = this.getNodeParameter('resource', itemIndex) as string;
			const operation = this.getNodeParameter('operation', itemIndex) as string;

            const request = await requestHandler(
                this,
                resource,
                operation,
                items[itemIndex],
                itemIndex
            );

            const requestOpts = {
                url: request.url,
                method: request.method as IHttpRequestMethods,
                qs: request.qs,
                body: request.body,
                json: request.json
            }

            let data = [];

            if (request.returnAll) {
                const moreData = await fetchAll(this,requestOpts as { url: string; qs: { offset: number; limit: number} },[]);
                data.push(...moreData);
            } else {
                const res = await this.helpers.httpRequestWithAuthentication.call(
                    this,
                    CREDENTIAL_NAME,
                    requestOpts
                );
                data.push(...(Array.isArray(res.data) ? res.data : [res.data]));
            }

            if (request.waitForCompletion) {
                const job = data[0];
                const isValidJob = job && job.id && job.id?.startsWith('dsj_');

                if (isValidJob) {
                    const end = (new Date()).getTime() + ((request.pollTimeout ? Number(request.pollTimeout) : 600) * 1000);

                    while(Date.now() < end) {
                        await sleep(1000);
                        const jobResponse = await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_NAME, {
                            url: `${SUBWORKFLOWAI_API_BASE_URL}/jobs/${job.id}`,
                            method: 'GET',
                            json: true
                        });
                        if (!jobResponse.success) break;
                        if (jobResponse.data?.status && (
                            jobResponse.data.status === 'SUCCESS'
                            || jobResponse.data.status === 'ERROR')
                        ) {
                            break;
                        }
                    }
                    const datasetResponse = await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_NAME, {
                        url: `${SUBWORKFLOWAI_API_BASE_URL}/datasets/${job.datasetId}`,
                        method: 'GET',
                        json: true
                    });
                    data = [datasetResponse.data];
                }
            }

            returnData.push({
                json: { data: data.length > 1 ? data : data[0] },
                pairedItem: { item: itemIndex },
            });
        }

        return [returnData];
    }
}

const fetchAll = async (
    node: IExecuteFunctions,
    requestOpts: {
        url: string;
        qs: { offset: number; limit: number; }
    },
    data: Record<string,string|number>[] = []
) => {
    const response = await node.helpers.httpRequestWithAuthentication.call(node, CREDENTIAL_NAME, requestOpts);
    const newData = [...data,...(response?.data ?? [])];
    if (!response?.qs
        || !response.total
        || ((requestOpts.qs?.offset ?? 0) + (requestOpts.qs?.limit ?? 0) >= (response.total ?? 0))) {
        return newData;
    }
    const newRequestOpts = {
        ...requestOpts,
        qs: {
            ...requestOpts.qs,
            offset: (requestOpts.qs?.offset ?? 0) + 1,
        }
    };
    return fetchAll(node, newRequestOpts, newData);
};

const createForm = (values: {
    name: string;
    value: string | number | Buffer<ArrayBufferLike>;
    opts?: Record<string,string>
}[]) => {
    if (typeof FormData === 'undefined') {
        throw new Error('FormData is not supported in this runtime environment');
    }
    if (typeof Blob === 'undefined') {
        throw new Error('Blob is not supported in this runtime environment');
    }
    const form = new FormData();
    values.forEach(item => {
        const isAssumedBuffer = typeof item.value !== 'string' && typeof item.value !== 'number';
        if (isAssumedBuffer) {
            form.append(
                item.name,
                new Blob([item.value as Buffer<ArrayBufferLike>], { type: item.opts?.type }),
                item.opts?.filename ?? 'Untitled.bin'
            );
        } else {
            form.append(item.name, String(item.value));
        }
    });
    return form;
};

const requestHandler = async (
    node: IExecuteFunctions,
    resource: string,
    operation: string,
    item: INodeExecutionData,
    itemIndex: number,
) => {
    const options = node.getNodeParameter('options', itemIndex, {}) as Record<string,string>;
    const defaultWaitForCompletion = true;
    const defaultPollTimeout = 600;

    if (resource === 'workspace') {
        if (operation === 'extract' || operation === 'vectorize') {
            const formFields = [];
            formFields.push({ name: 'expiresInDays', value: options.expiresInDays ?? 1 });

            const propertyName = node.getNodeParameter('dataPropertyNameOrUrl',itemIndex) as string;
            const isUrl = propertyName.startsWith('http://') || propertyName.startsWith('https://');
            if (!isUrl) {
                const binaryBuffer = await node.helpers.getBinaryDataBuffer(itemIndex, propertyName);
                const binaryDetails = item.binary?.[propertyName];
                formFields.push({
                    name: 'file',
                    value: binaryBuffer,
                    opts: {
                        filename: binaryDetails?.fileName ?? 'untitled.bin',
                        type: binaryDetails?.mimeType ?? 'application/octet-stream'
                    }});
            } else {
                formFields.push({ name: 'url', value: propertyName });
            }

            const body = createForm(formFields);

            return {
                url: `${SUBWORKFLOWAI_API_BASE_URL}/${operation}`,
                method: 'POST',
                body: body,
                json: false,
                waitForCompletion: options.waitForCompletion ?? defaultWaitForCompletion,
                pollTimeout: options.pollTimeout ?? defaultPollTimeout,
            }
        } else if (operation === 'search') {
            const query = {
                text: node.getNodeParameter('queryText',itemIndex) as string,
                image_url: node.getNodeParameter('queryImage',itemIndex) as string || undefined
            };
            const limit = node.getNodeParameter('limit',itemIndex, 5) as number;

            const datasetIds = options.datasetIds
                ?  options.datasetIds.split(',').filter(id => id.startsWith('ds_'))
                : [];

            return {
                url: `${SUBWORKFLOWAI_API_BASE_URL}/search`,
                method: 'POST',
                body: { query, limit, datasetIds },
                qs: undefined,
                json: true
            }
        }

        throw new NodeOperationError(node.getNode(), `Unknown operation ${operation}`);
    } else if (resource === 'datasets') {
        if (operation === 'getAll') {
            const limit = node.getNodeParameter('limit', itemIndex, 100);
            const returnAll = node.getNodeParameter('returnAll', itemIndex, false);
            const qs = {
                offset: options.offset ? Number(options.offset) : 0,
                limit,
                sort: options.sort ?? undefined,
                expiresInSeconds: options.expiresInSeconds ?? 1000 * 60 * 10
            };

            return {
                url: `${SUBWORKFLOWAI_API_BASE_URL}/datasets`,
                method: 'GET',
                qs: qs,
                json: true,
                returnAll,
            }
        } else if (operation === 'getItems') {
            const dataset = node.getNodeParameter('dataset',itemIndex) as { name: string; value: string };
            const row = node.getNodeParameter('row',itemIndex) as string;
            const cols = node.getNodeParameter('cols',itemIndex) as string;
            const limit = node.getNodeParameter('limit', itemIndex, 100);
            const returnAll = node.getNodeParameter('returnAll', itemIndex, false);

            const qs = {
                row,
                cols,
                offset: options.offset ? Number(options.offset) : 0,
                limit,
                sort: options.sort ?? undefined,
                expiresInSeconds: options.expiresInSeconds ?? 1000 * 60 * 10
            };

            return {
                url: `${SUBWORKFLOWAI_API_BASE_URL}/datasets/${dataset.value}/items`,
                method: 'GET',
                qs: qs,
                json: true,
                returnAll
            }
        } else if (operation === 'get') {
            const dataset = node.getNodeParameter('dataset',itemIndex) as { name: string; value: string };
            const qs = {
                expiresInSeconds: options.expiresInSeconds ?? 1000 * 60 * 10
            };

            return {
                url: `${SUBWORKFLOWAI_API_BASE_URL}/datasets/${dataset.value}`,
                method: 'GET',
                qs: qs,
                json: true
            }
        } else if (operation === 'vectorize') {
            const dataset = node.getNodeParameter('dataset',itemIndex) as { name: string; value: string };

            return {
                url: `${SUBWORKFLOWAI_API_BASE_URL}/datasets/${dataset.value}/vectorize`,
                method: 'POST',
                json: true,
                waitForCompletion: options.waitForCompletion ?? defaultWaitForCompletion,
                pollTimeout: options.pollTimeout ?? defaultPollTimeout,
            }
        }
        throw new NodeOperationError(node.getNode(), `Unknown operation ${operation}`);
    } else if (resource === 'jobs') {
        if (operation === 'getAll') {
            const limit = node.getNodeParameter('limit', itemIndex, 100);
            const returnAll = node.getNodeParameter('returnAll', itemIndex, false);
            const qs = {
                statuses: options.statuses
                    ? (options.statuses as unknown as string[]).join(',')
                    : undefined,
                offset: options.offset ? Number(options.offset) : 0,
                limit,
            };
            return {
                url: `${SUBWORKFLOWAI_API_BASE_URL}/jobs`,
                method: 'GET',
                qs: qs,
                json: true,
                returnAll
            }
        } else if (operation === 'get') {
            const job = node.getNodeParameter('job',itemIndex) as { name: string; value: string };
            return {
                url: `${SUBWORKFLOWAI_API_BASE_URL}/jobs/${job.value}`,
                method: 'GET',
                json: true
            }
        }
        throw new NodeOperationError(node.getNode(), `Unknown operation ${operation}`);
    }
    throw new NodeOperationError(node.getNode(), `Unknown Resource ${resource}`);
}
