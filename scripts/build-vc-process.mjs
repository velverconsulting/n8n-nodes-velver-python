#!/usr/bin/env node
/**
 * Compila <vc-process> y <vc-form> desde el front de proyecto_x y deja el
 * resultado en nodes/VelverProcessForm/assets/vcProcess.bundle.json.
 *
 * El codigo fuente NO se copia: proyecto_x sigue siendo la unica fuente de
 * verdad y este script solo toma una foto compilada. Se reutiliza el
 * vite.config.ts del front (aliases, Tailwind), con tres ajustes:
 *
 *  - una entrada propia que registra solo los dos layouts;
 *  - un unico archivo (sin chunks), porque el nodo lo sirve inline en la
 *    respuesta del webhook y no tiene rutas para assets sueltos;
 *  - el OCR de INE sustituido por el stub movil (captura por foto), igual que
 *    el build de la app: onnxruntime-web pesaria varios MB en cada pagina.
 *
 * El bundle se guarda como JSON porque el build de n8n (tsc) si lleva a dist/
 * los .json importados, pero no copia archivos .js sueltos.
 *
 * Uso: pnpm build:vc-process            (front en D:/proyecto_x/front)
 *      VC_FRONT_DIR=/ruta/front pnpm build:vc-process
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontDir = path.resolve(process.env.VC_FRONT_DIR || 'D:/proyecto_x/front');
const outFile = path.join(projectRoot, 'nodes', 'VelverProcessForm', 'assets', 'vcProcess.bundle.json');

if (!fs.existsSync(path.join(frontDir, 'vite.config.ts'))) {
	console.error(`No se encontro el front en ${frontDir} (define VC_FRONT_DIR).`);
	process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-process-build-'));
const entry = path.join(tmpDir, 'entry.ts');
// La pagina del nodo hace lo que vc-root hace al arrancar la app: fijar idioma
// y tema ANTES de crear el elemento (los componentes leen activeConfig al
// construirse) e inyectar las variables --vc-* con applyTheme. Sin eso los
// inputs y el stepper se pintan sin bordes ni colores.
// Tambien expone el cliente ORIGINAL del sobre v2 (EnvelopeAgent + sealWith):
// la configuracion y el envio viajan sellados, como en proyecto_x.
fs.writeFileSync(
	entry,
	[
		"import '@layouts/vc-process';",
		"import '@layouts/vc-form';",
		"import { activeConfig, setGlobalConfig } from '@base/theme/base.theme';",
		"import { applyTheme } from '@base/theme/engine';",
		"import { EnvelopeAgent, sealWith } from '@base/api/envelope';",
		// index.css define en :root los tokens que no llegan por applyTheme (sombras,
		// radios extendidos, blur). La app lo enlaza en index.html; aqui la pagina lo
		// inyecta en <head>, porque dentro del shadow DOM `:root` no aplica.
		"import globalStyles from '@tw';",
		// jsonata ya viaja en el bundle (vc-form la usa); la pagina la necesita para
		// decidir que campo alterno esta visible al enviar.
		"import jsonata from 'jsonata';",
		'(globalThis as any).VelverProcessForm = {',
		'  globalStyles,',
		'  jsonata,',
		'  configure(cfg: Parameters<typeof setGlobalConfig>[0]) {',
		'    setGlobalConfig(cfg);',
		'    applyTheme(activeConfig as any);',
		'  },',
		'  EnvelopeAgent,',
		'  sealWith,',
		'};',
		'',
	].join('\n'),
);

// Vite y sus plugins se resuelven desde el front, no desde este repo.
const { build } = await import(pathToFileURL(path.join(frontDir, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);

/**
 * Cargas perezosas que quedan FUERA del bundle. Todas dependen del backend de
 * proyecto_x (documentos Word, importar Excel a una tabla, visor del SAT) y
 * juntas pesan mas de 4 MB. Se marcan como externas en vez de sustituirse por
 * un stub: si una pagina llega a pedirlas, el `import()` se rechaza y el front
 * ya traduce ese fallo a su mensaje (ver vc-document/lazy.ts), sin romper el
 * resto del formulario.
 */
const UNAVAILABLE_LAZY = new Set([
	'./docx-viewer-chunk',
	'./docx-editor-chunk',
	'@components/vc-json-builder/import-wizard',
	'./visor',
]);

