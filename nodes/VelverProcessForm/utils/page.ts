import bundle from '../assets/vcProcess.bundle.json';

export type PageLanguage = 'es' | 'en';
export type PageTheme = 'system' | 'light' | 'dark';

/** Lo que la página recibe ya abierto del sobre (acción `config`). */
export interface ProcessPageConfig {
	/** El enlace de pre-relleno venció o no es válido: la página lo dice en vez del formulario. */
	linkError?: 'invalid' | 'expired';
	pageTitle: string;
	language: PageLanguage;
	theme: PageTheme;
	columns: number;
	completionTitle: string;
	completionMessage: string;
	process: Record<string, unknown>;
	fields: unknown[];
	data: Record<string, unknown>;
	/** Claves internas de campos alternos → clave real (ver UiConfig.aliases). */
	aliases: Record<string, string>;
	/** 'submit': confirma al recibir. 'wait': espera al workflow y pinta su markdown. */
	onSubmit: 'submit' | 'wait';
	resultField: string;
	waitingMessage: string;
}

const TEXT = {
	es: {
		loading: 'Cargando…',
		loadFailed: 'No se pudo cargar el formulario. Recarga la página.',
		linkInvalid: 'Este enlace no es válido.',
		linkExpired: 'Este enlace ya venció.',
		linkHelp: 'Pide un enlace nuevo a quien te lo envió.',
		sending: 'Enviando…',
		failed: 'No se pudo enviar el formulario. Intenta de nuevo.',
	},
	en: {
		loading: 'Loading…',
		loadFailed: 'The form could not be loaded. Please reload the page.',
		linkInvalid: 'This link is not valid.',
		linkExpired: 'This link has expired.',
		linkHelp: 'Ask whoever sent it for a new link.',
		sending: 'Sending…',
		failed: 'The form could not be sent. Please try again.',
	},
};

/** El bundle va inline: no hay otra ruta que la del propio formulario. */
const inlineModule = (js: string) => js.replace(/<\/script/gi, '<\\/script');

const baseStyles = `
	:root { color-scheme: light dark; }
	* { box-sizing: border-box; }
	/* Los tokens --vc-* los inyecta applyTheme (H S% L%); los valores de respaldo
	   solo cubren el instante antes de que llegue la configuración. */
	body {
		margin: 0;
		min-height: 100vh;
		font-family: var(--vc-font-sans, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
		background: hsl(var(--vc-bg-canvas, 240 11% 96%));
		color: hsl(var(--vc-text-main, 240 3% 12%));
	}
	main { max-width: 960px; margin: 0 auto; padding: 32px 16px; }
	.notice {
		max-width: 520px;
		margin: 15vh auto 0;
		padding: 32px;
		border-radius: var(--vc-radius-lg, 20px);
		text-align: center;
		background: hsl(var(--vc-bg-surface, 0 0% 100%));
		border: 1px solid hsl(var(--vc-border, 240 6% 90%));
	}
	.notice h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
	.notice p { margin: 0; opacity: 0.75; line-height: 1.5; }
	.status {
		position: fixed;
		left: 50%;
		bottom: 24px;
		transform: translateX(-50%);
		padding: 10px 18px;
		border-radius: 999px;
		font-size: 14px;
		background: #1d1d1f;
		color: #fff;
	}
	.status.error { background: #d70015; }
`;

/**
 * La página NO trae la configuración: solo el bundle. Al cargar pide el
 * challenge, recibe la configuración sellada con el sobre v2 y envía el registro
 * sellado igual — nada del proceso ni de lo capturado viaja como JSON legible.
 */
export function renderProcessPage(language: PageLanguage): string {
	return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>…</title>
<link rel="icon" type="image/svg+xml" href="${bundle.favicon}">
<style>${baseStyles}</style>
</head>
<body>
<main id="app"></main>
<div id="status" class="status" hidden></div>
<script type="application/json" id="vc-text">${JSON.stringify(TEXT[language])}</script>
<script type="module">${inlineModule(bundle.js)}</script>
<script type="module">
const text = JSON.parse(document.getElementById('vc-text').textContent);
const status = document.getElementById('status');
const main = document.getElementById('app');
const VPF = globalThis.VelverProcessForm;
const pageUrl = window.location.href;

// Los tokens globales (sombra de tarjeta, radios extendidos…) que la app carga con
// <link href="index.css">. Va antes de los estilos propios de la página.
const globalStyle = document.createElement('style');
globalStyle.textContent = VPF.globalStyles;
document.head.prepend(globalStyle);

const showStatus = (message, isError) => {
	status.textContent = message;
	status.classList.toggle('error', Boolean(isError));
	status.hidden = !message;
};

// El EnvelopeAgent original pide POST {baseURL}/challenge; aquí el challenge lo
// atiende la misma URL del formulario, marcado con una cabecera.
const agent = new VPF.EnvelopeAgent({
	author: 'velver-process-form',
	fetchImpl: (_url, init) =>
		fetch(pageUrl, { ...init, body: '{}', headers: { ...init.headers, 'x-vc-challenge': '1' } }),
});

/** Una acción sellada: sella el cuerpo, estampa las cabeceras rotadas, abre la respuesta. */
const call = async (payload, retried = false) => {
	const sess = await agent.session();
	if (!sess) throw new Error('challenge');
	const response = await fetch(pageUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...agent.headersFor(sess) },
		body: JSON.stringify({ content: await VPF.sealWith(sess.win, sess.key, JSON.stringify(payload)) }),
	});
	if (response.status === 400 && response.headers.get('x-vc-env') === 'renew' && !retried) {
		agent.invalidate();
		return call(payload, true);
	}
	if (!response.ok) throw new Error('HTTP ' + response.status);
	const body = await response.json();
	// Esperando al workflow, n8n contesta con el JSON del último nodo, sin sobre.
	if (!body || typeof body.content !== 'string') return body;
	return JSON.parse(await agent.openText(body.content, sess));
};

