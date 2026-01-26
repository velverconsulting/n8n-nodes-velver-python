/* eslint-disable @n8n/community-nodes/no-restricted-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import axios from 'axios';

export class VelverYolo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Velver Consulting - YOLO Ultralytics',
		name: 'velverYolo',
		icon: 'file:VelverYolo.icon.svg',
		group: ['transform'],
		version: 1,
		description: 'Inference using Ultralytics via remote API',
		defaults: { name: 'YOLO Ultralytics' },
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Model URL',
				name: 'modelUrl',
				type: 'string',
				default: '',
				required: true,
				description: 'Public URL of the YOLO model (.pt or .onnx)',
			},
			{
				displayName: 'Model Type',
				name: 'modelType',
				type: 'options',
				options: [
					{ name: 'Detection', value: 'detect' },
					{ name: 'Classification', value: 'classify' },
					{ name: 'Segmentation', value: 'segment' },
				],
				default: 'detect',
			},
			{
				displayName: 'Image Base64',
				name: 'imageBase64',
				type: 'string',
				default: '',
				required: true,
				description:
					'The Base64 string of the image. Use an expression (e.g. {{$JSON.data}}) to map it.',
			},
			{
				displayName: 'Runner URL',
				name: 'runnerUrl',
				type: 'string',
				default: 'http://py-runner:8000/yolo',
				description: 'The URL of the Python runner YOLO endpoint',
			},
			{
				displayName: 'Clear Cache',
				name: 'clearCache',
				type: 'boolean',
				default: false,
				description: 'Whether to force download the model and clear the previous cached version',
			},
		],
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const modelUrl = this.getNodeParameter('modelUrl', i) as string;
				const modelType = this.getNodeParameter('modelType', i) as string;
				const runnerUrl = this.getNodeParameter('runnerUrl', i) as string;
				// Ahora obtenemos el valor directo, ya resuelto por n8n
				const imageBase64Input = this.getNodeParameter('imageBase64', i) as string;
				const clearCache = this.getNodeParameter('clearCache', i, false) as boolean;

				if (!imageBase64Input) {
					throw new NodeOperationError(this.getNode(), 'The "Image Base64" parameter is empty.', {
						itemIndex: i,
					});
				}

				// Limpiamos el header del base64 si existe (ej: "data:image/png;base64,")
				const base64Image = imageBase64Input.replace(/^data:image\/[a-z]+;base64,/, '');

				const response = await axios.post(
					runnerUrl,
					{
						modelUrl,
						modelType,
						clearCache,
						imageBuffer: base64Image,
					},
					{
						maxContentLength: Infinity,
						maxBodyLength: Infinity,
						timeout: 300000,
					},
				);

				if (response.data && response.data.success === false) {
					throw new NodeOperationError(
						this.getNode(),
						response.data.error || 'The remote runner returned a failure status.',
						{ itemIndex: i },
					);
				}

				returnData.push({
					json: response.data,
					pairedItem: { item: i },
				});
			} catch (error: any) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { success: false, error: error.message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