const dropBackendOnlyChunks = {
	name: 'vc-drop-backend-only-chunks',
	resolveDynamicImport(specifier) {
		if (typeof specifier === 'string' && UNAVAILABLE_LAZY.has(specifier)) {
			return { id: `velver-process-form-unavailable:${specifier}`, external: true };
		}
		return null;
	},
};

/**
 * El telefono (<vc-tel>) pide la tabla global `paises` al backend. Aqui su
 * modulo `./countries` se cambia por `scripts/stubs/vc-tel-countries.ts`, que lee
 * un catalogo minimo generado de `back/src/data/global/rows/paises.json`: solo
 * ISO-2 + lada empaquetados ("AF93AL355..."), y el nombre solo cuando ICU
 * (Intl.DisplayNames) no da el mismo que el catalogo.
 */
const paisesFile = path.resolve(frontDir, '..', 'back', 'src', 'data', 'global', 'rows', 'paises.json');
const telCountriesStub = path.join(projectRoot, 'scripts', 'stubs', 'vc-tel-countries.ts');
const VIRTUAL_PAISES = 'virtual:vc-paises';

const telWithoutBackend = {
	name: 'vc-tel-without-backend',
	enforce: 'pre',
	resolveId(source, importer) {
		if (source === VIRTUAL_PAISES) return `\0${VIRTUAL_PAISES}`;
		const fromTel = importer && importer.replaceAll('\\', '/').includes('/input-components/vc-tel/');
		if (source === './countries' && fromTel) return telCountriesStub;
		return null;
	},
	load(id) {
		if (id !== `\0${VIRTUAL_PAISES}`) return null;
		const rows = JSON.parse(fs.readFileSync(paisesFile, 'utf8')).filter((r) => r.value && r.lada);
		const packed = rows.map((r) => r.value.toUpperCase() + r.lada.replace(/^\+/, '').replace(/\s+/g, '_')).join('');
		const icu = new Intl.DisplayNames(['es'], { type: 'region' });
		const labels = Object.fromEntries(rows.filter((r) => icu.of(r.value) !== r.label).map((r) => [r.value, r.label]));
		return `export const packed = ${JSON.stringify(packed)};\nexport const labels = ${JSON.stringify(labels)};\n`;
	},
};

if (!fs.existsSync(paisesFile)) {
	console.error(`No se encontro el catalogo de paises en ${paisesFile}.`);
	process.exit(1);
}

/**
 * Ancho por campo en el grid de <vc-form> (`span: 2 | 'full'` en el FieldConfig).
 * vc-form no lo trae y es de otro dueño en proyecto_x, asi que se parchea SOLO en
 * este build. Si el codigo de vc-form cambia y el parche ya no calza, el build
 * falla en vez de perder la opcion en silencio.
 *
 *  · 'full' → renglon completo (1 / -1) en cualquier ancho;
 *  · 2      → dos columnas desde 640px (en 1 columna no hace nada; con 2
 *             columnas equivale a renglon completo).
 */
/**
 * Opciones calculadas con JSONata (`options_jsonata` + `options_catalog` en el
 * FieldConfig). Se evaluan en `evaluateFormStates`, el mismo lugar y momento que
 * `calculation`/`show_if`/`enabled_if` (al abrir, al cambiar un campo, al llegar
 * datos), contra los datos del formulario y con el catalogo como `$catalogo`.
 *
 *  · el resultado (arreglo de {label, value}, de textos u objeto {valor: texto})
 *    se vuelve la lista del campo — tambien en `field.options`, para que la
 *    busqueda del combo filtre sobre la lista calculada;
 *  · si lo elegido ya no esta en la lista nueva, se limpia (como una cascada).
 */
