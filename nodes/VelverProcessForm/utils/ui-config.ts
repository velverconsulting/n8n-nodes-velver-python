/**
 * Configuración del formulario con la interfaz de n8n, sin escribir JSON.
 *
 * Etapas → Secciones → Campos, igual que vc-process: cada etapa es un paso del
 * formulario, cada sección un bloque con subtítulo dentro de la etapa, y cada
 * campo vive en su sección. De aquí sale el mismo ProcessConfig y FieldConfig[]
 * que acepta el modo JSON.
 */
import { IDataObject, INodeProperties, NodeOperationError } from 'n8n-workflow';
import { FormContext, param } from './params';
import type { FieldConfig, ProcessConfig, ProcessSection, ProcessStage } from './shared';

type Context = FormContext;

/** Tipos de vc-form que funcionan sin el backend de proyecto_x. */
const FIELD_TYPES = [
	{ name: 'Archivo', value: 'file' },
	{ name: 'Calificación', value: 'rating' },
	{ name: 'Casilla (Sí/No)', value: 'toggle' },
	{ name: 'Color', value: 'color' },
	{ name: 'Contraseña', value: 'password' },
	{ name: 'Correo', value: 'email' },
	{ name: 'CURP', value: 'curp' },
	{ name: 'Deslizador', value: 'slider' },
	{ name: 'Dinero', value: 'currency' },
	{ name: 'Fecha', value: 'date' },
	{ name: 'Fecha Y Hora', value: 'datetime' },
	{ name: 'Firma', value: 'signature' },
	{ name: 'Hora', value: 'time' },
	{ name: 'Imagen', value: 'image' },
	{ name: 'INE (Foto)', value: 'ine' },
	{ name: 'Lista Con Búsqueda', value: 'combobox' },
	{ name: 'Lista Desplegable', value: 'select' },
	{ name: 'Número', value: 'number' },
	{ name: 'Opción Única (Radio)', value: 'radio' },
	{ name: 'Porcentaje', value: 'percent' },
	{ name: 'RFC', value: 'rfc' },
	{ name: 'Teléfono', value: 'tel' },
	{ name: 'Texto', value: 'text' },
	{ name: 'Texto Informativo (Markdown)', value: 'markdown' },
	{ name: 'Texto Largo', value: 'textarea' },
	{ name: 'Ubicación (Mapa)', value: 'location' },
	{ name: 'URL', value: 'url' },
];

const WITH_OPTIONS = ['select', 'combobox', 'radio'];