const readFile = (file) =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});

// Un File no sobrevive a JSON.stringify: viaja como base64 y el nodo lo vuelve binario.
const serialize = async (value) => {
	if (value instanceof Blob) {
		return {
			__vcFile: true,
			fileName: value.name || 'archivo',
			mimeType: value.type || 'application/octet-stream',
			data: await readFile(value),
		};
	}
	if (Array.isArray(value)) return Promise.all(value.map(serialize));
	if (value && typeof value === 'object' && value.constructor === Object) {
		const out = {};
		for (const [key, inner] of Object.entries(value)) out[key] = await serialize(inner);
		return out;
	}
	return value;
};

showStatus(text.loading);
let cfg;
try {
	cfg = await call({ action: 'config' });
} catch (error) {
	console.error('[velver-process-form]', error);
	showStatus(text.loadFailed, true);
	throw error;
}
showStatus('');

const showNotice = (title, message) => {
	main.innerHTML = '<section class="notice"><h1></h1><p></p></section>';
	main.querySelector('h1').textContent = title;
	main.querySelector('p').textContent = message;
};

/** El markdown que devolvió el workflow, con el mismo componente del formulario. */
const showMarkdown = (markdown) => {
	main.innerHTML = '<section class="notice"></section>';
	const md = document.createElement('vc-markdown');
	md.content = markdown;
	main.querySelector('.notice').appendChild(md);
};

document.title = cfg.pageTitle;
// Idioma y tema antes de crear el elemento: los componentes los leen al construirse.
VPF.configure({ lang: cfg.language, theme: cfg.theme });

const showLinkError = (kind) =>
	showNotice(kind === 'expired' ? text.linkExpired : text.linkInvalid, text.linkHelp);

// Campos alternos (misma clave, distinto show_if): vc-form los lleva con claves
// internas y aquí se juntan en la clave real con el valor del que está VISIBLE,
// evaluando show_if con el mismo JSONata y la misma regla (solo false oculta).
const collapseAliases = async (data) => {
	const aliases = cfg.aliases || {};
	const groups = {};
	for (const [internal, dataKey] of Object.entries(aliases)) {
		(groups[dataKey] = groups[dataKey] || [dataKey]).push(internal);
	}
	const out = { ...data };
	for (const [dataKey, members] of Object.entries(groups)) {
		const visible = [];
		for (const member of members) {
			const field = cfg.fields.find((f) => f.key === member);
			let shown = true;
			try {
				shown = !field?.show_if || (await VPF.jsonata(field.show_if).evaluate(data)) !== false;
			} catch (error) {
				console.error('[velver-process-form] show_if de ' + member, error);
			}
			if (shown) visible.push(member);
		}
		const filled = visible.find((m) => out[m] !== undefined && out[m] !== null && out[m] !== '');
		const value = filled === undefined ? undefined : out[filled];
		for (const m of members) delete out[m];
		if (value !== undefined) out[dataKey] = value;
	}
	return out;
};

let sending = false;
const submit = async (event) => {
	if (sending) return;
	sending = true;
	showStatus(text.sending);
	try {
		if (cfg.onSubmit === 'wait') showStatus(cfg.waitingMessage);
		const data = await serialize(await collapseAliases(event.detail?.data || {}));
		const result = await call({ action: 'submit', data });
		if (result?.linkError) {
			showStatus('');
			showLinkError(result.linkError);
			return;
		}
		// Esperando al workflow, la respuesta es el JSON del último nodo (en claro):
		// su campo de resultado se pinta como markdown.
		if (cfg.onSubmit === 'wait') {
			const markdown = result?.[cfg.resultField];
			showStatus('');
			if (typeof markdown === 'string' && markdown.trim()) showMarkdown(markdown);
			else showNotice(cfg.completionTitle, cfg.completionMessage);
			return;
		}
		if (!result?.ok) throw new Error('rechazado');
		showNotice(cfg.completionTitle, cfg.completionMessage);
		showStatus('');
	} catch (error) {
		console.error('[velver-process-form]', error);
		showStatus(text.failed, true);
		sending = false;
	}
};

if (cfg.linkError) {
	// Enlace de pre-relleno vencido o alterado: no se pinta el formulario.
	showLinkError(cfg.linkError);
} else {
	const el = document.createElement('vc-process');
	el.config = cfg.process;
	el.fields = cfg.fields;
	el.columns = cfg.columns;
	// Los presets se SELLAN: el registro nace con ellos y ninguna sección los pregunta.
	el.data = { ...cfg.data, ...(cfg.process.presets || {}) };
	el.addEventListener('save', submit);
	main.appendChild(el);
}
</script>
</body>
</html>`;
}
