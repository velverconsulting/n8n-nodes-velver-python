// VelverApi.credentials.ts
import { ICredentialType, INodeProperties } from 'n8n-workflow';
// eslint-disable-next-line @n8n/community-nodes/credential-test-required, n8n-nodes-base/cred-class-field-documentation-url-missing
export class VelverApi implements ICredentialType {
	name = 'velverApi';
	displayName = 'Velver Credentials API';
	icon = 'file:velver_consulting.svg';
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
