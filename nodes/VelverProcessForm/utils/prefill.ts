/**
 * El pre-relleno cifrado: un parámetro `?p=<token>` en la URL del formulario que
 * trae valores para algunos campos, generado por el nodo Velver Form Prefill.
 *
 * AES-256-GCM con una llave derivada del secreto de la credencial, así que el
 * token no se puede leer ni alterar sin el secreto: lo que trae se puede tratar
 * como dato confiable (un campo deshabilitado queda impuesto con ese valor).
 * Solo el servidor lo abre; a la página le llegan los valores ya dentro de la
 * configuración sellada con el sobre v2.
 *
 * token = base64url(iv(12) ∥ tag(16) ∥ cifrado(JSON {v:1, d:{…}, e:vencimientoMs|0}))
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { IDataObject } from 'n8n-workflow';

export const PREFILL_PARAM = 'p';

const keyFor = (secret: string) =>
	createHash('sha256').update(`vc-prefill|${secret}`, 'utf8').digest();

export function sealPrefill(secret: string, data: IDataObject, expiresAt = 0): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
	const ct = Buffer.concat([
		cipher.update(JSON.stringify({ v: 1, d: data, e: expiresAt }), 'utf8'),
		cipher.final(),
	]);
	return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64url');
}

export type OpenedPrefill =
	| { ok: true; data: IDataObject }
	| { ok: false; reason: 'invalid' | 'expired' };

/** Abre un token: `invalid` si está alterado o es de otro secreto, `expired` si ya venció. */
export function openPrefill(secret: string, token: string, nowMs = Date.now()): OpenedPrefill {
	let payload: { v?: number; d?: IDataObject; e?: number };
	try {
		const raw = Buffer.from(token, 'base64url');
		if (raw.length < 12 + 16 + 1) return { ok: false, reason: 'invalid' };
		const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), raw.subarray(0, 12));
		decipher.setAuthTag(raw.subarray(12, 28));
		payload = JSON.parse(
			Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'),
		);
	} catch {
		return { ok: false, reason: 'invalid' };
	}
	if (payload.v !== 1 || !payload.d || typeof payload.d !== 'object') {
		return { ok: false, reason: 'invalid' };
	}
	if (payload.e && nowMs > payload.e) return { ok: false, reason: 'expired' };
	return { ok: true, data: payload.d };
}
