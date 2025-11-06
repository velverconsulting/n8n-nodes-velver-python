/* eslint-disable no-case-declarations */
import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';
import {
	handleValueValidation,
	handleFileValidation,
	handleIneValidation,
} from './utils/operations';
import { properties } from './utils/properties';
import axiosHandler from './utils/axios';

interface IToolNodeDescription extends INodeTypeDescription {
	usableAsTool: boolean;
}

// --- Node Classes ---
export class VelverGobierno implements INodeType {
	description: IToolNodeDescription = {
		displayName: 'Velver Consulting - Validaciones MX',
		name: 'velverGobierno',
		icon: 'file:VelverGobierno.icon.svg',
		group: ['transform'],
		version: 1,
		description: "Validates data in Mexico's databases.",
		defaults: {
			name: 'Velver Consulting - Validaciones MX',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'velverApi',
				required: true,
			},
		],
		properties,
		usableAsTool: true,
	};

	// --- Main Logic ---
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const credentials = await this.getCredentials('velverApi', itemIndex);
				const apiKey = credentials?.apiKey as string;
				if (!apiKey) {
					throw new NodeOperationError(this.getNode(), 'Invalid Velver API credentials.', {
						itemIndex,
					});
				}

				const validationType = this.getNodeParameter('validationType', itemIndex, '') as
					| 'curp'
					| 'rfc'
					| 'invoice'
					| 'csf'
					| 'ine';
				const author = this.getNodeParameter('author', itemIndex, undefined) as string;
				const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as {
					authType?: 'author' | 'admin';
				};
				const authType = additionalFields.authType ?? 'author';

				const axios = new axiosHandler({
					headers: {
						'x-author': author,
						[authType === 'author' ? 'x-api-key' : 'x-main-key']: apiKey,
					},
				});

				let responseData: { error?: string };

				switch (validationType) {
					case 'curp':
					case 'rfc':
						const valValue = this.getNodeParameter('valValue', itemIndex, '') as string;
						responseData = (await handleValueValidation(axios, validationType, valValue)).data;
						break;

					case 'invoice':
					case 'csf':
						const valBase64 = this.getNodeParameter('valBase64', itemIndex, '') as string;
						const mimeType = this.getNodeParameter('mimeType', itemIndex, undefined) as string;
						responseData = (
							await handleFileValidation(
								this,
								itemIndex,
								axios,
								validationType,
								valBase64,
								mimeType,
							)
						).data;
						break;

					case 'ine':
						responseData = await handleIneValidation(this, itemIndex, apiKey, author);
						break;

					default:
						throw new NodeOperationError(
							this.getNode(),
							`Invalid operation type: ${validationType}`,
							{ itemIndex },
						);
				}
				if (responseData.error) {
					returnData.push({ json: { success: false, error: responseData.error, itemIndex } });
				} else {
					returnData.push({ json: { success: true, data: responseData, itemIndex } });
				}
			} catch (error) {
				if (error instanceof NodeOperationError) {
					throw error;
				}

				if (error.response) {
					const { data, status } = error.response;
					const errorJson = {
						success: false,
						error: data?.error || 'Server responded with an error',
						details: data?.details,
						status: status,
						itemIndex,
					};
					throw new NodeOperationError(
						this.getNode(),
						`Request failed with status ${status}: ${errorJson.error}`,
						{ itemIndex },
					);
				} else if (error.request) {
					throw new NodeOperationError(this.getNode(), 'No response received from server', {
						itemIndex,
					});
				} else {
					throw new NodeOperationError(this.getNode(), `Request setup error: ${error.message}`, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}
}