/** Un campo, dentro de su sección. */
const FIELD_VALUES: INodeProperties[] = [
	{
		displayName: 'Etiqueta',
		name: 'label',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'p. ej. Nombre',
	},
	{
		displayName: 'Tipo',
		name: 'type',
		type: 'options',
		options: FIELD_TYPES,
		default: 'text',
	},
	{
		displayName: 'Contenido',
		name: 'content',
		type: 'string',
		typeOptions: { rows: 6 },
		default: '',
		placeholder: '## Antes de empezar\n- Ten tu **INE** a la mano\n- Lee el [aviso](https://…)',
		displayOptions: { show: { type: ['markdown'] } },
		description:
			'Texto con formato que se muestra (encabezados, listas, tablas, negritas, ligas). Solo se lee: no es un dato y no viaja en el envío. Admite expresiones.',
	},
	{
		displayName: 'Obligatorio',
		name: 'required',
		type: 'boolean',
		default: false,
		displayOptions: { hide: { type: ['markdown'] } },
	},
	{
		displayName: 'Deshabilitado',
		name: 'disabled',
		type: 'boolean',
		default: false,
		displayOptions: { hide: { type: ['markdown'] } },
		// La interfaz del nodo está en español; la regla pide empezar con «Whether».
		// eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
		description:
			'Se ve pero no se puede editar. Con valor por defecto, ese valor se envía siempre (el servidor lo impone).',
	},
	{
		displayName: 'Oculto',
		name: 'hidden',
		type: 'boolean',
		default: false,
		displayOptions: { hide: { type: ['markdown'] } },
		// La interfaz del nodo está en español; la regla pide empezar con «Whether».
		// eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
		description:
			'No se muestra, pero su valor (por defecto o pre-rellenado) viaja en el registro y el servidor lo impone. Un campo oculto nunca es obligatorio.',
	},
	{
		displayName: 'Valor Por Defecto',
		name: 'defaultValue',
		type: 'string',
		default: '',
		displayOptions: { hide: { type: ['markdown'] } },
		description:
			'Valor con el que abre el campo. Admite expresiones. En casillas usa true/false; en selección múltiple, valores separados por coma.',
	},
	{
		displayName: 'Opciones Como',
		name: 'optionsMode',
		type: 'options',
		options: [
			{ name: 'Lista', value: 'list', description: 'Captura cada opción con la interfaz' },
			{ name: 'JSON', value: 'json', description: 'Pega un arreglo o usa una expresión' },
			{
				name: 'JSONata (Dinámicas)',
				value: 'jsonata',
				description:
					'Se recalculan en la página cuando cambian otros campos (p. ej. municipios según el estado)',
			},
		],
		default: 'list',
		displayOptions: { show: { type: WITH_OPTIONS } },
	},
	{
		displayName: 'Catálogo',
		name: 'optionsCatalog',
		type: 'json',
		default:
			'[\n  { "estado": "JAL", "clave": "GDL", "nombre": "Guadalajara" },\n  { "estado": "JAL", "clave": "ZAP", "nombre": "Zapopan" },\n  { "estado": "CMX", "clave": "COY", "nombre": "Coyoacán" }\n]',
		displayOptions: { show: { type: WITH_OPTIONS, optionsMode: ['jsonata'] } },
		description:
			'Los datos que la expresión puede usar, como $catalogo. Admite expresiones de n8n, p. ej. el catálogo que trae un nodo anterior.',
	},
	{
		displayName: 'Expresión JSONata',
		name: 'optionsExpression',
		type: 'string',
		default: '$catalogo[estado = $$.estado].{"label": nombre, "value": clave}',
		displayOptions: { show: { type: WITH_OPTIONS, optionsMode: ['jsonata'] } },
		description:
			'Se evalúa sobre los datos del formulario (cada campo por su clave; $$ es el formulario completo). Debe dar un arreglo de {label, value}, de textos u objeto {valor: texto}.',
	},
	{
		displayName: 'Opciones (JSON)',
		name: 'optionsJson',
		type: 'json',
		default:
			'[\n  { "label": "Opción 1", "value": "1" },\n  { "label": "Opción 2", "value": "2" }\n]',
		displayOptions: { show: { type: WITH_OPTIONS, optionsMode: ['json'] } },
		description:
			'Arreglo de {label, value}, arreglo de textos (["Norte", "Sur"]) u objeto {valor: texto}. Admite expresiones, p. ej. el catálogo que trae un nodo anterior.',
	},
	{
		displayName: 'Opciones',
		name: 'fieldOptions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, sortable: true },
		placeholder: 'Agregar opción',
		default: {},
		displayOptions: { show: { type: WITH_OPTIONS, optionsMode: ['list'] } },
		options: [
			{
				displayName: 'Opción',
				name: 'values',
				values: [
					{ displayName: 'Texto', name: 'label', type: 'string', default: '', required: true },
					{
						displayName: 'Valor',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Lo que llega al workflow. Vacío = el texto.',
					},
				],
			},
		],
	},
	{
		displayName: 'Selección Múltiple',
		name: 'multiple',
		type: 'boolean',
		default: false,
		displayOptions: { show: { type: ['select', 'combobox'] } },
	},
	{
		displayName: 'Más Opciones',
		name: 'extra',
		type: 'collection',
		placeholder: 'Agregar opción',
		default: {},
		options: [
			{
				displayName: 'Ancho',
				name: 'span',
				type: 'options',
				options: [
					{ name: '1 Columna', value: '1' },
					{
						name: '2 Columnas',
						value: '2',
						description: 'Con 2 columnas equivale a renglón completo; con 1 no cambia nada',
					},
					{ name: 'Renglón Completo', value: 'full' },
				],
				default: 'full',
				description:
					'Cuántas columnas del grid ocupa el campo. En celulares siempre ocupa el renglón.',
			},
			{
				displayName: 'Calcular (JSONata)',
				name: 'calculation',
				type: 'string',
				default: '',
				placeholder: '(precio - enganche) * 0.16',
				description: 'El valor del campo se calcula con esta fórmula sobre los demás campos',
			},
			{
				displayName: 'Clave',
				name: 'key',
				type: 'string',
				default: '',
				description:
					'Nombre del dato en la salida. Vacío = se genera de la etiqueta (Nombre completo → nombre_completo).',
			},
			{
				displayName: 'Formato Conocido',
				name: 'format',
				type: 'options',
				options: [
					{ name: 'Código Postal', value: 'geo_cp' },
					{ name: 'Correo', value: 'email' },
					{ name: 'CURP', value: 'curp' },
					{ name: 'RFC', value: 'rfc' },
					{ name: 'RFC Moral', value: 'rfc_moral' },
					{ name: 'RFC Persona Física', value: 'rfc_fisica' },
					{ name: 'Teléfono MX', value: 'phone_mx' },
					{ name: 'URL', value: 'url' },
				],
				default: 'email',
			},
			{
				displayName: 'Habilitar Si (JSONata)',
				name: 'enabled_if',
				type: 'string',
				default: '',
				placeholder: "nacionalidad = 'mexicana'",
			},
			{
				displayName: 'Máximo',
				name: 'max',
				type: 'number',
				default: 0,
			},
			{
				displayName: 'Mensaje Del Patrón',
				name: 'patternMessage',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Mínimo',
				name: 'min',
				type: 'number',
				default: 0,
			},
			{
				displayName: 'Mostrar Si (JSONata)',
				name: 'show_if',
				type: 'string',
				default: '',
				placeholder: "tipo = 'credito'",
			},
			{
				displayName: 'Nota',
				name: 'note',
				type: 'string',
				default: '',
				description: 'Texto de ayuda fijo bajo el campo',
			},
			{
				displayName: 'Patrón (Regex)',
				name: 'pattern',
				type: 'string',
				default: '',
				placeholder: '^[A-Z]{3}\\d{3}$',
			},
			{
				displayName: 'Placeholder',
				name: 'placeholder',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Solo Lectura',
				name: 'readonly',
				type: 'boolean',
				default: true,
			},
		],
	},
];

