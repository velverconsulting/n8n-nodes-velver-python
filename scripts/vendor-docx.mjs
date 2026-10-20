#!/usr/bin/env node
/**
 * Vendorea el motor DOCX/PDF de velver-packages (docx-pdf, docx-editor y
 * docx-viewer) para el nodo VelverDocument, SIN instalarlos desde GitHub
 * Packages. Toma los dist/ YA construidos de un clon local y deja una foto en
 * vendor/docx/.
 *
 * Por que copiar dist/ y no empaquetar con ncc: los tres paquetes son ESM con
 * `import.meta`, `import()` dinamicos y `canvas` nativo (parcheado a @napi-rs/canvas); ncc los volveria CJS y
 * rompe justo esos puntos. Copiados tal cual solo cambia una cosa: los
 * especificadores `@velverconsultingorg/*` se reescriben a rutas relativas (el
 * paquete publicado no lleva node_modules anidados, npm los descarta). Lo demas
 * (fflate, jsonata, pdf-lib, @xmldom/xmldom, @pdf-lib/fontkit, @napi-rs/canvas) son
 * dependencias normales de package.json.
 *
 * Layout resultante (conserva la forma de los paquetes originales):
 *   vendor/docx/package.json            {"type":"module"}
 *   vendor/docx/pdf/dist, pdf/assets/fonts
 *   vendor/docx/editor/dist
 *   vendor/docx/viewer/dist, viewer/assets/{families,font_fallback.json}
 * (se omite advance_tables.json, 21 MB: con families/ el layout es identico.)
 *
 * Uso:
 *   pnpm vendor:docx                  copia desde VELVER_PACKAGES_DIR a vendor/docx
 *   node scripts/vendor-docx.mjs --dist
 *                                     ademas copia vendor/docx a dist/vendor/docx
 *                                     (build/deploy hacen scp de dist/* solamente)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = path.resolve(
	process.env.VELVER_PACKAGES_DIR || '/root/vc-console/proyectos/velver-packages/packages',
);
const vendorDir = path.join(root, 'vendor', 'docx');
const toDist = process.argv.includes('--dist');

/** Copia una carpeta omitiendo sourcemaps y .d.ts. */
function copyDir(from, to, skip = () => false) {
	fs.mkdirSync(to, { recursive: true });
	for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
		const src = path.join(from, entry.name);
		const dst = path.join(to, entry.name);
		if (skip(entry.name)) continue;
		if (entry.isDirectory()) copyDir(src, dst, skip);
		else fs.copyFileSync(src, dst);
	}
}

