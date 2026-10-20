import {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { getEngine } from './utils/engine';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';

function hasValue(v: unknown): boolean {
	if (v === undefined || v === null) return false;
	if (typeof v === 'string') return v.trim() !== '';
	return true;
}

/** Valores tal cual, mas las rutas con punto de los objetos anidados («cliente.nombre»). */
function withDottedKeys(values: IDataObject): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	const walk = (prefix: string, value: unknown) => {
		if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
			for (const [k, v] of Object.entries(value as IDataObject)) walk(prefix ? `${prefix}.${k}` : k, v);
		}
		if (prefix && !(prefix in out) && value !== undefined && value !== null) out[prefix] = value;
	};
	for (const [k, v] of Object.entries(values)) {
		out[k] = v;
		walk(k, v);
	}
	return out;
}

function parseManualValues(raw: unknown): IDataObject {
	const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('Los valores deben ser un objeto JSON');
	}
	return parsed as IDataObject;
}

function baseName(fileName: string | undefined, fallback: string): string {
	const base = (fileName || '').replace(/\.docx$/i, '').trim();
	return base || fallback;
}

export class VelverDocument implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Velver Document',
		name: 'velverDocument',
		icon: 'file:VelverDocument.icon.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] === "listVariables" ? "Listar variables" : "Rellenar plantilla"}}',
		description: 'Rellena una plantilla Word (.docx) con variables y entrega DOCX y/o PDF',
		defaults: { name: 'Velver Document' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Operación',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Rellenar Plantilla', value: 'fill', action: 'Rellenar una plantilla' },
					{ name: 'Listar Variables', value: 'listVariables', action: 'Listar las variables de una plantilla' },
				],
				default: 'fill',
			},
			{
				displayName: 'Origen De La Plantilla',
				name: 'templateSource',
				type: 'options',
				options: [
					{ name: 'Propiedad Binaria', value: 'binary' },
					{ name: 'Base64 (Expresión)', value: 'base64' },
				],
				default: 'binary',
			},
			{
				displayName: 'Propiedad Binaria De La Plantilla',
				name: 'templateBinaryProperty',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: { show: { templateSource: ['binary'] } },
				description: 'Nombre de la propiedad binaria del item que contiene el .docx',
			},
			{
				displayName: 'Plantilla (Base64)',
				name: 'templateBase64',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { templateSource: ['base64'] } },
				description: 'El .docx en base64 (normalmente una expresión)',
			},
			{
				displayName: 'Valores',
				name: 'valuesSource',
				type: 'options',
				options: [
					{ name: 'Usar JSON Del Item', value: 'item' },
					{ name: 'JSON Manual', value: 'manual' },
				],
				default: 'item',
				displayOptions: { show: { operation: ['fill'] } },
			},
			{
				displayName: 'Valores (JSON)',
				name: 'valuesJson',
				type: 'json',
				default: '{}',
				displayOptions: { show: { operation: ['fill'], valuesSource: ['manual'] } },
				description: 'Objeto con el valor de cada variable de la plantilla',
			},
			{
				displayName: 'Formato De Salida',
				name: 'outputFormat',
				type: 'options',
				options: [
					{ name: 'DOCX', value: 'docx' },
					{ name: 'PDF', value: 'pdf' },
					{ name: 'Ambos', value: 'both' },
				],
				default: 'both',
				displayOptions: { show: { operation: ['fill'] } },
			},
			{
				displayName: 'Variables Sin Valor',
				name: 'missingPolicy',
				type: 'options',
				options: [
					{ name: 'Dejar Vacías', value: 'blank' },
					{ name: 'Fallar', value: 'fail' },
					{ name: 'Dejar El Chip', value: 'keep', description: 'Publica el nombre de la variable en su lugar' },
				],
				default: 'blank',
				displayOptions: { show: { operation: ['fill'] } },
			},
			{
				displayName: 'Opciones',
				name: 'options',
				type: 'collection',
				placeholder: 'Agregar opción',
				default: {},
				displayOptions: { show: { operation: ['fill'] } },
				options: [
					{
						displayName: 'Nombre Del Archivo',
						name: 'fileName',
						type: 'string',
						default: '',
						description: 'Sin extensión. Por omisión, el nombre de la plantilla',
					},
					{
						displayName: 'Propiedad Binaria Del DOCX',
						name: 'binaryPropertyDocx',
						type: 'string',
						default: 'data_docx',
					},
					{
						displayName: 'Propiedad Binaria Del PDF',
						name: 'binaryPropertyPdf',
						type: 'string',
						default: 'data_pdf',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const engine = await getEngine();

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const source = this.getNodeParameter('templateSource', i) as string;

				let template: Buffer;
				let templateName: string | undefined;
				if (source === 'binary') {
					const prop = this.getNodeParameter('templateBinaryProperty', i) as string;
					const bin = items[i].binary?.[prop] as IBinaryData | undefined;
					if (!bin) {
						throw new NodeOperationError(this.getNode(), `El item no tiene la propiedad binaria «${prop}»`, {
							itemIndex: i,
						});
					}
					template = await this.helpers.getBinaryDataBuffer(i, prop);
					templateName = bin.fileName;
				} else {
					const b64 = (this.getNodeParameter('templateBase64', i) as string).replace(/^data:[^,]*,/, '');
					template = Buffer.from(b64, 'base64');
				}
				if (template.length < 4 || template[0] !== 0x50 || template[1] !== 0x4b) {
					throw new NodeOperationError(this.getNode(), 'La plantilla no es un .docx válido (no es un ZIP)', {
						itemIndex: i,
					});
				}

				const chips = await engine.listChips(template);

				if (operation === 'listVariables') {
					returnData.push({
						json: { variables: chips as unknown as IDataObject[], total: chips.length },
						pairedItem: { item: i },
					});
					continue;
				}

				const valuesSource = this.getNodeParameter('valuesSource', i) as string;
				const rawValues =
					valuesSource === 'manual'
						? parseManualValues(this.getNodeParameter('valuesJson', i))
						: items[i].json;
				const values = withDottedKeys(rawValues);

				const names = chips.map((c) => c.name);
				const used = names.filter((n) => hasValue(values[n]));
				const missing = names.filter((n) => !hasValue(values[n]));
				const surplus = Object.keys(rawValues).filter(
					(k) => !names.includes(k) && !names.some((n) => n.startsWith(`${k}.`) || k.startsWith(`${n}.`)),
				);

				const policy = this.getNodeParameter('missingPolicy', i) as string;
				if (policy === 'fail' && missing.length) {
					throw new NodeOperationError(
						this.getNode(),
						`Faltan valores para: ${missing.join(', ')}`,
						{ itemIndex: i },
					);
				}

				const format = this.getNodeParameter('outputFormat', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const docxProp = (options.binaryPropertyDocx as string) || 'data_docx';
				const pdfProp = (options.binaryPropertyPdf as string) || 'data_pdf';
				const base = baseName((options.fileName as string) || templateName, 'documento');

				const docx = await engine.merge(template, values, policy !== 'keep');

				const json: IDataObject = {
					variablesUsadas: used,
					variablesSinValor: missing,
					variablesSobrantes: surplus,
				};
				const binary: Record<string, IBinaryData> = {};

				if (format === 'pdf' || format === 'both') {
					const result = await engine.renderPdf(docx);
					json.pages = result.pages;
					json.sha256 = result.sha256;
					binary[pdfProp] = await this.helpers.prepareBinaryData(
						Buffer.from(result.pdf),
						`${base}.pdf`,
						PDF_MIME,
					);
				}
				if (format === 'docx' || format === 'both') {
					binary[docxProp] = await this.helpers.prepareBinaryData(Buffer.from(docx), `${base}.docx`, DOCX_MIME);
				}

				returnData.push({ json, binary, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
