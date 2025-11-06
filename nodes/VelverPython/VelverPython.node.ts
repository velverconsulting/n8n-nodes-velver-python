/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
	Logger,
} from 'n8n-workflow';

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// --- Root dir ---
const PY_FILES_DIR = '/home/node/.n8n/tmp-py-files';

// --- Execution result interface ---
interface PythonExecutionResult {
	success: boolean;
	data: object | null;
	error: string | null;
	logs: string | string[];
}

// --- Run Python code ---
export async function runPython(script: string, inputs: string): Promise<PythonExecutionResult> {
	return new Promise((resolve) => {
		const scriptPath = path.resolve(script);
		const pythonProcess = spawn('python3', [scriptPath]);
		let pythonOutput = '';
		let errorOutput = '';

		pythonProcess.stderr.on('data', (data: string) => {
			errorOutput += data.toString();
		});

		pythonProcess.stdout.on('data', (data: string) => {
			pythonOutput += data.toString();
		});

		pythonProcess.on('close', (code: number) => {
			if (code !== 0) {
				resolve({
					success: false,
					data: null,
					error: errorOutput || `Python process exited with code ${code}`,
					logs: pythonOutput,
				});
				return;
			}
			try {
				const jsonData = JSON.parse(
					pythonOutput
						.trim()
						.split('\n')
						.filter((line) => line.length > 0)
						.slice(-1)[0],
				);
				if (jsonData.error) {
					resolve({
						success: false,
						data: jsonData,
						error: jsonData.error,
						logs: pythonOutput
							.split('\n')
							.filter((line) => line.length > 0)
							?.slice(0, -1),
					});
				} else {
					resolve({
						success: true,
						data: jsonData,
						error: null,
						logs: pythonOutput
							.split('\n')
							.filter((line) => line.length > 0)
							?.slice(0, -1),
					});
				}
			} catch (parseError: any) {
				resolve({
					success: false,
					data: null,
					error: `Failed to parse Python output as JSON. Error: ${parseError.message}.`,
					logs: pythonOutput
						.split('\n')
						.filter((line) => line.length > 0)
						?.slice(0, -1),
				});
			}
		});

		pythonProcess.on('error', (err: any) => {
			resolve({
				success: false,
				data: null,
				error: `Failed to start Python process: ${err.message}`,
				logs: pythonOutput
					.split('\n')
					.filter((line) => line.length > 0)
					?.slice(0, -1),
			});
		});

		pythonProcess.stdin.write(inputs);
		pythonProcess.stdin.end();
	});
}

interface IToolNodeDescription extends INodeTypeDescription {
	usableAsTool: boolean;
}

async function cleanupOldFiles(logger: Logger): Promise<void> {
	logger.info(`Starting cleanup of old files in ${PY_FILES_DIR}...`);
	try {
		const files = await fs.readdir(PY_FILES_DIR);
		const now = Date.now();
		const twentyFourHours = 24 * 60 * 60 * 1000;

		for (const file of files) {
			if (!file.startsWith('script-') || !file.endsWith('.py')) {
				continue;
			}

			const filePath = path.join(PY_FILES_DIR, file);

			try {
				const stats = await fs.stat(filePath);
				const fileAge = now - stats.mtime.getTime();

				if (fileAge > twentyFourHours) {
					await fs.unlink(filePath);
					logger.info(`Cleaned up old script file: ${filePath}`);
				}
			} catch (statError: any) {
				logger.warn(`Could not stat/unlink old file ${filePath}: ${statError.message}`);
			}
		}
	} catch (readDirError: any) {
		logger.warn(`Failed to run background cleanup in ${PY_FILES_DIR}: ${readDirError.message}`);
	}
}

// --- Node Classes ---
export class VelverPython implements INodeType {
	description: IToolNodeDescription = {
		displayName: 'Velver Consulting - Python Executor',
		name: 'velverPython',
		icon: 'file:VelverPython.icon.svg',
		group: ['transform'],
		version: 1,
		description: 'Executes a Python script with json input and output parameters.',
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
				placeholder: 'print("Hello from Python!")\n# Your Python code here',
				description: 'The Python script to execute',
			},
			{
				displayName: 'Input (JSON Only)',
				name: 'stdinInput',
				type: 'string',
				default: '{}',
				typeOptions: {
					rows: 5,
				},
				placeholder: 'Input for the Python script...',
				description: 'Text to be passed to the Python script as stdin',
			},
		],
		usableAsTool: true,
	};

	// --- Main Logic ---
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const logger = this.logger;

		try {
			await fs.mkdir(PY_FILES_DIR, { recursive: true });
		} catch (dirError) {
			logger.error(`Failed to create directory ${PY_FILES_DIR}: ${dirError.message}`);
			throw new NodeOperationError(this.getNode(), `Directory error: ${dirError.message}`);
		}

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const pythonCode = this.getNodeParameter('pythonCode', itemIndex, '') as string;
			const rawStdinInput = this.getNodeParameter('stdinInput', itemIndex, '{}') as string;
			let stdinInput: object;
			let tempFilePath: string | undefined;

			try {
				stdinInput = JSON.parse(rawStdinInput);
			} catch {
				returnData.push({
					json: { success: false, data: null, error: 'Invalid JSON provided', logs: '' },
				});
				continue;
			}

			try {
				const tempFileName = `script-${uuidv4().replace(/-/g, '')}.py`;
				tempFilePath = path.join(PY_FILES_DIR, tempFileName);

				await fs.writeFile(tempFilePath, pythonCode);
				logger.info(`Script file created: ${tempFilePath}`);

				const data = await runPython(tempFilePath, JSON.stringify(stdinInput));
				returnData.push({ json: { ...data, itemIndex } });
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
			} finally {
				if (tempFilePath) {
					try {
						await fs.unlink(tempFilePath);
						cleanupOldFiles(logger);
					} catch (cleanError) {
						logger.warn(
							`Failed to clean up temporary dev file ${tempFilePath}: ${cleanError.message}`,
						);
					}
				}
			}
		}
		return [returnData];
	}
}
