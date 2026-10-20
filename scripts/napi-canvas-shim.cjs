/**
 * Shim de `canvas` (node-canvas/Cairo) sobre `@napi-rs/canvas` (Skia, con binarios musl).
 *
 * El motor docx-pdf (vendoreado) hace `require('canvas')` y usa: createCanvas(w,h,'pdf'),
 * ctx.addPage(w,h) para multipágina, loadImage(Buffer), registerFont (via fontconfig) y
 * toBuffer('application/pdf', opts). Aquí: PDF multipágina con PDFDocument.beginPage/endPage;
 * las fuentes del `fonts.conf` que prepara el motor (FONTCONFIG_FILE) y las del paquete se
 * registran con GlobalFonts. `textDrawingMode` no existe en Skia (el texto ya va incrustado).
 * scripts/vendor-docx.mjs copia este archivo a vendor/docx/pdf/dist/ y redirige el require.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const napi = require('@napi-rs/canvas');

const registered = new Set();
function registerDir(dir) {
	if (!dir || registered.has(dir) || !fs.existsSync(dir)) return;
	registered.add(dir);
	for (const f of fs.readdirSync(dir)) {
		if (/\.(ttf|otf|ttc)$/i.test(f)) {
			try { napi.GlobalFonts.registerFromPath(path.join(dir, f)); } catch { /* fuente ilegible */ }
		}
	}
}
/** Carpetas del paquete (../assets/fonts) y las <dir> del fonts.conf que fija el motor. */
function ensureFonts() {
	registerDir(path.join(__dirname, '..', 'assets', 'fonts'));
	const conf = process.env.FONTCONFIG_FILE;
	if (conf && fs.existsSync(conf)) {
		const xml = fs.readFileSync(conf, 'utf8');
		for (const m of xml.matchAll(/<dir>([^<]+)<\/dir>/g)) registerDir(m[1].replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
	}
}

function createCanvas(w, h, type) {
	if (type !== 'pdf') return napi.createCanvas(w, h);
	ensureFonts();
	const doc = new napi.PDFDocument({});
	let real = null;
	let open = false;
	const begin = (pw, ph) => { real = doc.beginPage(pw, ph); open = true; };
	const proxy = new Proxy({}, {
		get(_t, prop) {
			if (prop === 'addPage') return (pw, ph) => { if (open) doc.endPage(); begin(pw, ph); };
			if (prop === 'textDrawingMode') return 'glyph';
			const v = real[prop];
			return typeof v === 'function' ? v.bind(real) : v;
		},
		set(_t, prop, value) {
			if (prop === 'textDrawingMode') return true;
			real[prop] = value;
			return true;
		},
	});
	return {
		width: w,
		height: h,
		getContext() { if (!real) begin(w, h); return proxy; },
		toBuffer(_mime, opts) {
			if (!real) begin(w, h);
			if (open) { doc.endPage(); open = false; }
			void opts; // creator/fechas: el renderer re-sella metadatos con pdf-lib
			return doc.close();
		},
	};
}

module.exports = {
	createCanvas,
	loadImage: (src) => napi.loadImage(src),
	registerFont: (file, o) => { napi.GlobalFonts.registerFromPath(file, o && o.family); },
};
