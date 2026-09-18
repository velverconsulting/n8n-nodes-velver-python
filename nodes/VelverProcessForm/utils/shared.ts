/**
 * Lo que comparten Velver Process Form (link a mitad del workflow) y Velver
 * Process Form Trigger (inicia el workflow): los parámetros, la lectura de la
 * configuración y el webhook del formulario.
 */
import {
	IBinaryKeyData,
	IDataObject,
	INodeExecutionData,
	INodeProperties,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeOperationError,
} from 'n8n-workflow';
import { challengePayload, openRequest } from './envelope';
import { FormContext, param } from './params';
import { openPrefill, PREFILL_PARAM } from './prefill';
import { PageLanguage, PageTheme, ProcessPageConfig, renderProcessPage } from './page';
import { coerceForField, configFromUi, uiConfigProperties, UiConfig } from './ui-config';

export interface ProcessSection {
	id: string;
	title?: string;
	keys?: string[];
}

export interface ProcessStage {
	id: string;
	title?: string;
	sections: ProcessSection[];
}

export interface ProcessConfig extends IDataObject {
	title?: string;
	stages: ProcessStage[];
	presets?: IDataObject;
}

export interface FieldConfig extends IDataObject {
	key: string;
}

interface SerializedFile {
	__vcFile: true;
	fileName: string;
	mimeType: string;
	data: string;
}

type Context = FormContext;

/**
 * Parámetros del formulario, iguales en los dos nodos.
 *
 * Un solo estado: la interfaz (Etapas → Secciones → Campos) siempre está a la
 * vista y el JSON avanzado la COMPLEMENTA. No hay selector de modo porque el
 * editor de n8n descarta los parámetros que quedan ocultos: cambiar de modo
 * borraba lo capturado. La transformación a ProcessConfig/FieldConfig ocurre en
 * cada ejecución (`readConfig`).
 */
export const formProperties = (initialDataDescription: string): INodeProperties[] => [
	{
		displayName: 'Columnas',
		name: 'columns',
		type: 'options',
		// vc-process usa el mismo número en todas las secciones; vc-form pinta 1, 2 o 3
		// y en pantallas angostas siempre apila en una.
		options: [
			{ name: '1', value: 1 },
			{ name: '2', value: 2 },
			{ name: '3', value: 3 },
		],
		default: 2,
		description:
			'Campos por renglón en cada sección. En celulares siempre se apilan en una columna.',
	},
	{
		displayName: 'Al Enviar',
		name: 'onSubmit',
		type: 'options',
		options: [
			{
				name: 'Mostrar Mensaje De Término',
				value: 'submit',
				description: 'La página confirma de inmediato; el workflow sigue por su cuenta',
			},
			{
				name: 'Esperar Al Workflow (Markdown)',
				value: 'wait',
				description: 'La página espera a que termine y muestra lo que devuelva el último nodo',
			},
		],
		default: 'submit',
	},
	{
		displayName: 'Campo Del Resultado',
		name: 'resultField',
		type: 'string',
		default: 'markdown',
		displayOptions: { show: { onSubmit: ['wait'] } },
		description:
			'Propiedad del item del último nodo con el texto (markdown) que verá la persona. Sin ella, se muestra el mensaje de término.',
	},
	{
		displayName: 'Mensaje Mientras Procesa',
		name: 'waitingMessage',
		type: 'string',
		default: 'Procesando tu solicitud…',
		displayOptions: { show: { onSubmit: ['wait'] } },
	},
	...uiConfigProperties,
	{
		displayName: 'JSON Avanzado',
		name: 'advanced',
		type: 'collection',
		placeholder: 'Agregar ajuste JSON',
		default: {},
		description:
			'Complementa lo definido arriba con cualquier propiedad de vc-process / vc-form. Con Etapas vacías, el JSON completo define el formulario.',
		options: [
			{
				displayName: 'Campos (JSON)',
				name: 'fields',
				type: 'json',
				default: '{}',
				placeholder: '{ "correo": { "note": "Te enviaremos la confirmación aquí" } }',
				description:
					'Objeto por clave de campo con propiedades que se mezclan en ese campo, o un FieldConfig[] (mezcla por "key" y agrega los que no existan)',
			},
			{
				displayName: 'Datos Iniciales (JSON)',
				name: 'initialData',
				type: 'json',
				default: '{}',
				description: initialDataDescription,
			},
			{
				displayName: 'Proceso (JSON)',
				name: 'processConfig',
				type: 'json',
				default: JSON.stringify({ presets: {} }, null, 2),
				description:
					'Se mezcla sobre el proceso (title, presets…). Si trae "stages", reemplaza las etapas; con Etapas vacías arriba, es el proceso completo.',
			},
		],
	},
	{
		displayName: 'Opciones',
		name: 'options',
		type: 'collection',
		placeholder: 'Agregar opción',
		default: {},
		options: [
			{
				displayName: 'Idioma',
				name: 'language',
				type: 'options',
				options: [
					{ name: 'Español', value: 'es' },
					{ name: 'English', value: 'en' },
				],
				default: 'es',
			},
			{
				displayName: 'Mensaje Al Terminar',
				name: 'completionMessage',
				type: 'string',
				default: 'Tu información se envió correctamente.',
			},
			{
				displayName: 'Tema',
				name: 'theme',
				type: 'options',
				options: [
					{ name: 'Sistema', value: 'system' },
					{ name: 'Claro', value: 'light' },
					{ name: 'Oscuro', value: 'dark' },
				],
				default: 'system',
			},
			{
				displayName: 'Título Al Terminar',
				name: 'completionTitle',
				type: 'string',
				default: '¡Listo!',
			},
			{
				displayName: 'Título De La Página',
				name: 'pageTitle',
				type: 'string',
				default: '',
				description: 'Vacío = el título del formulario',
			},
		],
	},
];

