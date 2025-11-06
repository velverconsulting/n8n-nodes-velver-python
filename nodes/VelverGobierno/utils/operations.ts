/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import CustomAxios from './axios';
import { getFileType } from './filetype';
import { extractINE, cleanIne } from './ineHandler';

// Mapeo de procesos para operaciones simples
const processMap = {
	curp: { endpoint: 'get-curp', method: 'GET', paramName: 'curp' },
	rfc: { endpoint: 'validateRFC', method: 'GET', paramName: 'rfc' },
	invoice: { endpoint: 'invoice', method: 'POST', paramName: 'files' },
	csf: { endpoint: 'sat-csf', method: 'POST', paramName: 'files' },
};

/**
 * Maneja validaciones simples basadas en un valor (CURP, RFC)
 */
export async function handleValueValidation(
	axios: CustomAxios,
	type: 'curp' | 'rfc',
	value: string,
) {
	const method = processMap[type];
	const body = { [method.paramName]: value };
	return await axios.get(`/${method.endpoint}`, body);
}

/**
 * Maneja validaciones basadas en archivos (Invoice, CSF)
 */
export async function handleFileValidation(
	context: IExecuteFunctions,
	itemIndex: number,
	axios: CustomAxios,
	type: 'invoice' | 'csf',
	base64: string,
	mimeType: string,
) {
	const fileType = await getFileType(base64, mimeType);
	if (
		!fileType ||
		!['image/png', 'application/pdf', 'application/xml', 'text/xml', 'image/jpeg'].includes(
			fileType.mime,
		)
	) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid file type. Only pdf, jpg, png or xml allowed. Detected: ${fileType?.mime}`,
			{ itemIndex },
		);
	}

	const valValue = [
		{
			content: base64,
			filename: `file.${fileType.ext}`,
			mimetype: fileType.mime,
		},
	];

	const method = processMap[type];
	const body = { [method.paramName]: valValue };
	return await axios.post(`/${method.endpoint}`, body);
}

/**
 * Maneja la validación multi-paso de INE
 */
export async function handleIneValidation(
	context: IExecuteFunctions,
	itemIndex: number,
	apiKey: string,
	author: string,
) {
	const ineStage = context.getNodeParameter('ineStage', itemIndex, 'start') as
		| 'start'
		| 'revalidate';

	if (ineStage === 'start') {
		const ineFront = context.getNodeParameter('ineFront', itemIndex, '') as string;
		const ineBack = context.getNodeParameter('ineBack', itemIndex, '') as string;

		if (!ineFront && !ineBack) {
			throw new NodeOperationError(
				context.getNode(),
				'INE Front and/or Back base64 are required for stage "start"',
				{ itemIndex },
			);
		}

		let frontResult = {};
		let backResult = {};

		if (ineFront) {
			frontResult = await extractINE(ineFront, 'front', apiKey, author);
			const frontError = (frontResult as any)?.error;
			if (frontError) {
				return { error: `Error in front: ${frontError.error}` };
			}
		}

		if (ineBack) {
			backResult = await extractINE(ineBack, 'back', apiKey, author);
			const backError = (frontResult as any)?.error;
			if (backError) {
				return { error: `Error in back: ${backError.error}` };
			}
		}

		const frontType = (frontResult as any)?.type;
		const backType = (backResult as any)?.type;

		if (backType && frontType && backType !== frontType) {
			return { error: `Missmatched types: Front - ${frontType} | Back - ${backType}` };
		}

		const items = [...((backResult as any)?.items ?? []), ...((frontResult as any)?.items ?? [])];
		const cleanItems = await cleanIne(items, frontType, apiKey, author);
		return cleanItems;
	} else {
		ineStage === 'revalidate';
		const prevData = context.getNodeParameter('prevData', itemIndex, '') as string;
		const prevCURP = context.getNodeParameter('prevCURP', itemIndex, '') as string;
		const newQR = context.getNodeParameter('newQR', itemIndex, '') as string;

		const new_items = JSON.parse(prevData);
		if (prevCURP && !new_items?.validatedCURP) {
			new_items['curp'] = prevCURP;
		}
		if (newQR && !new_items?.validatedElector) {
			new_items['qr'] = newQR;
		}
		const cleanItems = await cleanIne(new_items, new_items?.ineType, apiKey, author);
		return cleanItems;
	}
}
