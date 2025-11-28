import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SubworkflowAiApi implements ICredentialType {
	name = 'subworkflowAiApi';

	displayName = 'SubworkflowAI API';

	icon: Icon = { light: 'file:../icons/subworkflow-ai.svg', dark: 'file:../icons/subworkflow-ai.dark.svg' };

	documentationUrl = 'https://docs.subworkflow.ai/auth';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials?.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.subworkflow.ai/v1',
			url: '/verify',
			method: 'GET',
		},
	};
}
