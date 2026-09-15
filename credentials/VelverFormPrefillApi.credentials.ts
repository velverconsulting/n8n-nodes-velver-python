import { ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

// El secreto solo cifra y descifra enlaces de pre-relleno entre nodos de este
// paquete; no hay un servicio externo contra el cual probarlo.
// eslint-disable-next-line @n8n/community-nodes/credential-test-required
export class VelverFormPrefillApi implements ICredentialType {
	name = 'velverFormPrefillApi';
	displayName = 'Velver Form Prefill API';
	documentationUrl = 'https://velver.mx';

	icon: Icon = {
		light: 'file:velver_consulting2.svg',
		dark: 'file:velver_consulting.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Secreto',
			name: 'secret',
			type: 'string',
			default: '',
			required: true,
			typeOptions: { password: true },
			description:
				'Clave con la que se cifran los enlaces de pre-relleno. Usa la MISMA credencial en el nodo que genera el enlace y en el formulario que lo recibe.',
		},
	];
}
