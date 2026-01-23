import { ICredentialType, INodeProperties } from 'n8n-workflow';

// eslint-disable-next-line @n8n/community-nodes/credential-test-required
export class VelverSqlApi implements ICredentialType {
	name = 'velverSqlApi';
	displayName = 'Velver SQL API';
	documentationUrl = 'https://velver.mx';
	icon = 'file:velver_consulting.svg';

	// Vincula la credencial con el nodo principal para validación
	testedBy = ['velverLoginTelegram'];

	properties: INodeProperties[] = [
		// --- DATABASE ENGINE ---
		{
			displayName: 'Database Type',
			name: 'dbType',
			type: 'options',
			options: [
				{ name: 'MySQL', value: 'mysql' },
				{ name: 'MariaDB', value: 'mariadb' },
				{ name: 'SQL Server', value: 'mssql' },
				{ name: 'PostgreSQL', value: 'postgres' },
			],
			default: 'mysql',
			description: 'The SQL dialect and driver to use',
		},

		// --- DATABASE CONNECTION ---
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: 'localhost',
			required: true,
		},
		{
			displayName: 'Database Name',
			name: 'database',
			type: 'string',
			default: 'tx_trucks',
			required: true,
		},
		{
			displayName: 'User',
			name: 'user',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 3306,
			description: 'Default ports: MySQL/MariaDB: 3306, SQL Server: 1433, Postgres: 5432',
		},

		// --- SSL CONFIGURATION ---
		{
			displayName: 'SSL',
			name: 'ssl',
			type: 'boolean',
			default: false,
			description: 'Whether to use SSL for the connection',
		},
		{
			displayName: 'CA Certificate',
			name: 'caCertificate',
			type: 'string',
			typeOptions: { password: true, rows: 5 },
			displayOptions: { show: { ssl: [true] } },
			default: '',
			description: 'The CA certificate content (.pem)',
		},
		{
			displayName: 'Reject Unauthorized',
			name: 'rejectUnauthorized',
			type: 'boolean',
			displayOptions: { show: { ssl: [true] } },
			default: true,
			description: 'Whether to reject connections not authorized by a known CA',
		},

		// --- SSH TUNNEL CONFIGURATION ---
		{
			displayName: 'Use SSH Tunnel',
			name: 'useSsh',
			type: 'boolean',
			default: false,
		},
		{
			displayName: 'SSH Host',
			name: 'sshHost',
			type: 'string',
			displayOptions: { show: { useSsh: [true] } },
			default: '',
		},
		{
			displayName: 'SSH Port',
			name: 'sshPort',
			type: 'number',
			displayOptions: { show: { useSsh: [true] } },
			default: 22,
		},
		{
			displayName: 'SSH User',
			name: 'sshUser',
			type: 'string',
			displayOptions: { show: { useSsh: [true] } },
			default: '',
		},
		{
			displayName: 'SSH Auth Type',
			name: 'sshAuthType',
			type: 'options',
			displayOptions: { show: { useSsh: [true] } },
			options: [
				{ name: 'Password', value: 'password' },
				{ name: 'Private Key', value: 'privateKey' },
			],
			default: 'password',
		},
		{
			displayName: 'SSH Password',
			name: 'sshPassword',
			type: 'string',
			typeOptions: { password: true },
			displayOptions: {
				show: {
					useSsh: [true],
					sshAuthType: ['password'],
				},
			},
			default: '',
		},
		{
			displayName: 'SSH Private Key',
			name: 'sshPrivateKey',
			type: 'string',
			typeOptions: { password: true, rows: 5 },
			displayOptions: {
				show: {
					useSsh: [true],
					sshAuthType: ['privateKey'],
				},
			},
			default: '',
			description: 'The PEM content of your private key',
		},
	];
}