const parseJson = <T>(ctx: Context, name: string, value: unknown): T => {
	if (typeof value !== 'string') return value as T;
	try {
		return JSON.parse(value) as T;
	} catch (error) {
		throw new NodeOperationError(
			ctx.getNode(),
			`"${name}" no es JSON válido: ${(error as Error).message}`,
		);
	}
};

const isPlainObject = (value: unknown): value is IDataObject =>
	Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isSerializedFile = (value: unknown): value is SerializedFile =>
	isPlainObject(value) && value.__vcFile === true && typeof value.data === 'string';

/**
 * Lo que el servidor impone al recibir el envío: lo que la persona no puede
 * editar. Un campo deshabilitado u oculto conserva su valor (por defecto o de
 * pre-relleno) aunque la página mande otro; sin valor, no se acepta ninguno.
 * Los calculados (`calculation`) quedan fuera: su valor lo produce la página.
 * Los `presets` del proceso siempre mandan.
 */
export function sealedFor(
	fields: FieldConfig[],
	data: IDataObject,
	process: ProcessConfig,
	aliases: Record<string, string> = {},
): IDataObject {
	// Las claves con campos alternos no se imponen: cuál variante vale depende de
	// qué show_if se cumpla en la página.
	const aliased = new Set([...Object.keys(aliases), ...Object.values(aliases)]);
	const sealed: IDataObject = {};
	for (const field of fields) {
		if (aliased.has(field.key) || field.type === 'markdown') continue;
		if ((field.disabled || field.hideInForm) && !field.calculation)
			sealed[field.key] = data[field.key];
	}
	return Object.assign(sealed, process.presets || {});
}

/**
 * Junta los campos alternos en su clave real. La página ya manda la clave real
 * con el valor del campo visible; esto es el respaldo para un envío que traiga
 * las claves internas: gana el primer valor no vacío.
 */
export function collapseAliases(
	submitted: IDataObject,
	aliases: Record<string, string>,
): IDataObject {
	const out = { ...submitted };
	const groups = new Map<string, string[]>();
	for (const [internal, dataKey] of Object.entries(aliases)) {
		groups.set(dataKey, [...(groups.get(dataKey) || [dataKey]), internal]);
	}
	for (const [dataKey, members] of groups) {
		const filled = members.find((m) => out[m] !== undefined && out[m] !== null && out[m] !== '');
		const value = filled === undefined ? out[dataKey] : out[filled];
		for (const m of members) delete out[m];
		if (value !== undefined) out[dataKey] = value;
	}
	return out;
}