function vendor() {
	const need = [
		['docx-pdf', 'dist/index.js'],
		['docx-pdf', 'assets/fonts'],
		['docx-editor', 'dist/node.js'],
		['docx-viewer', 'dist/index.js'],
		['docx-viewer', 'assets/families/index.json'],
		['docx-viewer', 'assets/font_fallback.json'],
	];
	const missing = need.filter(([pkg, rel]) => !fs.existsSync(path.join(packagesDir, pkg, rel)));
	if (missing.length) {
		const pkgs = [...new Set(missing.map(([pkg]) => pkg))];
		console.error(`Faltan artefactos en ${packagesDir}:`);
		for (const [pkg, rel] of missing) console.error(`  - ${pkg}/${rel}`);
		console.error('Construye los paquetes en ese repo (en este orden) y vuelve a correr:');
		for (const pkg of ['docx-viewer', 'docx-editor', 'docx-pdf'].filter((p) => pkgs.includes(p))) {
			console.error(`  pnpm -F @velverconsultingorg/${pkg} build`);
		}
		console.error('Si el repo esta en otra ruta, define VELVER_PACKAGES_DIR.');
		process.exit(1);
	}

	fs.rmSync(vendorDir, { recursive: true, force: true });
	const noMaps = (name) => name.endsWith('.map') || name.endsWith('.d.ts');
	const p = (pkg, rel) => path.join(packagesDir, pkg, rel);
	const v = (...rel) => path.join(vendorDir, ...rel);

	copyDir(p('docx-pdf', 'dist'), v('pdf', 'dist'), noMaps);
	copyDir(p('docx-pdf', 'assets/fonts'), v('pdf', 'assets', 'fonts'));
	// index/react/worker del editor son la UI de navegador (lit, DOM): el nodo solo usa node.js.
	const editorUi = new Set(['index.js', 'react.js', 'worker.js']);
	copyDir(p('docx-editor', 'dist'), v('editor', 'dist'), (name) => noMaps(name) || editorUi.has(name));
	copyDir(p('docx-viewer', 'dist'), v('viewer', 'dist'), noMaps);
	copyDir(p('docx-viewer', 'assets/families'), v('viewer', 'assets', 'families'));
	fs.copyFileSync(p('docx-viewer', 'assets/font_fallback.json'), v('viewer', 'assets', 'font_fallback.json'));
	fs.writeFileSync(v('package.json'), JSON.stringify({ type: 'module' }) + '\n');

	// @velverconsultingorg/* -> ruta relativa (solo en `from '...'` e `import('...')`).
	const target = (spec) => {
		if (spec === '@velverconsultingorg/docx-editor/node') return 'editor/dist/node.js';
		const m = /^@velverconsultingorg\/docx-viewer(?:\/(\w+))?$/.exec(spec);
		return m ? `viewer/dist/${m[1] || 'index'}.js` : null;
	};
	let rewritten = 0;
	for (const pkg of ['pdf', 'editor', 'viewer']) {
		const distDir = v(pkg, 'dist');
		for (const file of fs.readdirSync(distDir).filter((f) => f.endsWith('.js'))) {
			const full = path.join(distDir, file);
			const before = fs.readFileSync(full, 'utf8');
			const after = before.replace(
				/(\bfrom\s*|\bimport\(\s*)(['"])(@velverconsultingorg\/[^'"]+)\2/g,
				(m, lead, q, spec) => {
					const dest = target(spec);
					if (!dest) throw new Error(`${pkg}/dist/${file}: especificador sin destino: ${spec}`);
					let rel = path.relative(distDir, v(...dest.split('/'))).split(path.sep).join('/');
					if (!rel.startsWith('.')) rel = './' + rel;
					rewritten++;
					return `${lead}${q}${rel}${q}`;
				},
			);
			if (after !== before) fs.writeFileSync(full, after);
		}
	}

	// PARCHE canvas: el motor pide `canvas` (node-canvas/Cairo), que no corre en Alpine/musl.
	// Se redirige a scripts/napi-canvas-shim.cjs (sobre @napi-rs/canvas, Skia) copiado junto al dist.
	const shimName = 'napi-canvas-shim.cjs';
	fs.copyFileSync(path.join(root, 'scripts', shimName), v('pdf', 'dist', shimName));
	let patched = 0;
	for (const file of fs.readdirSync(v('pdf', 'dist')).filter((f) => f.endsWith('.js'))) {
		const full = path.join(v('pdf', 'dist'), file);
		const before = fs.readFileSync(full, 'utf8');
		const after = before.replace(/createRequire\(import\.meta\.url\)\((["'])canvas\1\)/g, () => {
			patched++;
			return `createRequire(import.meta.url)("./${shimName}")`;
		});
		if (after !== before) fs.writeFileSync(full, after);
	}
	if (!patched) throw new Error('parche canvas: no se encontro require("canvas") en docx-pdf (cambio el motor?)');

	const meta = {};
	for (const pkg of ['docx-pdf', 'docx-editor', 'docx-viewer']) {
		meta[pkg] = JSON.parse(fs.readFileSync(p(pkg, 'package.json'), 'utf8')).version;
	}
	fs.writeFileSync(v('VERSIONS.json'), JSON.stringify({ ...meta, vendoredAt: new Date().toISOString() }, null, 2) + '\n');
	console.log(`vendor/docx listo (${rewritten} imports reescritos): ${JSON.stringify(meta)}`);
}

if (!toDist || !fs.existsSync(path.join(vendorDir, 'pdf', 'dist', 'index.js'))) vendor();

if (toDist) {
	const out = path.join(root, 'dist', 'vendor', 'docx');
	fs.rmSync(out, { recursive: true, force: true });
	copyDir(vendorDir, out);
	console.log(`copiado a ${path.relative(root, out)}`);
}
