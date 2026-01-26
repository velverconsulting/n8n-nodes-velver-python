/* eslint-disable @n8n/community-nodes/no-restricted-imports */
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
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';

interface SqlResultRow {
	status?: string;
	success?: boolean | number;
	SUCCESS?: boolean | number;
	[key: string]: any;
}

export class VelverLoginTelegram implements INodeType {
	private static dbManager: VelverDatabaseManager | null = null;
	private static credentialFingerprint: string | null = null;

	description: INodeTypeDescription = {
		displayName: 'Velver Telegram Login Flow',
		name: 'velverLoginTelegram',
		icon: 'file:VelverLoginTelegram.icon.svg',
		group: ['trigger'],
		version: 1,
		description: 'Secure Telegram Mini App auth lifecycle with SHA-256',
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
				name: 'setup',
				httpMethod: 'POST',
				responseMode: 'lastNode',
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
				displayName: 'Entry/Exit Messages URL',
				name: 'main-webook',
				type: 'string',
				default: '',
				required: true,
			},
			{
				displayName: 'Business Name',
				name: 'businessName',
				type: 'string',
				default: 'Velver Consulting',
			},
			{ displayName: 'Logo URL', name: 'logoUrl', type: 'string', default: '' },
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
		],
	};

	private static hashPassword(password: string): string {
		return createHash('sha256').update(password).digest('hex');
	}

	private static async getDbManager(
		context: IWebhookFunctions,
	): Promise<{ db: VelverDatabaseManager; telegramToken?: string }> {
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

		return {
			db: this.dbManager,
			telegramToken: credentials.telegramToken,
		};
	}

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const runQuery = async (
			db: VelverDatabaseManager,
			query: string,
			params: Record<string, any>,
		): Promise<[SqlResultRow[], SqlResultRow]> => {
			const result = await db.executeQuery(query, params);
			const rows = (Array.isArray(result) ? result : [result]) as SqlResultRow[];
			const firstRow = rows[0] || ({} as SqlResultRow);
			return [rows, firstRow];
		};

		const webhookUrl = this.getNodeWebhookUrl('setup') as string;
		const req = this.getRequestObject();
		const method = req.method.toUpperCase();

		const businessName = this.getNodeParameter('businessName') as string;
		const logoUrl = this.getNodeParameter('logoUrl') as string;
		const lang = this.getNodeParameter('language') as string;
		const main_webook = this.getNodeParameter('main-webook') as string;

		try {
			// --- Interface Delivery (GET) ---
			if (method === 'GET') {
				const logoToPass = logoUrl?.trim() ? logoUrl : undefined;
				const dbConnected = true;

				const html = renderApp(webhookUrl, lang, businessName, logoToPass, dbConnected);
				const res = this.getResponseObject();

				res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(html);

				return {
					noWebhookResponse: true,
				};
			}

			// --- API Logic (POST) ---
			if (method === 'POST') {
				const { db, telegramToken } = await VelverLoginTelegram.getDbManager(this);
				const body = this.getBodyData();
				const action = String(body.action || '');
				const { chat_id, user, password } = body;

				let params: Record<string, unknown> = {};
				const rawPassword = (body.password || password || '') as string;

				switch (action) {
					case 'init':
					case 'logout':
						params = { chat_id };
						break;
					case 'check_user':
						params = { user };
						break;
					case 'new_password':
					case 'login':
						params = { user, pass_hash: VelverLoginTelegram.hashPassword(rawPassword) };
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Action "${action}" not implemented.`);
				}

				const motorQueries = (queries as any)[db.motor];
				if (!motorQueries?.[action])
					throw new NodeOperationError(this.getNode(), `Query missing: ${action} for ${db.motor}`);

				const [result, firstRow] = await runQuery(db, motorQueries[action], params);

				let message = '';
				let status = 'success';
				let token = '';
				if (action === 'init') {
					status = firstRow?.status || 'login';
				} else if (action === 'logout') {
					await fetch(main_webook, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							action: 'logout',
							chat_id: chat_id,
						}),
					});
				} else if (action === 'check_user') {
					status = firstRow?.status || 'not_found';
				} else if (action === 'login') {
					const success = firstRow?.success || firstRow?.SUCCESS;

					if (success === true || success === 1) {
						await runQuery(db, motorQueries['success_login'], { chat_id, user });
						if (telegramToken) {
							const nowInSeconds = Math.floor(Date.now() / 1000);
							const durationSeconds = 12 * 60 * 60;
							const expiresAtSeconds = nowInSeconds + durationSeconds;
							const jwt_token = jwt.sign(
								{
									user,
									chat_id,
									created_at: nowInSeconds,
									expires_at: expiresAtSeconds,
								},
								telegramToken,
								{ expiresIn: '12h' },
							);
							token = jwt_token;
						}
						await fetch(main_webook, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								action: 'auth_complete',
								chat_id: chat_id,
								token,
							}),
						});
						status = 'success';
					} else {
						status = 'invalid';
						message = 'invalid_creds';
					}
				}
				const responseBody = {
					status,
					username: firstRow?.username || firstRow?.user || '',
					chat_id,
					message,
					action,
					data: result,
				};

				return {
					webhookResponse: {
						statusCode: 200,
						headers: { 'Content-Type': 'application/json; charset=utf-8' },
						body: responseBody,
					},
					workflowData: [[{ json: responseBody }]],
				};
			}
		} catch (error: any) {
			this.logger.error(`[VelverLoginTelegram] ${error.message}`);

			const env = this.getNodeParameter('environment', 'prd') as string;

			const errorPayload = {
				status: 'error',
				message: error.message,
				...(env === 'dev' && { stack: error.stack, context: 'catch_block' }),
			};

			return {
				webhookResponse: {
					statusCode: 500,
					headers: { 'Content-Type': 'application/json; charset=utf-8' },
					body: errorPayload,
				},
				workflowData: [[{ json: errorPayload }]],
			};
		}
		return {
			webhookResponse: {
				statusCode: 405,
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: { error: 'Method Not Allowed' },
			},
			workflowData: [[{ json: { status: 405, message: 'Method Not Allowed' } }]],
		};
	}
}