/**
 * Lee y valida la configuración, transformando el estado único del nodo: la
 * interfaz arma el ProcessConfig/FieldConfig y el JSON avanzado se mezcla encima.
 * Mejor fallar con un mensaje claro que con una página rota.
 */
export function readConfig(ctx: Context): UiConfig {
	const advanced = param<IDataObject>(ctx, 'advanced', {});
	const processJson = parseJson<IDataObject>(ctx, 'Proceso (JSON)', advanced.processConfig ?? '{}');
	const fieldsJson = parseJson<unknown>(ctx, 'Campos (JSON)', advanced.fields ?? '{}');
	const dataJson = parseJson<IDataObject>(
		ctx,
		'Datos Iniciales (JSON)',
		advanced.initialData ?? '{}',
	);
	if (!isPlainObject(processJson)) {
		throw new NodeOperationError(ctx.getNode(), '"Proceso (JSON)" debe ser un objeto');
	}
	if (!isPlainObject(dataJson)) {
		throw new NodeOperationError(ctx.getNode(), '"Datos Iniciales (JSON)" debe ser un objeto');
	}

	const hasUiStages = (param<{ values?: unknown[] }>(ctx, 'stages', {}).values || []).length > 0;
	let base: Omit<UiConfig, 'sealed'>;
	if (hasUiStages) {
		base = configFromUi(ctx);
	} else if (Array.isArray(processJson.stages) && processJson.stages.length) {
		base = { process: { stages: [] }, fields: [], data: {}, aliases: {} };
	} else {
		throw new NodeOperationError(
			ctx.getNode(),
			'Agrega al menos una etapa en "Etapas" (o un "Proceso (JSON)" con "stages")',
		);
	}

	const process = { ...base.process, ...processJson } as ProcessConfig;
	const fields = base.fields.map((f) => ({ ...f }));

	if (Array.isArray(fieldsJson)) {
		for (const patch of fieldsJson) {
			if (!isPlainObject(patch) || typeof patch.key !== 'string') {
				throw new NodeOperationError(
					ctx.getNode(),
					'"Campos (JSON)" como arreglo necesita objetos con "key"',
				);
			}
			const existing = fields.find((f) => f.key === patch.key);
			if (existing) Object.assign(existing, patch);
			else fields.push(patch as FieldConfig);
		}
	} else if (isPlainObject(fieldsJson)) {
		for (const [key, patch] of Object.entries(fieldsJson)) {
			const existing = fields.find((f) => f.key === key);
			if (!existing) {
				throw new NodeOperationError(
					ctx.getNode(),
					`"Campos (JSON)" menciona "${key}", que no es un campo`,
				);
			}
			if (!isPlainObject(patch)) {
				throw new NodeOperationError(
					ctx.getNode(),
					`"Campos (JSON)" → "${key}" debe ser un objeto`,
				);
			}
			Object.assign(existing, patch);
		}
	} else {
		throw new NodeOperationError(
			ctx.getNode(),
			'"Campos (JSON)" debe ser un objeto por clave o un arreglo',
		);
	}

	// Un campo oculto no puede exigirse: nadie lo ve para llenarlo.
	for (const field of fields) if (field.hideInForm) delete field.required;

	// Una clave repetida solo tiene sentido si show_if decide cuál campo aplica.
	const { aliases } = base;
	for (const dataKey of new Set(Object.values(aliases))) {
		const members = fields.filter((f) => f.key === dataKey || aliases[f.key] === dataKey);
		const withoutRule = members.filter((f) => !String(f.show_if || '').trim());
		if (withoutRule.length) {
			throw new NodeOperationError(
				ctx.getNode(),
				`${members.length} campos usan la clave "${dataKey}". Es válido solo si todos tienen "Mostrar Si" para que aplique uno a la vez; falta en: ${withoutRule.map((f) => f.label || f.key).join(', ')}`,
			);
		}
	}

	const data = { ...base.data, ...dataJson };
	const config: UiConfig = {
		process,
		fields,
		data,
		aliases,
		sealed: sealedFor(fields, data, process, aliases),
	};

	const known = new Set(config.fields.map((f) => f.key));
	const missing = config.process.stages
		.flatMap((stage) => stage.sections || [])
		.flatMap((section) => section.keys || [])
		.filter((key) => !known.has(key));
	if (missing.length) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Las secciones usan campos que no están en "Campos": ${[...new Set(missing)].join(', ')}`,
		);
	}
	return config;
}

type PrefilledConfig = UiConfig & { linkError?: 'invalid' | 'expired' };

/**
 * La configuración con el pre-relleno cifrado de la URL (`?p=`) mezclado, si el
 * nodo lo permite. Los valores se convierten al tipo de su campo; claves que no
 * son campos del formulario se ignoran. En un campo deshabilitado el valor queda
 * impuesto: el token solo lo puede generar quien tiene el secreto.
 */
async function readConfigWithPrefill(ctx: IWebhookFunctions): Promise<PrefilledConfig> {
	const config = readConfig(ctx);
	if (!param<boolean>(ctx, 'prefill', false)) return config;
	const token = (ctx.getQueryData() as IDataObject)[PREFILL_PARAM];
	if (typeof token !== 'string' || !token) return config;

	const { secret } = (await ctx.getCredentials('velverFormPrefillApi')) as { secret: string };
	const opened = openPrefill(secret, token);
	if (!opened.ok) return { ...config, linkError: opened.reason };

	const data = { ...config.data };
	for (const [key, raw] of Object.entries(opened.data)) {
		// La clave del token llena el campo y todos sus alternos.
		for (const field of config.fields) {
			if (field.key === key || config.aliases[field.key] === key) {
				data[field.key] = coerceForField(field, raw);
			}
		}
	}
	// Deshabilitados y ocultos quedan impuestos con el valor del token; los presets mandan.
	return {
		...config,
		data,
		sealed: sealedFor(config.fields, data, config.process, config.aliases),
	};
}

async function pageConfig(ctx: IWebhookFunctions): Promise<ProcessPageConfig> {
	const { process, fields, data, aliases, linkError } = await readConfigWithPrefill(ctx);
	const options = param<IDataObject>(ctx, 'options', {});
	return {
		linkError,
		pageTitle: (options.pageTitle as string) || process.title || 'Formulario',
		language: (options.language as PageLanguage) || 'es',
		theme: (options.theme as PageTheme) || 'system',
		columns: Number(param(ctx, 'columns', 2)) || 2,
		completionTitle: (options.completionTitle as string) ?? '¡Listo!',
		completionMessage:
			(options.completionMessage as string) ?? 'Tu información se envió correctamente.',
		onSubmit: param<string>(ctx, 'onSubmit', 'submit') === 'wait' ? 'wait' : 'submit',
		resultField: param<string>(ctx, 'resultField', 'markdown') || 'markdown',
		waitingMessage: param<string>(ctx, 'waitingMessage', 'Procesando tu solicitud…'),
		process,
		fields,
		data,
		aliases,
	};
}

async function itemFromSubmission(
	ctx: IWebhookFunctions,
	submitted: IDataObject,
	sealed: IDataObject,
): Promise<INodeExecutionData> {
	const json: IDataObject = {};
	const binary: IBinaryKeyData = {};
	for (const [key, value] of Object.entries(submitted)) {
		const files = Array.isArray(value) ? value : [value];
		if (!files.length || !files.every(isSerializedFile)) {
			json[key] = value;
			continue;
		}
		const described: IDataObject[] = [];
		for (const [index, file] of files.entries()) {
			const property = files.length > 1 ? `${key}_${index}` : key;
			binary[property] = await ctx.helpers.prepareBinaryData(
				Buffer.from(file.data, 'base64'),
				file.fileName,
				file.mimeType,
			);
			described.push({
				fileName: file.fileName,
				mimeType: file.mimeType,
				binaryProperty: property,
			});
		}
		json[key] = Array.isArray(value) ? described : described[0];
	}

	// Lo impuesto (campos deshabilitados con valor, o presets en JSON): un envío no lo reescribe.
	Object.assign(json, sealed);

	const item: INodeExecutionData = { json };
	if (Object.keys(binary).length) item.binary = binary;
	return item;
}

/**
 * El webhook del formulario, con el mismo contrato que el backend de proyecto_x:
 *
 *  GET                              → la página (solo el bundle, sin configuración)
 *  POST + `x-vc-challenge`          → el challenge (parámetros de la ventana vigente)
 *  POST `{content}` sellado         → `{action: 'config'}` devuelve la configuración
 *                                     sellada; `{action: 'submit', data}` entrega el
 *                                     registro al workflow
 *  cualquier otra cosa              → 400 «solicitud no válida» + `x-vc-env: renew`
 *
 * Solo `submit` produce workflowData: abrir la página, pedir el challenge o la
 * configuración no inicia ni reanuda ninguna ejecución.
 */
export async function handleFormWebhook(ctx: IWebhookFunctions): Promise<IWebhookResponseData> {
	const req = ctx.getRequestObject();
	const res = ctx.getResponseObject();
	const method = req.method.toUpperCase();

	if (method === 'GET') {
		// `?json` en la URL de PRUEBA devuelve el ProcessConfig/FieldConfig ya
		// transformado (interfaz + JSON avanzado + pre-relleno) para revisarlo o
		// copiarlo. En producción no existe: la configuración solo viaja sellada.
		if ('json' in (ctx.getQueryData() as IDataObject) && ctx.getMode() === 'manual') {
			const { process, fields, data } = await readConfigWithPrefill(ctx);
			res.status(200).set({ 'Cache-Control': 'no-store' }).json({ process, fields, data });
			return { noWebhookResponse: true };
		}
		readConfig(ctx);
		const options = param<IDataObject>(ctx, 'options', {});
		res
			.status(200)
			.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
			.send(renderProcessPage((options.language as PageLanguage) || 'es'));
		return { noWebhookResponse: true };
	}

	const headers = ctx.getHeaderData() as Record<string, string | string[] | undefined>;

	if (headers['x-vc-challenge']) {
		res.status(200).set({ 'Cache-Control': 'no-store' }).json(challengePayload());
		return { noWebhookResponse: true };
	}

	const reject = (): IWebhookResponseData => {
		res.status(400).set({ 'x-vc-env': 'renew' }).json({ error: 'solicitud no válida' });
		return { noWebhookResponse: true };
	};

	const opened = openRequest(headers, ctx.getBodyData());
	if (!opened) return reject();

	let request: IDataObject;
	try {
		request = JSON.parse(opened.plain) as IDataObject;
	} catch {
		return reject();
	}

	if (request.action === 'config') {
		res
			.status(200)
			.set({ 'Cache-Control': 'no-store' })
			.json(opened.sealResponse(await pageConfig(ctx)));
		return { noWebhookResponse: true };
	}

	if (request.action === 'submit' && isPlainObject(request.data)) {
		const { sealed, aliases, fields, linkError } = await readConfigWithPrefill(ctx);
		if (linkError) {
			res
				.status(200)
				.set({ 'Cache-Control': 'no-store' })
				.json(opened.sealResponse({ ok: false, linkError }));
			return { noWebhookResponse: true };
		}
		// Los bloques de información (type 'markdown') no son datos: no viajan.
		const submitted = collapseAliases(request.data, aliases);
		for (const field of fields) if (field.type === 'markdown') delete submitted[field.key];
		const item = await itemFromSubmission(ctx, submitted, sealed);

		// «Esperar al workflow»: no se contesta aquí — n8n responde al TERMINAR con el
		// JSON del último nodo (responseMode `lastNode`), que es lo que la página pinta.
		// Esa respuesta la arma n8n, así que va en claro; el envío sí viajó sellado.
		if (param<string>(ctx, 'onSubmit', 'submit') === 'wait') {
			return { workflowData: [[item]] };
		}

		// La respuesta sellada se manda aquí mismo: n8n no respeta `webhookResponse`
		// en un trigger (contesta con su propio cuerpo), y la página necesita abrirla.
		res
			.status(200)
			.set({ 'Cache-Control': 'no-store' })
			.json(opened.sealResponse({ ok: true }));
		return { noWebhookResponse: true, workflowData: [[item]] };
	}

	return reject();
}
