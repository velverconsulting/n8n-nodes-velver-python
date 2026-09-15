#!/usr/bin/env node
/**
 * Instala n8n globalmente con pnpm y deja listo su sqlite3.
 *
 * pnpm bloquea los scripts de build de dependencias, asi que sqlite3 queda sin
 * su binario nativo y n8n muere al arrancar con:
 *   SQLite package has not been found installed
 *
 * No sirve habilitar todos los builds (`dangerouslyAllowAllBuilds`): eso intenta
 * compilar tambien isolated-vm, que en Windows exige Visual Studio Build Tools.
 * Aqui se instala solo el prebuild NAPI de sqlite3, que no necesita compilador.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const run = (cmd, args, opts = {}) =>
	execFileSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });

console.log('> pnpm add -g n8n');
run('pnpm', ['add', '-g', 'n8n']);

// `pnpm root -g` no apunta al node_modules real, asi que pedimos la ruta del
// paquete directamente.
const listed = JSON.parse(
	execFileSync('pnpm', ['ls', '-g', '--depth', '0', '--json'], { shell: true, encoding: 'utf8' }),
);
const n8nDir = listed[0]?.dependencies?.n8n?.path;

if (!n8nDir) {
	console.error('n8n no aparece en la instalacion global de pnpm.');
	process.exit(1);
}

// El node_modules global solo contiene el shim de n8n; sus dependencias viven
// en el arbol aislado del store, asi que resolvemos desde el n8n real.
let realSqlite;
try {
	const requireFromN8n = createRequire(path.join(fs.realpathSync(n8nDir), 'package.json'));
	realSqlite = path.dirname(requireFromN8n.resolve('sqlite3/package.json'));
} catch {
	console.error('No se pudo resolver sqlite3 desde la instalacion de n8n.');
	process.exit(1);
}
if (fs.existsSync(path.join(realSqlite, 'build', 'Release', 'node_sqlite3.node'))) {
	console.log('sqlite3 ya tiene su binario nativo.');
} else {
	console.log('> prebuild-install -r napi (sqlite3)');
	run(path.join(realSqlite, 'node_modules', '.bin', 'prebuild-install'), ['-r', 'napi'], {
		cwd: realSqlite,
	});
}

console.log('\nListo. Ahora, en dos terminales:\n  pnpm dev\n  pnpm dev:n8n');
