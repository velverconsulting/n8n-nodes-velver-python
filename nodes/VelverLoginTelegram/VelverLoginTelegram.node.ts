/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	IWebhookFunctions,
	IWebhookResponseData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { VelverDatabaseManager, VelverCredentials } from './utils/VelverDatabaseManager.utils';
import queries from './utils/query.dict.json';
import { renderApp } from './utils/login.app';
interface IToolNodeDescription extends INodeTypeDescription {
	usableAsTool?: boolean;
}

export class VelverLoginTelegram implements INodeType {
	private static dbManager: VelverDatabaseManager | null = null;
	private static credentialFingerprint: string | null = null;

	description: IToolNodeDescription = {
		displayName: 'Velver Telegram Login Flow',
		name: 'velverLoginTelegram',
		icon: 'file:VelverLoginTelegram.icon.svg',
		group: ['trigger'],
		version: 1,
		description: 'Full lifecycle auth for Telegram Mini Apps',
		usableAsTool: true,
		defaults: { name: 'Telegram Login Flow' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'velverSqlApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'GET',
				responseMode: 'onReceived',
				path: '={{$parameter["path"]}}',
			},
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: '={{$parameter["path"]}}',
			},
		],
		properties: [
			{
				displayName: 'Webhook Path',
				name: 'path',
				type: 'string',
				default: 'telegram-login',
				required: true,
			},
			{
				displayName: 'Business Name',
				name: 'businessName',
				type: 'string',
				default: 'Velver Consulting',
			},
			{
				displayName: 'Logo URL',
				name: 'logoUrl',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Default Language',
				name: 'language',
				type: 'options',
				options: [
					{ name: 'Español', value: 'es' },
					{ name: 'English', value: 'en' },
				],
				default: 'es',
			},
			{
				displayName: 'Telegram Bot Token',
				name: 'telegramToken',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
			},
		],
	};

	/**
	 * 2. Método estático para que no dependa del 'this' del webhook
	 */
	private static async getDbManager(context: IWebhookFunctions): Promise<VelverDatabaseManager> {
		const credentials = (await context.getCredentials(
			'velverSqlApi',
		)) as unknown as VelverCredentials;

		const fingerprint = JSON.stringify([
			credentials.host,
			credentials.database,
			credentials.user,
			credentials.port,
			credentials.dbType,
			credentials.useSsh,
		]);

		if (!this.dbManager || this.credentialFingerprint !== fingerprint) {
			if (this.dbManager) await this.dbManager.close();
			this.dbManager = new VelverDatabaseManager(credentials);
			this.credentialFingerprint = fingerprint;
		}

		return this.dbManager;
	}

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const webhookUrl = this.getNodeWebhookUrl('default') as string;
		const req = this.getRequestObject();
		const method = req.method.toUpperCase();
		const res = this.getResponseObject();

		const businessName = this.getNodeParameter('businessName') as string;
		const logoUrl = this.getNodeParameter('logoUrl') as string;
		const lang = this.getNodeParameter('language') as string;

		try {
			// 3. Llamamos al método estático usando el nombre de la Clase

			if (method === 'GET') {
				res.status(200).contentType('text/html');
				return {
					webhookResponse: renderApp(webhookUrl, lang, businessName, logoUrl),
				};
			}

			if (method === 'POST') {
				const db = await VelverLoginTelegram.getDbManager(this);
				const body = this.getBodyData();
				const action = String(body.action || '');
				const { chat_id, user, new_password } = body;
				let params: Record<string, unknown> = {};

				switch (action) {
					case 'init':
						params = { chat_id };
						break;
					case 'check_user':
						params = { user };
						break;
					case 'new_password':
						params = { new_password, user };
						break;
					case 'login':
						params = { user, new_password };
						break;
					case 'logout_confirm':
						params = { chat_id };
						break;
					default:
						params = {};
				}
				const motorQueries = (queries as any)[db.motor];

				if (!motorQueries || !motorQueries[action]) {
					throw new NodeOperationError(
						this.getNode(),
						`No se encontró el query para la acción "${action}" en el motor "${db.motor}"`,
					);
				}
				const sql = motorQueries[action];
				const result = await db.executeQuery(sql, params);

				res.status(200).contentType('application/json');
				return {
					webhookResponse: {
						status: 'success',
						action,
						data: result,
					},
				};
			}
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error as Error);
		}

		res.status(405).send();
		return { webhookResponse: 405 };
	}
}
