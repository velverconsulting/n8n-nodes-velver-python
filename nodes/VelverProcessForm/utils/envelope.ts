/**
 * Sobre de cifrado v2 (rotativo) — el lado SERVIDOR, portado byte a byte de
 * `proyecto_x/back/src/security/envelopeV2.js` (spec: `proyecto_x/docs/envelope-v2.md`).
 * La página del formulario usa el cliente original (`EnvelopeAgent` del front),
 * así que cualquier cambio en la derivación tiene que hacerse también allá.
 *
 * Igual que en proyecto_x, esto NO es confidencialidad (eso lo da TLS): es
 * anti-automatización. La configuración y el envío viajan sellados con
 * parámetros que rotan cada 10 minutos y que solo se conocen pidiendo el
 * challenge, en vez de ir como JSON legible en la página y en el POST.
 */
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	createHmac,
	randomBytes,
	timingSafeEqual,
} from 'crypto';

export const WINDOW_MS = 10 * 60 * 1000;
export const VERSION = 2;

export interface EnvelopeParams {
	id: number;
	exp: number;
	salt: string;
	headers: { visitor: string; author: string; sig: string };
	enc: number;
	flip: boolean;
	pad: number;
	ivLast: boolean;
	sig: string;
}

/**
 * El secreto de la rotación. En proyecto_x es VC_SESSION_SECRET; aquí se genera
 * por proceso de n8n. Si n8n se reinicia, las páginas abiertas reciben la seña
 * `renew`, piden un challenge nuevo y siguen: nada que configurar.
 */
const SECRET = randomBytes(32);

export const windowAt = (nowMs = Date.now()) => Math.floor(nowMs / WINDOW_MS);

/** Las ventanas que se aceptan: la actual y la anterior (skew). */
export const acceptedWindows = (nowMs = Date.now()) => {
	const w = windowAt(nowMs);
	return [w, w - 1];
};

const hmac = (text: string) => createHmac('sha256', SECRET).update(text, 'utf8').digest();
const b64url = (buf: Buffer) => buf.toString('base64url');
const reverse = (s: string) => s.split('').reverse().join('');

export function paramsFor(win: number): EnvelopeParams {
	const seed = hmac(`vc-env2:${win}`);
	const names = [
		`x-vc-${seed.subarray(12, 15).toString('hex')}`,
		`x-vc-${seed.subarray(15, 18).toString('hex')}`,
		`x-vc-${seed.subarray(18, 21).toString('hex')}`,
	];
	if (names[1] === names[0]) names[1] += 'a';
	if (names[2] === names[0] || names[2] === names[1]) names[2] += 's';
	const salt = b64url(seed.subarray(0, 12));
	return {
		id: win,
		exp: (win + 1) * WINDOW_MS,
		salt,
		headers: { visitor: names[0], author: names[1], sig: names[2] },
		enc: seed[21] % 3,
		flip: seed[22] % 2 === 1,
		pad: seed[23] % 13,
		ivLast: seed[24] % 2 === 1,
		sig: b64url(hmac(`vc-env2-sig:${win}:${salt}`)),
	};
}

export function sigValid(given: string | undefined, params: EnvelopeParams): boolean {
	const a = Buffer.from(String(given || ''), 'utf8');
	const b = Buffer.from(params.sig, 'utf8');
	return a.length === b.length && timingSafeEqual(a, b);
}

/** Lo que responde el challenge (el `/challenge` de proyecto_x). */
export const challengePayload = (nowMs = Date.now()) => ({
	ok: true,
	v: VERSION,
	now: nowMs,
	window: paramsFor(windowAt(nowMs)),
});

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest();

export function requestKey(salt: string, visitor: string, author: string): Buffer {
	const v = Buffer.from(String(visitor), 'utf8').toString('base64');
	const a = reverse(Buffer.from(String(author), 'utf8').toString('base64'));
	return sha256(`v2|${salt}|${v}|${a}`);
}

function encodeBody(buf: Buffer, params: EnvelopeParams): string {
	const s =
		params.enc === 0
			? buf.toString('base64')
			: params.enc === 1
				? buf.toString('base64url')
				: buf.toString('hex');
	return params.flip ? reverse(s) : s;
}

function decodeBody(str: string, params: EnvelopeParams): Buffer {
	const s = params.flip ? reverse(str) : str;
	if (params.enc === 0) return Buffer.from(s, 'base64');
	if (params.enc === 1) return Buffer.from(s, 'base64url');
	return Buffer.from(s, 'hex');
}

export function seal(plaintext: string, params: EnvelopeParams, key: Buffer): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ct = Buffer.concat([
		cipher.update(String(plaintext), 'utf8'),
		cipher.final(),
		cipher.getAuthTag(),
	]);
	const padBytes = params.pad ? randomBytes(params.pad) : Buffer.alloc(0);
	const body = params.ivLast
		? Buffer.concat([padBytes, ct, iv])
		: Buffer.concat([padBytes, iv, ct]);
	return `v2.${params.id}.${encodeBody(body, params)}`;
}

export function parseEnvelope(text: unknown): { win: number; blob: string } | null {
	const m = /^v2\.(\d+)\.([A-Za-z0-9_\-+/=]+)$/.exec(String(text || ''));
	return m ? { win: Number(m[1]), blob: m[2] } : null;
}

export function open(blob: string, params: EnvelopeParams, key: Buffer): string {
	const body = decodeBody(blob, params);
	const inner = body.subarray(params.pad);
	if (inner.length < 12 + 16) throw new Error('envelope too short');
	const iv = params.ivLast ? inner.subarray(inner.length - 12) : inner.subarray(0, 12);
	const ct = params.ivLast ? inner.subarray(0, inner.length - 12) : inner.subarray(12);
	const tag = ct.subarray(ct.length - 16);
	const data = ct.subarray(0, ct.length - 16);
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export interface OpenedRequest {
	/** El cuerpo ya abierto. */
	plain: string;
	/** Sella la respuesta con la MISMA ventana y llave de la petición. */
	sealResponse: (payload: unknown) => { content: string };
}

/**
 * La mitad de `encryptionMiddleware` que aplica aquí: busca la sesión v2 por las
 * cabeceras rotadas, verifica la firma y abre `{ content }`. `null` = rechazar
 * con 400 + `x-vc-env: renew`, sin decir por qué (frase neutra).
 */
export function openRequest(
	headers: Record<string, string | string[] | undefined>,
	body: unknown,
	nowMs = Date.now(),
): OpenedRequest | null {
	const header = (name: string) => {
		const value = headers[name.toLowerCase()];
		return Array.isArray(value) ? value[0] : value;
	};

	let session: { params: EnvelopeParams; visitor: string; author: string } | null = null;
	for (const win of acceptedWindows(nowMs)) {
		const params = paramsFor(win);
		if (sigValid(header(params.headers.sig), params)) {
			session = {
				params,
				visitor: header(params.headers.visitor) || '',
				author: header(params.headers.author) || '',
			};
			break;
		}
	}
	if (!session || !session.visitor || !session.author) return null;

	const parsed = parseEnvelope((body as { content?: unknown })?.content);
	if (!parsed || !acceptedWindows(nowMs).includes(parsed.win)) return null;

	const params = parsed.win === session.params.id ? session.params : paramsFor(parsed.win);
	const key = requestKey(params.salt, session.visitor, session.author);
	try {
		const plain = open(parsed.blob, params, key);
		return {
			plain,
			sealResponse: (payload) => ({ content: seal(JSON.stringify(payload), params, key) }),
		};
	} catch {
		return null;
	}
}
