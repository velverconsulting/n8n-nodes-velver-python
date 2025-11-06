/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import { fromBuffer as fileTypeFromBuffer } from 'file-type';
import { XMLValidator } from 'fast-xml-parser';

export async function getFileType(base64String: string, mimeType?: string) {
	if (mimeType) {
		switch (mimeType.toLowerCase()) {
			case 'application/xml':
			case 'text/xml':
				return { ext: 'xml', mime: mimeType };
			case 'application/json':
				return { ext: 'json', mime: mimeType };
			case 'image/jpeg':
				return { ext: 'jpg', mime: mimeType };
			case 'image/png':
				return { ext: 'png', mime: mimeType };
			case 'application/pdf':
				return { ext: 'pdf', mime: mimeType };
			case 'application/octet-stream':
				break;
			default:
				break;
		}
	}
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
	} catch {
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
