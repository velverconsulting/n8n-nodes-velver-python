import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class VelverApi implements ICredentialType {
	name = 'VelverApi';
	displayName = 'Velver API Credentials';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			default: '',
			typeOptions: {
				password: true,
			},
			description: 'Tu API Key personal proveída por Velver Consulting',
		},
	];
}