export const uiConfigProperties: INodeProperties[] = [
	{
		displayName: 'Título Del Formulario',
		name: 'formTitle',
		type: 'string',
		default: '',
		placeholder: 'p. ej. Alta de cliente',
	},
	{
		displayName: 'Etapas',
		name: 'stages',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, sortable: true },
		placeholder: 'Agregar etapa',
		default: {},
		description:
			'Cada etapa es un paso del formulario, con sus secciones y campos. Con una sola etapa no se muestra el stepper.',
		options: [
			{
				displayName: 'Etapa',
				name: 'values',
				values: [
					{
						displayName: 'Título',
						name: 'title',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'p. ej. Datos generales',
					},
					{
						displayName: 'Descripción',
						name: 'description',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Secciones',
						name: 'sections',
						type: 'fixedCollection',
						typeOptions: { multipleValues: true, sortable: true },
						placeholder: 'Agregar sección',
						default: {},
						description: 'Bloques de campos dentro de la etapa, cada uno con su subtítulo',
						options: [
							{
								displayName: 'Sección',
								name: 'values',
								values: [
									{
										displayName: 'Título',
										name: 'title',
										type: 'string',
										default: '',
										placeholder: 'p. ej. Contacto',
										description: 'Vacío = sin subtítulo',
									},
									{
										displayName: 'Campos',
										name: 'fields',
										type: 'fixedCollection',
										typeOptions: { multipleValues: true, sortable: true },
										placeholder: 'Agregar campo',
										default: {},
										options: [{ displayName: 'Campo', name: 'values', values: FIELD_VALUES }],
									},
								],
							},
						],
					},
				],
			},
		],
	},
];

interface UiField {
	label: string;
	type: string;
	required?: boolean;
	disabled?: boolean;
	hidden?: boolean;
	content?: string;
	defaultValue?: IDataObject[string];
	multiple?: boolean;
	optionsMode?: 'list' | 'json' | 'jsonata';
	optionsJson?: unknown;
	optionsCatalog?: unknown;
	optionsExpression?: string;
	fieldOptions?: { values?: Array<{ label: string; value?: string }> };
	extra?: IDataObject;
}

type InputOption = { label: string; value: string | number | boolean };

