/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @n8n/community-nodes/no-restricted-imports */

import { AxiosRequestConfig, AxiosResponse } from 'axios';
import CustomAxios from './axios';

class INEhandler {
	private axios: CustomAxios;
	constructor(config?: AxiosRequestConfig) {
		this.axios = new CustomAxios(config || {});
	}
	async recursive(params: Record<string, unknown>): Promise<AxiosResponse<any, unknown>> {
		return await this.axios.post(`/ine-handler`, params);
	}
}

interface IClassifyData {
	side: { class: string };
	type: { class: string };
}

export async function extractINE(
	base64String: string,
	side: 'front' | 'back',
	creds: string,
	author: string,
) {
	const config = { headers: { 'x-author': author, [author ? 'x-api-key' : 'x-main-key']: creds } };
	const handler = new INEhandler(config);
	let image_file: unknown;
	let stage: string = 'crop';
	try {
		const cropResponse = await handler.recursive({ stage, image_b64: base64String });
		image_file = cropResponse?.data?.file;

		stage = 'classify';
		const classifyResponse = await handler.recursive({ stage, input_data: { file: image_file } });
		const classes = classifyResponse?.data as unknown as IClassifyData;
		if (!classes?.side?.class || classes.side.class !== side) {
			return {
				success: false,
				error: `Wrong side detected: Expected - ${side}. Got - ${classes?.side?.class}.`,
			};
		}

		stage = 'delimit';
		const delimitResponse = await handler.recursive({
			stage,
			input_data: {
				image_file,
				classification: {
					side: { class: classes.side.class },
					type: { class: classes.type.class },
				},
			},
		});

		stage = 'read';
		const readResponse = await handler.recursive({
			stage,
			input_data: {
				image_file,
				detections: delimitResponse.data.detections,
			},
		});

		const data = readResponse.data;
		return {
			success: true,
			items: (data ?? []).map((i: { corners: object[] }) => {
				const { corners, ...rest } = i;
				return rest;
			}),
			type: classes.type.class,
		};
	} catch (e) {
		return {
			success: false,
			error: `Error in stage: ${stage}`,
		};
	} finally {
		if (image_file) {
			handler.recursive({ stage: 'delete', input_data: { image_file } });
		}
	}
}

type IneItem = {
	class_name: string;
	text: string;
};

function calculateChecksum(input: string) {
	const weights = [7, 3, 1];
	let sum = 0;
	for (let i = 0; i < input.length; i++) {
		const digit = parseInt(input[i], 10);
		if (!isNaN(digit)) {
			sum += digit * weights[i % 3];
		}
	}
	return sum % 10;
}

function parseItems(items: IneItem[], ineType: string, validations: any) {
	const results = items;
	const type_ = ineType;
	const curp = validations?.curp?.['Nombre(s)'] ? validations.curp : {};
	const elector = validations?.elector?.valid ? validations?.elector : {};
	const hasCurp = Boolean(curp['Nombre(s)']);
	const hasElector = Boolean(validations?.elector?.valid);
	const qr_value = results.find((i: any) => i?.class_name === 'qr')?.text;

	const qr_parts = qr_value ? qr_value.split('/') : [];
	const qr_part_3 = qr_parts[3] || '';
	const qr_part_4 = qr_parts[4] || '';
	const emision_year_str = qr_part_4.slice(0, 4);
	const emision_year_num = emision_year_str ? Number(emision_year_str) : 0;

	const curpMapping: Record<string, any> = {
		curp: curp.CURP,
		nombre: curp['Nombre(s)'],
		apellido_paterno: curp['Primer apellido'],
		apellido_materno: curp['Segundo apellido'],
		nacimiento: curp['Fecha de nacimiento'],
		sexo: curp['Sexo']?.[0],
	};

	return results.map((i: IneItem) => {
		const { class_name, text: original_text } = i;

		const curpText = curpMapping[class_name];
		if (curpText !== undefined) {
			return { ...i, text: curpText || original_text || '' };
		}

		switch (class_name) {
			case 'mrz1':
				if (qr_part_3) {
					const text = `IDMEX${qr_part_3.slice(-9)}${calculateChecksum(qr_part_3.slice(-9))}<<${qr_part_3.slice(0, 13)}`;
					return { ...i, text };
				}
				break;

			case 'mrz2':
				if (qr_part_3 && hasCurp && original_text && curp['Fecha de nacimiento']) {
					const cleanText = original_text.replace(/[^A-ZÑ0-9<]/g, '');
					const [dd, mm, yyyy] = curp['Fecha de nacimiento'].split('/');
					const yymmdd = `${yyyy.slice(-2)}${mm}${dd}`;
					const emision = String(emision_year_num + 10).slice(-2) + '1231';
					const text = `${yymmdd}${calculateChecksum(yymmdd)}${curp['Sexo']?.[0]}${emision}${calculateChecksum(emision)}MEX<${qr_part_3.slice(13, 15)}<<${cleanText.slice(-7, -2)}<${cleanText.slice(-1)}`;
					return { ...i, text };
				}
				break;

			case 'mrz3':
				if (hasCurp) {
					const text =
						`${curp['Primer apellido']}<${curp['Segundo apellido']}<<${curp['Nombre(s)']}`
							.replace(/ /g, '<')
							.slice(0, 30)
							.padEnd(30, '<');
					return { ...i, text };
				}
				break;

			case 'anio':
				if (emision_year_str) {
					return { ...i, text: emision_year_str };
				}
				break;

			case 'seccion':
				if (qr_part_3) {
					return { ...i, text: qr_part_3.slice(0, 4) };
				}
				break;

			case 'vigencia':
				if (emision_year_num) {
					const text =
						type_ === 'abc' || type_ === 'def'
							? String(emision_year_num + 10)
							: `${emision_year_num}-${emision_year_num + 10}`;
					return { ...i, text };
				}
				break;

			case 'registro':
				if (hasElector && elector?.['Año de registro'] && elector?.['Número de emisión']) {
					const text = `${elector?.['Año de registro']} ${elector?.['Número de emisión'].padStart(2, '0')}`;
					return { ...i, text };
				}
				break;

			case 'elector':
				if (hasElector && elector?.['Clave de elector']) {
					const text = elector?.['Clave de elector'];
					return { ...i, text };
				}
				break;
		}

		return i;
	});
}

