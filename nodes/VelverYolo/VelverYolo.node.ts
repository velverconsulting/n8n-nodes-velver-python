/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import * as crypto from 'crypto';

/**
 * Interface for the node output data.
 */
interface IYoloResult extends IDataObject {
	modelType: string;
	dimensions: readonly number[];
	probabilities?: number[];
	rawData?: number[];
	fullDataLength?: number;
	error?: string;
}

export class VelverYolo implements INodeType {
	private static session: ort.InferenceSession | null = null;
	private static currentModelHash: string | null = null;

	description: INodeTypeDescription = {
		displayName: 'Velver Consulting - YOLO ONNX',
		name: 'velverYolo',
		icon: 'file:VelverYolo.icon.svg',
		group: ['transform'],
		version: 1,
		description: 'Inference for YOLO models (Detect, Classify, Segment)',
		defaults: { name: 'YOLO Executor' },
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Model Base64',
				name: 'modelBase64',
				type: 'string',
				default: '',
				required: true,
				description: 'The .onnx model encoded in base64',
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
				description: 'The task the model was trained for',
			},
			{
				displayName: 'Image Size (Pixels)',
				name: 'imgSize',
				type: 'number',
				default: 640,
				description: 'Width/Height used during training (e.g., 640)',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				description: 'Name of the binary property containing the image',
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
				const imgSize = this.getNodeParameter('imgSize', i) as number;
				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;

				// Cache logic based on hash
				await VelverYolo.ensureModelLoaded(modelBase64);

				const binaryData = items[i].binary;
				if (!binaryData || !binaryData[binaryPropertyName]) {
					throw new NodeOperationError(this.getNode(), 'No binary data found');
				}

				const imageBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

				// Preprocess to Float32 Tensor
				const tensor = await VelverYolo.preprocess(imageBuffer, imgSize);

				const feeds: Record<string, ort.Tensor> = {};
				const session = VelverYolo.session;

				if (!session) {
					throw new NodeOperationError(this.getNode(), 'ONNX session initialization failed');
				}

				feeds[session.inputNames[0]] = tensor;

				const output = await session.run(feeds);
				const mainOutput = output[session.outputNames[0]];

				const result: IYoloResult = {
					modelType,
					dimensions: mainOutput.dims,
				};

				if (modelType === 'classify') {
					result.probabilities = Array.from(mainOutput.data as Float32Array);
				} else {
					// Return sample data to avoid massive JSON overhead
					result.rawData = Array.from(mainOutput.data as Float32Array).slice(0, 100);
					result.fullDataLength = mainOutput.data.length;
				}

				returnData.push({
					json: result,
					pairedItem: { item: i },
				});
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				if (this.continueOnFail()) {
					const errorResult: IYoloResult = {
						modelType: 'error',
						dimensions: [],
						error: errorMessage,
					};
					returnData.push({ json: errorResult });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}

	private static async ensureModelLoaded(modelBase64: string): Promise<void> {
		const newHash = crypto.createHash('md5').update(modelBase64).digest('hex');

		if (VelverYolo.session && VelverYolo.currentModelHash === newHash) {
			return;
		}

		const modelBuffer = Buffer.from(modelBase64, 'base64');
		VelverYolo.session = await ort.InferenceSession.create(modelBuffer);
		VelverYolo.currentModelHash = newHash;
	}

	private static async preprocess(imageBuffer: Buffer, size: number): Promise<ort.Tensor> {
		const { data } = await sharp(imageBuffer)
			.resize(size, size, { fit: 'fill' })
			.raw()
			.toBuffer({ resolveWithObject: true });

		const floatData = new Float32Array(3 * size * size);

		// HWC (Height, Width, Channel) to CHW normalization
		for (let c = 0; c < 3; c++) {
			for (let i = 0; i < size * size; i++) {
				floatData[c * size * size + i] = data[i * 3 + c] / 255.0;
			}
		}

		return new ort.Tensor('float32', floatData, [1, 3, size, size]);
	}
}