const FORM_LOGIC_FILE = '/layouts/vc-form/form-logic.ts';
const OPTIONS_JSONATA_BLOCK = `
    /* Parche del build de n8n (scripts/build-vc-process.mjs): opciones con JSONata. */
    if ((field as any).options_jsonata) {
      try {
        const result = await jsonata((field as any).options_jsonata).evaluate(data, { catalogo: (field as any).options_catalog });
        const opts = vcNormalizeOptions(result);
        (field as any).options = opts;
        if (JSON.stringify(opts) !== JSON.stringify(host.comboOptions[field.key] || [])) {
          host.comboOptions = { ...host.comboOptions, [field.key]: opts };
          optionsChanged = true;
        }
        const current = data[field.key];
        const chosen = (Array.isArray(current) ? current : [current]).filter((v: any) => v !== undefined && v !== null && v !== '');
        const kept = chosen.filter((v: any) => opts.some((o) => String(o.value) === String(v)));
        if (kept.length !== chosen.length) {
          data[field.key] = Array.isArray(current) ? kept : '';
          dataChanged = true;
        }
      } catch (e) {
        console.error(\`[vc-form] options_jsonata error for "\${field.key}":\`, e);
      }
    }
`;
const OPTIONS_JSONATA_HELPER = `
/* Parche del build de n8n (scripts/build-vc-process.mjs): opciones con JSONata. */
function vcNormalizeOptions(result: unknown): InputOption[] {
  const text = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  // El valor conserva su TIPO (1 sigue siendo numero): otra expresion que lo compare
  // (grupo = $$.campo) no iguala 1 con "1".
  const scalar = (v: unknown): any => (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : undefined);
  const list = result === undefined || result === null ? [] : Array.isArray(result) ? result : [result];
  if (list.length === 1 && list[0] && typeof list[0] === 'object' && !Array.isArray(list[0]) && !('label' in (list[0] as any)) && !('value' in (list[0] as any))) {
    return Object.entries(list[0] as Record<string, unknown>).map(([value, label]) => ({ label: text(label), value }));
  }
  const out: InputOption[] = [];
  for (const item of list) {
    if (item && typeof item === 'object') {
      const o = item as any;
      const label = text(o.label ?? o.name ?? o.text ?? o.value);
      const value = scalar(o.value) ?? scalar(o.id) ?? label;
      if (label || text(value)) out.push({ label: label || text(value), value: text(value) === '' ? label : value } as InputOption);
    } else if (typeof item === 'string' || typeof item === 'number') {
      out.push({ label: String(item), value: item } as InputOption);
    }
  }
  return out;
}
`;

/** Parches locales sobre vc-form: archivo → reemplazos exactos + codigo al final. */
const VC_FORM_PATCHES = {
	'/layouts/vc-form/index.ts': {
		patches: [
			{
				find: "<div class=\"field-wrapper w-full ${isFullWidth ? 'sm:col-span-full' : ''} ${hasError ? 'field-error' : ''}\">",
				replace:
					"<div class=\"field-wrapper w-full ${isFullWidth ? 'sm:col-span-full' : ''} ${hasError ? 'field-error' : ''} ${vcFieldSpanClass(col, this.columns)}\">",
			},
			{
				find: 'static styles = [\n    unsafeCSS(tailwindStyles),',
				replace:
					'static styles = [\n    unsafeCSS(tailwindStyles),\n    css`\n      .field-wrapper.vc-span-full { grid-column: 1 / -1; }\n      @media (min-width: 640px) { .field-wrapper.vc-span-2 { grid-column: span 2 / span 2; } }\n    `,',
			},
		],
		append: `
/* Parche del build de n8n (scripts/build-vc-process.mjs): ancho por campo. */
function vcFieldSpanClass(col: any, columns: number): string {
  const span = col?.span;
  if (span === 'full') return 'vc-span-full';
  if (Number(span) === 2 && columns >= 2) return columns === 2 ? 'vc-span-full' : 'vc-span-2';
  return '';
}
`,
	},
	[FORM_LOGIC_FILE]: {
		patches: [
			{
				find: '  let disabledChanged = false;\n',
				replace: '  let disabledChanged = false;\n  let optionsChanged = false;\n',
			},
			{
				find: '        console.error(`[vc-form] enabled_if error for "${field.key}":`, e);\n      }\n    }\n',
				replace:
					'        console.error(`[vc-form] enabled_if error for "${field.key}":`, e);\n      }\n    }\n' +
					OPTIONS_JSONATA_BLOCK,
			},
			{
				find: '  if (dataChanged || visibilityChanged || disabledChanged) host.requestUpdate();',
				replace: '  if (dataChanged || visibilityChanged || disabledChanged || optionsChanged) host.requestUpdate();',
			},
		],
		append: OPTIONS_JSONATA_HELPER,
	},
};