export async function cleanIne(
	items: IneItem[] | object,
	ineType: string,
	creds: string,
	author: string,
) {
	const config = { headers: { 'x-author': author, [author ? 'x-api-key' : 'x-main-key']: creds } };
	const handler = new INEhandler(config);

	let validateCurp: boolean = true;
	let validateQR: boolean = true;

	let originalvalidatedCURP = false;
	let originalValidatedElector = false;

	if (typeof items === 'object' && items !== null && !Array.isArray(items)) {
		originalvalidatedCURP = (items as any)?.['validatedCURP'] ?? false;
		originalValidatedElector = (items as any)?.['validatedElector'] ?? false;

		validateCurp = !originalvalidatedCURP;
		validateQR = !originalValidatedElector;

		items = Object.entries(items).map((i) => ({ class_name: i[0], text: i?.[1] ?? '' }));
	}

	const curp = ((validateCurp ? (items ?? []) : []) as IneItem[])
		.find(({ class_name: c }) => c === 'curp')
		?.text.toUpperCase()
		.replace(/[^A-ZÑ0-9]+/g, '');

	if (!curp || !/^[A-Z][AEIOU][A-Z]{2}[0-9]{6}[HM][A-Z]{2}[A-Z]{3}[A-Z0-9][0-9]$/.test(curp)) {
		validateCurp = false;
	}

	const qr = ((validateQR ? (items ?? []) : []) as IneItem[]).find(
		({ class_name: c }) => c === 'qr',
	)?.text;
	if (!qr) {
		validateQR = false;
	}

	let cic: string | null = null;
	let idCiudadano: string | null = null;
	let ine_type: number | null = null;

	if (qr) {
		try {
			const parts = qr.split('/');
			const anio_emision = Number(parts[4].slice(0, 4));
			const mes_emision = Number(parts[4].slice(4, 6));
			const key = parts[3];

			if (anio_emision === 2013 || (anio_emision === 2014 && mes_emision < 7)) {
				ine_type = 1;
				cic = key.slice(-9);
				idCiudadano = key.slice(0, 12);
			} else if (anio_emision >= 2014) {
				ine_type = 0;
				cic = key.slice(-9);
				idCiudadano = key.slice(4, 13);
			}
		} catch (e) {
			console.error('Error parsing QR string:', e.message);
			validateQR = false;
		}
	}

	let validatedCURP: boolean = originalvalidatedCURP;
	let validatedElector: boolean = originalValidatedElector;

	if (validateCurp || validateQR) {
		const validationPayload = {
			stage: 'validate',
			input_data: {
				curp,
				ine_type,
				cic,
				idCiudadano,
			},
		};
		const validationResponse = await handler.recursive(validationPayload);
		const validations = validationResponse.data;
		if (validateCurp) {
			validatedCURP = validations?.curp?.['Nombre(s)'] ? true : false;
		}
		if (validateQR) {
			validatedElector = validations?.elector?.valid ?? false;
		}
		items = parseItems(items as IneItem[], ineType, validations);
	}

	items = {
		...Object.fromEntries((items as IneItem[]).map((i: IneItem) => [i.class_name, i.text])),
		validatedCURP,
		validatedElector,
		ineType,
	};

	return items;
}