/**
 * Las opciones escritas como JSON (o traídas por una expresión), en la forma
 * `{label, value}` de vc-form. Acepta arreglo de objetos, arreglo de textos u
 * objeto `{valor: texto}`. `null` = no se entiende.
 */
function optionsFromJson(raw: unknown): InputOption[] | null {
	let value = raw;
	if (typeof value === 'string') {
		if (!value.trim()) return [];
		try {
			value = JSON.parse(value);
		} catch {
			return null;
		}
	}
	const text = (v: unknown) => (v === undefined || v === null ? '' : String(v));
	// El valor conserva su TIPO (1 sigue siendo número): las expresiones JSONata que
	// lo comparan (`grupo = $$.secretaria`) no igualan 1 con "1".
	const scalar = (v: unknown): InputOption['value'] | undefined =>
		typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : undefined;
	if (Array.isArray(value)) {
		const out: InputOption[] = [];
		for (const item of value) {
			if (item && typeof item === 'object') {
				const o = item as IDataObject;
				const label = text(o.label ?? o.name ?? o.text ?? o.value);
				const val = scalar(o.value) ?? scalar(o.id) ?? label;
				if (!label && text(val) === '') return null;
				out.push({ label: label || text(val), value: text(val) === '' ? label : val });
			} else if (typeof item === 'string' || typeof item === 'number') {
				out.push({ label: String(item), value: item });
			} else {
				return null;
			}
		}
		return out;
	}
	if (value && typeof value === 'object') {
		return Object.entries(value as IDataObject).map(([val, label]) => ({
			label: text(label),
			value: val,
		}));
	}
	return null;
}

interface UiSection {
	title?: string;
	fields?: { values?: UiField[] };
}

interface UiStage {
	title: string;
	description?: string;
	sections?: { values?: UiSection[] };
}

/** Nombre completo → nombre_completo (sin acentos). */
const keyFromLabel = (label: string) =>
	label
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

const NUMERIC_TYPES = ['number', 'currency', 'percent', 'slider', 'rating'];

/**
 * El valor por defecto escrito en la interfaz, al tipo del campo. Si viene de una
 * expresión ya tiene su tipo y pasa tal cual.
 */
export function coerceForField(field: FieldConfig, raw: IDataObject[string]): IDataObject[string] {
	if (typeof raw !== 'string') return raw;
	const text = raw.trim();
	if (field.type === 'toggle') return ['true', '1', 'si', 'sí'].includes(text.toLowerCase());
	if (NUMERIC_TYPES.includes(field.type as string) && text !== '' && !Number.isNaN(Number(text)))
		return Number(text);
	if (field.multiple)
		return text
			.split(',')
			.map((v) => v.trim())
			.filter(Boolean);
	return text;
}

export interface UiConfig {
	process: ProcessConfig;
	fields: FieldConfig[];
	/** Con lo que abre el formulario: los valores por defecto. */
	data: IDataObject;
	/** Lo que el servidor impone al recibir (ver `sealedFor` en shared.ts). */
	sealed: IDataObject;
	/**
	 * Claves repetidas a propósito (campos alternos separados por `show_if`):
	 * clave interna del campo → clave real del dato. vc-form guarda visibilidad,
	 * errores y opciones POR CLAVE, así que cada variante necesita la suya; al
	 * enviar se vuelven a juntar en la clave real (ver `collapseAliases`).
	 */
	aliases: Record<string, string>;
}

/** Sufijo de las claves internas de los campos alternos: `user_id__alt2`. */
export const ALIAS_SEPARATOR = '__alt';

