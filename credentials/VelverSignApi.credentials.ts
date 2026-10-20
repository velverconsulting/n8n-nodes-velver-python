import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class VelverSignApi implements ICredentialType {
	name = 'velverSignApi';
	displayName = 'Velver Sign API';
	documentationUrl = 'https://velver.mx';

	icon: Icon = {
		light: 'file:velver_consulting2.svg',
		dark: 'file:velver_consulting.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'URL Base',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://firma.ejemplo.com/api/esign',
			description: 'URL donde está montado el router de firma, sin barra final',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			default: '',
			required: true,
			typeOptions: { password: true },
			description: 'Clave enviada en el header x-api-key',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { 'x-api-key': '={{$credentials.apiKey}}' } },
	};

	// Una solicitud inexistente responde 404 si la clave es válida y 401 si no.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/requests/credential-test',
			method: 'GET',
			skipSslCertificateValidation: false,
			ignoreHttpStatusErrors: true,
		},
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 401,
					message: 'API key inválida',
				},
			},
		],
	};
}
