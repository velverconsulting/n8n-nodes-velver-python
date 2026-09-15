/**
 * Sustituto de `proyecto_x/front/src/input-components/vc-tel/countries.ts` para
 * el formulario de n8n, que no tiene el backend donde vive la tabla global
 * `paises`. Mismas exportaciones y mismo `TelCountry`, así que `<vc-tel>` y su
 * celda no cambian una línea.
 *
 * Minificado al máximo: del catálogo solo viaja ISO-2 + lada (~1.2 KB, lo
 * empaqueta `scripts/build-vc-process.mjs` desde `paises.json`), y el nombre lo
 * da `Intl.DisplayNames` en español, salvo los pocos países cuyo nombre en el
 * catálogo difiere del de ICU (van en `labels`).
 *
 * Banderas SOLO de CDN: `<vc-tel>` pinta la imagen de flagcdn (`flagUrlFor`)
 * encima de `bandera`, y si `bandera` viene vacía pone 🌐. Por eso aquí
 * `bandera` es un espacio de ancho cero: nunca asoma un emoji, solo la imagen.
 */
import { packed, labels } from 'virtual:vc-paises';

/** Igual a `TelCountry` de vc-tel/phone-core.ts. */
interface TelCountry {
	iso2: string;
	label: string;
	lada: string;
	bandera: string;
}

const NO_EMOJI = '​';

function build(): TelCountry[] {
	let names: Intl.DisplayNames | null = null;
	try {
		names = new Intl.DisplayNames(['es'], { type: 'region' });
	} catch {
		/* sin Intl.DisplayNames: el nombre queda como el ISO-2 */
	}
	const out: TelCountry[] = [];
	// "AF93AL355…AI1_264…": ISO-2 en mayúsculas + dígitos de la lada ("_" = espacio).
	for (const [, iso2, digits] of packed.matchAll(/([A-Z]{2})([\d_]+)/g)) {
		out.push({
			iso2,
			label: labels[iso2] || names?.of(iso2) || iso2,
			lada: `+${digits.replace(/_/g, ' ')}`,
			bandera: NO_EMOJI,
		});
	}
	return out;
}

let cache: TelCountry[] | null = null;

export function getCachedTelCountries(): TelCountry[] {
	return (cache ??= build());
}

export function _resetTelCountriesCache() {
	cache = null;
}

/** Misma firma que el original; aquí no hay red, el `getter` no se usa. */
export async function loadTelCountries(_getter?: unknown): Promise<TelCountry[]> {
	return getCachedTelCountries();
}

export function matchesTelSearch(c: TelCountry, term: string): boolean {
	const t = term.trim().toLowerCase();
	if (!t) return true;
	if (c.label.toLowerCase().includes(t)) return true;
	if (c.iso2.toLowerCase().includes(t)) return true;
	const digits = t.replace(/\D+/g, '');
	return digits.length > 0 && c.lada.replace(/\D+/g, '').includes(digits);
}
