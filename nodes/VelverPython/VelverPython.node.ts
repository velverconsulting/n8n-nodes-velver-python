/* eslint-disable @n8n/community-nodes/no-restricted-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';

import axios from 'axios';

interface PythonExecutionResult {
	success: boolean;
	data: any;
	error: string | null;
	logs: string[];
}

export class VelverPython implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Velver Consulting - Python Executor',
		name: 'velverPython',
		icon: 'file:VelverPython.icon.svg',
		group: ['transform'],
		version: 1,
		description: 'Executes Python code via remote API runner',
		defaults: {
			name: 'Velver Consulting - Python Executor',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Python Code',
				name: 'pythonCode',
				type: 'string',
				default: '',
				typeOptions: {
					rows: 10,
				},
				placeholder: 'print("Hello world")',
				description: 'The Python script to execute',
			},
			{
				displayName: 'Input (JSON)',
				name: 'stdinInput',
				type: 'string',
				default: '{}',
				typeOptions: {
					rows: 5,
				},
				description: 'JSON object passed to the script',
			},
			{
				displayName: 'Runner URL',
				name: 'runnerUrl',
				type: 'string',
				default: 'http://py-runner:8000/run',
				description: 'The URL of the Python runner service',
			},
		],
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const code = this.getNodeParameter('pythonCode', itemIndex, '') as string;
			const rawInput = this.getNodeParameter('stdinInput', itemIndex, '{}') as string;
			const runnerUrl = this.getNodeParameter(
				'runnerUrl',
				itemIndex,
				'http://py-runner:8000/run',
			) as string;

			let inputObj: object;
			try {
				inputObj = JSON.parse(rawInput);
			} catch {
				returnData.push({
					json: { success: false, error: 'Invalid input JSON', itemIndex },
				});
				continue;
			}

			try {
				const response = await axios.post<PythonExecutionResult>(
					runnerUrl,
					{
						code,
						input: inputObj,
					},
					{
						timeout: 65000,
					},
				);

				returnData.push({
					json: {
						...response.data,
						itemIndex,
					},
				});
			} catch (error: any) {
				if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
					throw new NodeOperationError(
						this.getNode(),
						`Python Runner is unreachable at ${runnerUrl}.`,
						{ itemIndex },
					);
				}

				returnData.push({
					json: {
						success: false,
						error: error.response?.data?.error || error.message,
						logs: error.response?.data?.logs || [],
						itemIndex,
					},
				});
			}
		}

		return [returnData];
	}
}
