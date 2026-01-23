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
				displayName: 'Model Base64',
				name: 'modelBase64',
				type: 'string',
				default: '',
				required: true,
				description: 'The YOLO model (.pt or .onnx) in base64 format',
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
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				description: 'Name of the binary property containing the image',
			},
			{
				displayName: 'Runner URL',
				name: 'runnerUrl',
				type: 'string',
				default: 'http://py-runner:8000/yolo',
				description: 'The URL of the Python runner YOLO endpoint',
			},
		],
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const modelBase64 = this.getNodeParameter('modelBase64', i) as string;
				const modelType = this.getNodeParameter('modelType', i) as string;
				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
				const runnerUrl = this.getNodeParameter('runnerUrl', i) as string;

				const imageBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

				const response = await axios.post(
					runnerUrl,
					{
						modelBase64,
						modelType,
						imageBuffer: imageBuffer.toString('base64'),
					},
					{
						maxContentLength: Infinity,
						maxBodyLength: Infinity,
						timeout: 120000, // 2 minutes for heavy AI tasks
					},
				);

				returnData.push({
					json: response.data,
					pairedItem: { item: i },
				});
			} catch (error: any) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: error.message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error.message);
			}
		}

		return [returnData];
	}
}