/** Convierte lo capturado en la interfaz al mismo ProcessConfig/FieldConfig del modo JSON. */
export function configFromUi(ctx: Context): Omit<UiConfig, 'sealed'> {
	const title = (param(ctx, 'formTitle', '') || '').trim();
	const uiStages = (param<{ values?: UiStage[] }>(ctx, 'stages', {}).values || []).filter((s) =>
		s.title?.trim(),
	);
	if (!uiStages.length) {
		throw new NodeOperationError(ctx.getNode(), 'Agrega al menos una etapa en "Etapas"');
	}

	const fields: FieldConfig[] = [];
	const data: IDataObject = {};
	const seen = new Map<string, number>();
	const aliases: Record<string, string> = {};
	const stages: ProcessStage[] = [];

	for (const [stageIndex, uiStage] of uiStages.entries()) {
		const stage: ProcessStage = {
			id: `etapa_${stageIndex + 1}`,
			title: uiStage.title.trim(),
			sections: [],
		};
		if (uiStage.description?.trim())
			(stage as ProcessStage & { description?: string }).description = uiStage.description.trim();
		stages.push(stage);

		for (const [sectionIndex, uiSection] of (uiStage.sections?.values || []).entries()) {
			const uiFields = (uiSection.fields?.values || []).filter((f) => f.label?.trim());
			if (!uiFields.length) continue;
			const section: ProcessSection = {
				id: `${stage.id}_seccion_${sectionIndex + 1}`,
				title: (uiSection.title || '').trim(),
				keys: [],
			};
			stage.sections.push(section);

			for (const f of uiFields) {
				const extra = { ...(f.extra || {}) };
				const dataKey = ((extra.key as string) || '').trim() || keyFromLabel(f.label);
				delete extra.key;
				if (!dataKey)
					throw new NodeOperationError(ctx.getNode(), `El campo "${f.label}" necesita una clave`);
				// Una clave repetida es un campo ALTERNO: conserva su propia clave interna
				// y se junta con la real al enviar. Que tenga show_if se valida en readConfig.
				const occurrence = (seen.get(dataKey) ?? 0) + 1;
				seen.set(dataKey, occurrence);
				const key = occurrence === 1 ? dataKey : `${dataKey}${ALIAS_SEPARATOR}${occurrence}`;
				if (occurrence > 1) aliases[key] = dataKey;

				const field: FieldConfig = { key, label: f.label.trim(), type: f.type || 'text' };
				if (field.type === 'markdown') {
					// Solo información: su contenido y nada de valores, reglas de captura ni sellos.
					field.content = f.content || '';
				}
				if (f.required) field.required = true;
				if (WITH_OPTIONS.includes(field.type as string)) {
					if (f.optionsMode === 'json') {
						const parsed = optionsFromJson(f.optionsJson);
						if (!parsed) {
							throw new NodeOperationError(
								ctx.getNode(),
								`Las opciones JSON del campo "${f.label}" no se entienden: usa [{"label","value"}], ["a","b"] o {"valor":"texto"}`,
							);
						}
						field.options = parsed;
					} else if (f.optionsMode === 'jsonata') {
						// La evalúa la página (parche de vc-form del build) cada vez que cambia un campo.
						const expression = (f.optionsExpression || '').trim();
						if (!expression) {
							throw new NodeOperationError(
								ctx.getNode(),
								`El campo "${f.label}" necesita una expresión JSONata`,
							);
						}
						let catalog = f.optionsCatalog;
						if (typeof catalog === 'string') {
							try {
								catalog = catalog.trim() ? JSON.parse(catalog) : [];
							} catch {
								throw new NodeOperationError(
									ctx.getNode(),
									`El catálogo del campo "${f.label}" no es JSON válido`,
								);
							}
						}
						field.options = [];
						field.options_jsonata = expression;
						field.options_catalog = catalog as IDataObject[string];
					} else {
						field.options = (f.fieldOptions?.values || []).map((o) => ({
							label: o.label,
							value: o.value || o.label,
						}));
					}
					if (f.multiple) field.multiple = true;
				}
				for (const [name, value] of Object.entries(extra)) {
					if (value !== '' && value !== undefined && value !== null) field[name] = value;
				}
				// Ancho en el grid (lo aplica el parche de vc-form del build): 1 es lo normal.
				if (field.span === '1') delete field.span;
				else if (field.span === '2') field.span = 2;
				if (f.disabled) field.disabled = true;
				if (f.hidden) field.hideInForm = true;
				fields.push(field);

				const hasDefault =
					f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '';
				if (hasDefault) {
					data[key] = coerceForField(field, f.defaultValue as IDataObject[string]);
				}

				section.keys!.push(key);
			}
		}

		if (!stage.sections.length) {
			throw new NodeOperationError(
				ctx.getNode(),
				`La etapa "${stage.title}" no tiene campos en sus secciones`,
			);
		}
	}

	return { process: { title: title || stages[0].title, stages }, fields, data, aliases };
}
