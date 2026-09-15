#!/usr/bin/env node
/**
 * Arranca n8n para desarrollo de nodos, apuntando al mismo user folder que
 * usa `n8n-node dev` (~/.n8n-node-cli).
 *
 * Se usa junto con `n8n-node dev --external-n8n` para no depender de
 * `npx n8n@latest`, que reinstala n8n con npm en cada arranque.
 *
 * Ademas corrige el symlink del paquete: el CLI lo apunta a la raiz del
 * proyecto, pero el `n8n.nodes` de nuestro package.json usa rutas sin el
 * prefijo `dist/` (porque `pnpm deploy` copia el contenido de dist/ al
 * servidor). Para que n8n resuelva los .js compilados, el symlink tiene que
 * apuntar a dist/.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const n8nUserFolder = path.join(os.homedir(), '.n8n-node-cli');

const packageName = JSON.parse(
	fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
).name;

if (!fs.existsSync(path.join(distDir, 'package.json'))) {
	console.error(
		`No se encontro ${path.join(distDir, 'package.json')}.\n` +
			'Corre `pnpm dev` (o `pnpm exec n8n-node build`) primero.',
	);
	process.exit(1);
}

const linkPath = path.join(n8nUserFolder, '.n8n', 'custom', 'node_modules', packageName);
fs.mkdirSync(path.dirname(linkPath), { recursive: true });
fs.rmSync(linkPath, { recursive: true, force: true });
try {
	fs.symlinkSync(distDir, linkPath, 'dir');
} catch {
	// En Windows un symlink requiere privilegios; un junction no.
	fs.symlinkSync(distDir, linkPath, 'junction');
}
console.log(`Enlazado ${packageName} -> ${distDir}`);

const child = spawn('n8n', ['start'], {
	stdio: 'inherit',
	shell: true,
	cwd: n8nUserFolder,
	env: {
		...process.env,
		N8N_DEV_RELOAD: 'true',
		DB_SQLITE_POOL_SIZE: '10',
		N8N_USER_FOLDER: n8nUserFolder,
	},
});

child.on('exit', (code) => process.exit(code ?? 0));