const vcFormPatches = {
	name: 'vc-form-patches',
	enforce: 'pre',
	transform(code, id) {
		const file = Object.keys(VC_FORM_PATCHES).find((f) => id.replaceAll('\\', '/').endsWith(f));
		if (!file) return null;
		const { patches, append } = VC_FORM_PATCHES[file];
		let out = code.replace(/\r\n/g, '\n');
		for (const { find, replace } of patches) {
			if (!out.includes(find)) {
				throw new Error(`[vc-form-patches] ${file} cambio: no se encontro «${find.trim().slice(0, 60)}…». Actualiza el parche.`);
			}
			out = out.replace(find, replace);
		}
		return { code: out + append, map: null };
	},
};

/** Con VC_BUNDLE_REPORT=1 imprime cuanto aporta cada paquete al bundle. */
const sizeReport = {
	name: 'vc-bundle-report',
	generateBundle(_options, bundle) {
		const totals = {};
		for (const chunk of Object.values(bundle)) {
			for (const [id, info] of Object.entries(chunk.modules || {})) {
				const norm = id.replaceAll('\\', '/');
				const nm = norm.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/);
				const pkg = norm.match(/vc_packages\/packages\/([^/]+)/);
				const src = norm.match(/\/src\/([^/]+\/[^/]+)/);
				const key = nm ? `npm  ${nm[1]}` : pkg ? `pkg  ${pkg[1]}` : src ? `src  ${src[1]}` : norm;
				totals[key] = (totals[key] || 0) + info.renderedLength;
			}
		}
		const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 30);
		for (const [key, bytes] of rows) console.log(`${(bytes / 1024).toFixed(0).padStart(6)} KB  ${key}`);
	},
};

const prevCwd = process.cwd();
process.chdir(frontDir);
try {
	await build({
		configFile: path.join(frontDir, 'vite.config.ts'),
		mode: 'production',
		logLevel: 'warn',
		plugins: [
			telWithoutBackend,
			vcFormPatches,
			dropBackendOnlyChunks,
			...(process.env.VC_BUNDLE_REPORT ? [sizeReport] : []),
		],
		publicDir: false,
		resolve: {
			alias: [
				{
					find: /^(\.\/|.*input-components\/)vc-ine$/,
					replacement: path.join(frontDir, 'src', 'mobile-stubs', 'vc-ine.ts'),
				},
				// La entrada vive en una carpeta temporal fuera del front: desde ahi `jsonata`
				// no se resuelve. Se apunta al paquete del front, el MISMO que usa vc-form.
				{ find: /^jsonata$/, replacement: path.join(frontDir, 'node_modules', 'jsonata') },
			],
		},
		build: {
			outDir: path.join(tmpDir, 'out'),
			emptyOutDir: true,
			lib: { entry, formats: ['es'], fileName: () => 'vc-process.js' },
			rollupOptions: { output: { inlineDynamicImports: true } },
		},
	});
} finally {
	process.chdir(prevCwd);
}

const js = fs.readFileSync(path.join(tmpDir, 'out', 'vc-process.js'), 'utf8');

let commit = '';
try {
	commit = execFileSync('git', ['-C', frontDir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
	// Si el front tiene cambios sin commit, el bundle no es ese commit: se dice.
	const dirty = execFileSync('git', ['-C', frontDir, 'status', '--porcelain', '--', '.'], { encoding: 'utf8' }).trim();
	if (dirty) commit += '+cambios-sin-commit';
} catch {
	/* sin git: el bundle queda sin commit de origen */
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
// El favicon de la pagina: el logo de Velver Consulting, el mismo SVG que usan las
// credenciales del paquete. Va como data: URI porque la pagina no tiene otras rutas.
const faviconSvg = fs.readFileSync(path.join(projectRoot, 'credentials', 'velver_consulting.svg'));
const favicon = `data:image/svg+xml;base64,${faviconSvg.toString('base64')}`;

fs.writeFileSync(
	outFile,
	JSON.stringify({ source: 'proyecto_x/front', commit, builtAt: new Date().toISOString(), favicon, js }),
);
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`Bundle: ${path.relative(projectRoot, outFile)} (${(js.length / 1024).toFixed(0)} KB, commit ${commit || '?'})`);
