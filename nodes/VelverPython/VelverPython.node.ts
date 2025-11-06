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
	data: any;
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

/**
 * Clean expired prd files.
 * Async function (fire-and-forget).
 */
async function cleanupExpiredFiles(dir: string, logger: Logger): Promise<void> {
	logger.info('Running cleanup for expired PRD script files...');
	try {
		const files = await fs.readdir(dir);
		const now = Date.now();

		for (const file of files) {
			try {
				const parts = file.split('-');
				if (parts.length === 4 && parts[0] === 'script' && parts[2] === 'prd') {
					const expirationTimestamp = parseInt(parts[3].split('.')[0], 10);
					if (!isNaN(expirationTimestamp) && now > expirationTimestamp) {
						const filePath = path.join(dir, file);
						await fs.unlink(filePath);
						logger.info(`Cleaned up expired file: ${file}`);
					}
				}
			} catch (fileError) {
				logger.warn(`Error processing file ${file} for cleanup: ${fileError.message}`);
			}
		}
	} catch (error) {
		logger.warn(`Failed to run expired file cleanup: ${error.message}`);
	}
}

/**
 * Clean distinct mode file dev <--> prd
 * (Invalidate caché if mode changed)
 */
async function cleanupOldModeFiles(
	dir: string,
	fileID: string,
	currentMode: 'dev' | 'prd',
	logger: Logger,
): Promise<void> {
	const oppositeMode = currentMode === 'dev' ? 'prd' : 'dev';
	const prefixToClear = `script-${fileID}-${oppositeMode}-`;

	try {
		const files = await fs.readdir(dir);
		for (const file of files) {
			if (file.startsWith(prefixToClear)) {
				const filePath = path.join(dir, file);
				await fs.unlink(filePath);
				logger.info(`Cache invalidated, removed old mode file: ${file}`);
			}
		}
	} catch (error) {
		logger.warn(`Failed to clean up old mode files: ${error.message}`);
	}
}

// --- Node Classes ---
export class VelverPython implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Velver Consulting - Python Executor',
		name: 'velverPython',
		icon: 'file:VelverPython.icon.svg',
		group: ['transform'],
		version: 1,
		description: 'Executes a Python script with json input and output parameters.',
		defaults: {
			name: 'Velver - Python Executor',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Py File ID',
				name: 'fileID',
				type: 'string',
				default: uuidv4().replace(/-/g, ''),
				typeOptions: {
					rows: 1,
				},
				placeholder: 'Unique file ID',
				description: 'The Python script to execute',
			},
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
			{
				displayName: 'Node Mode',
				name: 'nodeMode',
				type: 'options',
				default: 'prd',
				options: [
					{
						name: 'Development',
						value: 'dev',
						description: 'Re-create the .py file on every run and delete it after',
					},
					{
						name: 'Production',
						value: 'prd',
						description: 'Cache the .py file for 24 hours',
					},
				],
				placeholder: 'Choose the node mode...',
			},
		],
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
			const fileID = this.getNodeParameter('fileID', itemIndex, '') as string;
			const pythonCode = this.getNodeParameter('pythonCode', itemIndex, '') as string;
			const rawStdinInput = this.getNodeParameter('stdinInput', itemIndex, '{}') as string;
			const nodeMode = this.getNodeParameter('nodeMode', itemIndex, 'prd') as 'dev' | 'prd';

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
				await cleanupOldModeFiles(PY_FILES_DIR, fileID, nodeMode, logger);
				const expirationTimestamp =
					nodeMode === 'prd' ? Date.now() + 24 * 60 * 60 * 1000 : Date.now();

				const tempFileName = `script-${fileID}-${nodeMode}-${expirationTimestamp}.py`;
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
				if (tempFilePath && nodeMode === 'dev') {
					try {
						await fs.unlink(tempFilePath);
						logger.info(`Dev script file cleaned up: ${tempFilePath}`);
					} catch (cleanError) {
						logger.warn(
							`Failed to clean up temporary dev file ${tempFilePath}: ${cleanError.message}`,
						);
					}
				}
			}
		}
		cleanupExpiredFiles(PY_FILES_DIR, logger);

		return [returnData];
	}
}
