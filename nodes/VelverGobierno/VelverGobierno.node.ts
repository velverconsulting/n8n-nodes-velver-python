import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';
import axios from 'axios';
import { fileTypeFromBuffer } from 'file-type';
import { XMLValidator } from 'fast-xml-parser';

export async function getFileType(base64String: string) {
	let rawBase64 = base64String;
	if (base64String.startsWith('data:')) {
		const parts = base64String.split(',');
		if (parts.length < 2) {
			return null;
		}
		rawBase64 = parts[1];
	}

	let buffer;
	try {
		buffer = Buffer.from(rawBase64, 'base64');
	} catch (e) {
		return null;
	}

	const binaryType = await fileTypeFromBuffer(buffer);

	if (binaryType) {
		return binaryType;
	}
	const textData = buffer.toString('utf-8');
	const validationResult = XMLValidator.validate(textData);

	if (validationResult === true) {
		return {
			ext: 'xml',
			mime: 'application/xml',
		};
	}
	return null;
}

const BASE_API_URL = 'https://api.velver.mx';

// --- Node Classes ---
export class VelverGobierno implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Velver Consulting - Validaciones MX',
		name: 'velverValidaciones',
		icon: 'file:VelverGobierno.icon.svg',
		group: ['transform'],
		version: 1,
		description: "Validates data in Mexico's databases.",
		defaults: {
			name: 'Velver Consulting - Validaciones MX',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation Type',
				name: 'validationType',
				type: 'options',
				default: 'curp',
				options: [
					{
						name: 'CURP',
						value: 'curp',
						description: '-> RENAPO',
					},
					{
						name: 'RFC',
						value: 'rfc',
						description: '-> SAT',
					},
					{
						name: 'Factura',
						value: 'invoice',
						description: '-> SAT',
					},
					{
						name: 'Constancia de Situación Fiscal',
						value: 'csf',
						description: '-> SAT',
					},
				],
				placeholder: 'Choose the validation mode...',
			},
			{
				displayName: 'Validation Value',
				name: 'valValue',
				type: 'string',
				default: '',
				typeOptions: {
					rows: 1,
				},
				placeholder: 'Value to validate...',
				description: 'The value to validate with, if file, the raw base64',
			},
			{
				displayName: 'Author',
				name: 'author',
				type: 'string',
				default: '',
				typeOptions: {
					rows: 1,
				},
				placeholder: 'Author...',
				description: "Type de author's name provided by Velver Consulting",
			},
			{
				displayName: 'API Key',
				name: 'velverApiCredentials',
				type: 'credentials',
				default: '',
				typeOptions: {
					credentialType: 'VelverApi',
				},
				description: 'API Key de Velver Consulting',
			},
			{
				displayName: 'Auth Type',
				name: 'authType',
				type: 'options',
				default: 'author',
				options: [
					{
						name: 'Author Based',
						value: 'author',
					},
					{
						name: 'Admin Based',
						value: 'admin',
					},
				],
				placeholder: 'Auth mode...',
				description: 'Choose de authentication mode',
			},
		],
	};

	// --- Main Logic ---
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const credentials = await this.getCredentials('velverApiCredentials', itemIndex);
			if (!credentials) {
				throw new NodeOperationError(
					this.getNode(),
					'No se encontraron credenciales de Velver API.',
					{
						itemIndex,
					},
				);
			}

			const apiKey = credentials.apiKey as string;
			if (!apiKey) {
				throw new NodeOperationError(
					this.getNode(),
					"El campo 'apiKey' está vacío en tus credenciales.",
					{
						itemIndex,
					},
				);
			}

			const validationType = this.getNodeParameter('validationType', itemIndex, '') as
				| 'curp'
				| 'rfc'
				| 'invoice'
				| 'csf';
			const authType = this.getNodeParameter('authType', itemIndex, 'author') as 'author' | 'admin';

			if (!validationType) {
				throw new NodeOperationError(this.getNode(), `Invalid operation type.`, {
					itemIndex,
				});
			}

			const valValue = this.getNodeParameter('valValue', itemIndex, '') as string;
			const author = this.getNodeParameter('author', itemIndex, '') as string;

			const processMap = {
				curp: { endpoint: 'get-curp', method: 'GET', paramName: 'curp' },
				rfc: { endpoint: 'validateRFC', method: 'GET', paramName: 'rfc' },
				invoice: { endpoint: 'invoice', method: 'POST', paramName: 'files' },
				csf: { endpoint: 'sat-csf', method: 'POST', paramName: 'files' },
			};

			let usableValue = valValue as string | object;

			if (['csf', 'invoice'].includes(validationType)) {
				const fileType = await getFileType(valValue);
				if (
					!fileType ||
					!['image/png', 'application/pdf', 'application/xml', 'image/jpeg'].includes(fileType.mime)
				) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid file type. Only pdf, jpg, png or xml allowed.`,
						{
							itemIndex,
						},
					);
				}
				usableValue = [
					{
						content: valValue,
						filename: `file.${fileType.ext}`,
						mimetype: fileType.mime,
					},
				];
			}

			try {
				const method = processMap[validationType];
				if (method.method === 'GET') {
					const data = await axios.get(
						`${BASE_API_URL}/${method.endpoint}?${method.paramName}=${encodeURIComponent(valValue)}`,
						{
							headers: {
								'x-author': author,
								[authType === 'author' ? 'x-api-key' : 'x-main-key']: apiKey,
							},
						},
					);
					returnData.push({ json: { ...data, itemIndex } });
				} else {
					const data = await axios.post(
						`${BASE_API_URL}/${method.endpoint}`,
						{
							[method.paramName]: usableValue,
						},
						{
							headers: {
								'x-author': author,
								[authType === 'author' ? 'x-api-key' : 'x-main-key']: apiKey,
							},
						},
					);
					returnData.push({ json: { ...data, itemIndex } });
				}
			} catch (error) {
				if (error instanceof NodeOperationError) {
					throw error;
				}
				throw new NodeOperationError(
					this.getNode(),
					`Failed to execute Python script: ${error.message}`,
					{
						itemIndex,
					},
				);
			}
		}

		return [returnData];
	}
}
