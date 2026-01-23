import {
	ICredentialType,
	INodeProperties,
	Icon, // 1. Importa el tipo Icon
} from 'n8n-workflow';

// eslint-disable-next-line @n8n/community-nodes/credential-test-required
export class VelverApi implements ICredentialType {
	name = 'velverApi';
	displayName = 'Velver Credentials API';
	documentationUrl = 'https://velver.mx';

	// 2. Define el icono como un objeto para soportar temas claro y oscuro
	icon: Icon = {
		light: 'file:velver_consulting2.svg',
		dark: 'file:velver_consulting.svg',
	};

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
