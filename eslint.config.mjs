import { config } from '@n8n/node-cli/eslint';

export default [
	...config, // Esparcimos la configuración base de n8n
	{
		rules: {
			// Aquí puedes relajar la regla si solo falla con esta librería
			'import-x/no-unresolved': ['error', { ignore: ['ssh2-promise', 'sequelize'] }],
		},
		settings: {
			'import-x/resolver': {
				node: true, // Fuerza a buscar en node_modules de forma estándar
			},
		},
	},
];
