import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Motor DOCX/PDF vendoreado (ver scripts/vendor-docx.mjs). Los paquetes son ESM
 * y este proyecto compila a CommonJS: tsc convertiria un `import()` en `require`,
 * asi que el import dinamico real se construye con `new Function`.
 */
// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
	specifier: string,
) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ChipDescriptor {
	name: string;
	type?: string;
	fmt?: string;
	required?: boolean;
	def?: string;
	help?: string;
	opts?: string[];
	expr?: string;
}

export interface RenderResult {
	pdf: Uint8Array;
	pages: number;
	sha256: string;
	layoutHash: string;
}

export interface DocxEngine {
	/** Rellena la plantilla. `blank` deja vacios los chips sin valor; si no, publica su alias. */
	merge(template: Uint8Array, values: Record<string, unknown>, blank: boolean): Promise<Uint8Array>;
	/** Chips (variables) del cuerpo de la plantilla, sin repetir nombres. */
	listChips(template: Uint8Array): Promise<ChipDescriptor[]>;
	/** DOCX ya relleno -> PDF. */
	renderPdf(docx: Uint8Array, opts?: { removeHighlights?: boolean }): Promise<RenderResult>;
}

/** Carpeta vendor/docx: junto a dist/ (paquete publicado) o dentro (deploy por scp de dist/*). */
export function vendorDir(): string {
	const candidates = [
		process.env.VELVER_DOCX_VENDOR_DIR,
		resolve(__dirname, '..', '..', '..', 'vendor', 'docx'), // dist/vendor/docx
		resolve(__dirname, '..', '..', '..', '..', 'vendor', 'docx'), // <paquete>/vendor/docx
	].filter((c): c is string => !!c);
	const found = candidates.find((c) => existsSync(join(c, 'pdf', 'dist', 'index.js')));
	if (!found) {
		throw new Error(
			'No se encontro el motor DOCX vendoreado (vendor/docx). Ejecuta `pnpm vendor:docx` ' +
				`y vuelve a construir. Rutas probadas: ${candidates.join(', ')}`,
		);
	}
	return found;
}

let enginePromise: Promise<DocxEngine> | undefined;

export function getEngine(): Promise<DocxEngine> {
	if (!enginePromise) {
		enginePromise = loadEngine();
		enginePromise.catch(() => {
			enginePromise = undefined;
		});
	}
	return enginePromise;
}

async function loadEngine(): Promise<DocxEngine> {
	const dir = vendorDir();
	const url = (...p: string[]) => pathToFileURL(join(dir, ...p)).href;
	const pdf = await dynamicImport(url('pdf', 'dist', 'index.js'));
	const editor = await dynamicImport(url('editor', 'dist', 'node.js'));
	const xmldom = require('@xmldom/xmldom');
	editor.installDomParser(xmldom.DOMParser, xmldom.XMLSerializer);
	// Un solo renderer para todo el proceso: carga motor y metricas una vez.
	// Google Fonts bajo demanda: las familias que el documento pide y no hay en local se bajan una
	// vez y quedan en caché (en el volumen de n8n, para que sobrevivan al reinicio). Sin red no pasa nada.
	const renderer = pdf.createRenderer({
		metricsDir: join(dir, 'viewer', 'assets'),
		googleFonts: true,
		googleFontsDir:
			process.env.VELVER_GOOGLE_FONTS_DIR || join(homedir(), '.n8n', 'docx-pdf-google-fonts'),
	});

	// El motor solo reconoce chips (content controls). Una plantilla con texto plano
	// {{variable}} se convierte a chips en cuerpo, encabezados, pies y notas.
	const CHROME_RE = /^word\/(header|footer|footnotes|endnotes)\d*\.xml$/;
	function normalize(template: Uint8Array): Uint8Array {
		const pkg = new editor.DocxPackage(template);
		let converted = editor.importBraces(editor.mainDocument(pkg)) as number;
		for (const path of pkg.partPaths() as string[]) {
			if (!CHROME_RE.test(path)) continue;
			const d = pkg.loadXml(path);
			if (d) converted += editor.importBraces(d) as number;
		}
		return converted > 0 ? (pkg.serialize() as Uint8Array) : template;
	}

	// Quita resaltados (w:highlight y sombreado de run) solo para el PDF; el DOCX no cambia.
	const HL_RE = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
	function stripHighlights(docx: Uint8Array): Uint8Array {
		const pkg = new editor.DocxPackage(docx);
		let removed = 0;
		for (const path of pkg.partPaths() as string[]) {
			if (!HL_RE.test(path)) continue;
			const d = pkg.loadXml(path);
			if (!d) continue;
			const rprs = d.getElementsByTagName('w:rPr');
			for (let i = 0; i < rprs.length; i++) {
				const kids = Array.from(rprs[i].childNodes as ArrayLike<{ nodeName: string }>);
				for (const k of kids) {
					if (k.nodeName === 'w:highlight' || k.nodeName === 'w:shd') {
						rprs[i].removeChild(k as never);
						removed++;
					}
				}
			}
		}
		return removed > 0 ? (pkg.serialize() as Uint8Array) : docx;
	}

	return {
		async merge(template, values, blank) {
			return await editor.buildFinalDocx(normalize(template), values, undefined, undefined, {
				unfilled: blank ? 'blank' : 'keep',
			});
		},
		async listChips(template) {
			const pkg = new editor.DocxPackage(normalize(template));
			const docs = [editor.mainDocument(pkg)];
			for (const path of pkg.partPaths() as string[]) {
				if (!CHROME_RE.test(path)) continue;
				const d = pkg.loadXml(path);
				if (d) docs.push(d);
			}
			const seen = new Map<string, ChipDescriptor>();
			for (const chip of docs.flatMap((d) => editor.allChips(d))) {
				if (seen.has(chip.name)) continue;
				seen.set(chip.name, {
					name: chip.name,
					type: chip.type,
					fmt: chip.fmt,
					required: chip.required,
					def: chip.def,
					help: chip.help,
					opts: chip.opts,
					expr: chip.expr,
				});
			}
			return [...seen.values()];
		},
		async renderPdf(docx, opts) {
			if (opts?.removeHighlights) docx = stripHighlights(docx);
			return await renderer.render(docx, {});
		},
	};
}
