import { existsSync } from 'node:fs';
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
	renderPdf(docx: Uint8Array): Promise<RenderResult>;
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
	const renderer = pdf.createRenderer({ metricsDir: join(dir, 'viewer', 'assets') });

	return {
		async merge(template, values, blank) {
			return await editor.buildFinalDocx(template, values, undefined, undefined, {
				unfilled: blank ? 'blank' : 'keep',
			});
		},
		async listChips(template) {
			const pkg = new editor.DocxPackage(template);
			const doc = editor.mainDocument(pkg);
			const seen = new Map<string, ChipDescriptor>();
			for (const chip of editor.allChips(doc)) {
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
		async renderPdf(docx) {
			return await renderer.render(docx, {});
		},
	};
}
