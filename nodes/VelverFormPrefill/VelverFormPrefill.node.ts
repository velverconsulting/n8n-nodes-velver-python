import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { PREFILL_PARAM, sealPrefill } from '../VelverProcessForm/utils/prefill';

const UNIT_MS: Record<string, number> = {
	minutes: 60_000,
	hours: 3_600_000,
	days: 86_400_000,
};

/**
 * Genera el enlace a un Velver Process Form Trigger con algunos campos
 * pre-rellenados, cifrados en `?p=`. Un nodo por item: cada item de entrada sale
 * con su propio enlace (p. ej. un enlace por cliente).
 */
export class VelverFormPrefill implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Velver Form Prefill',
		name: 'velverFormPrefill',
		icon: 'file:VelverFormPrefill.icon.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Enlace pre-rellenado',
		description: 'Genera un enlace al formulario vc-process con campos pre-rellenados y cifrados',
		defaults: { name: 'Velver Form Prefill' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'velverFormPrefillApi', required: true }],
		properties: [
			{
				displayName:
					'Usa la MISMA credencial que el Velver Process Form Trigger, con «Permitir pre-relleno cifrado» encendido.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'URL Del Formulario',
				name: 'formUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://n8n.tu-dominio.com/form/alta-cliente',
				description: 'La URL de producción (o de prueba) del Velver Process Form Trigger',
			},
			{
				displayName: 'Campos',
				name: 'values',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Agregar campo',
				default: {},
				description: 'Clave del campo y su valor. Admiten expresiones sobre el item.',
				options: [
					{
						displayName: 'Campo',
						name: 'values',
						values: [
							{
								displayName: 'Clave',
								name: 'key',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'p. ej. nombre',
								description:
									'La clave del campo en el formulario (Nombre completo → nombre_completo)',
							},
							{
								displayName: 'Valor',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Vence',
				name: 'expires',
				type: 'boolean',
				default: false,
				// La interfaz del nodo está en español; la regla pide empezar con «Whether».
				// eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
				description: 'El enlace deja de funcionar después de un tiempo',
			},
			{
				displayName: 'Vence En',
				name: 'expiresIn',
				type: 'number',
				default: 7,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { expires: [true] } },
			},
			{
				displayName: 'Unidad',
				name: 'expiresUnit',
				type: 'options',
				options: [
					{ name: 'Minutos', value: 'minutes' },
					{ name: 'Horas', value: 'hours' },
					{ name: 'Días', value: 'days' },
				],
				default: 'days',
				displayOptions: { show: { expires: [true] } },
			},
			{
				displayName: 'Campo De Salida',
				name: 'outputField',
				type: 'string',
				default: 'prefillUrl',
				description: 'Dónde se agrega el enlace en cada item',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const { secret } = (await this.getCredentials('velverFormPrefillApi')) as { secret: string };
		if (!secret) throw new NodeOperationError(this.getNode(), 'La credencial no tiene secreto');

		const out: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			const formUrl = String(this.getNodeParameter('formUrl', i, '')).trim();
			if (!/^https?:\/\//i.test(formUrl)) {
				throw new NodeOperationError(
					this.getNode(),
					'La URL del formulario debe empezar con http:// o https://',
					{
						itemIndex: i,
					},
				);
			}

			const rows =
				(
					this.getNodeParameter('values', i, {}) as {
						values?: Array<{ key: string; value: unknown }>;
					}
				).values || [];
			const data: IDataObject = {};
			for (const row of rows)
				if (row.key?.trim()) data[row.key.trim()] = row.value as IDataObject[string];

			let expiresAt = 0;
			if (this.getNodeParameter('expires', i, false)) {
				const amount = Number(this.getNodeParameter('expiresIn', i, 7));
				const unit = this.getNodeParameter('expiresUnit', i, 'days') as string;
				expiresAt = Date.now() + amount * (UNIT_MS[unit] ?? UNIT_MS.days);
			}

			const url = new URL(formUrl);
			url.searchParams.set(PREFILL_PARAM, sealPrefill(secret, data, expiresAt));

			const outputField =
				String(this.getNodeParameter('outputField', i, 'prefillUrl')) || 'prefillUrl';
			out.push({
				json: {
					...items[i].json,
					[outputField]: url.toString(),
					...(expiresAt ? { [`${outputField}ExpiresAt`]: new Date(expiresAt).toISOString() } : {}),
				},
				pairedItem: { item: i },
			});
		}
		return [out];
	}
}
