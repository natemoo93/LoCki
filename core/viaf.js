/**
 * Get the VIAF cluster number for an LCNAF record from VIAF.
 * The LC exact match for VIAF has only the LC source ID, not the cluster number.
 */

const BASE = 'https://viaf.org/viaf/lccn/';

/** The maximum wait. A slow VIAF must not stop the popup. */
const TIMEOUT_MS = 6000;

/**
 * Find the VIAF cluster that contains this LCNAF record.
 * This function does not throw. A failure or no match gives undefined.
 * @param {string} lcnafId
 * @param {{signal?: AbortSignal}} [opts]
 * @returns {Promise<string | undefined>}
 */
export async function lookupViaf(lcnafId, opts = {}) {
  const id = String(lcnafId ?? '').trim();
  if (!/^n[a-z]?\d+$/.test(id)) return undefined;

  const timer = new AbortController();
  const t = setTimeout(() => timer.abort(), TIMEOUT_MS);
  opts.signal?.addEventListener('abort', () => timer.abort(), { once: true });

  try {
    const res = await fetch(`${BASE}${encodeURIComponent(id)}`, {
      signal: timer.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return undefined;
    return clusterIdFrom(await res.text());
  } catch {
    return undefined;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Read the cluster number from the text of a VIAF cluster record.
 * Do not parse the JSON. A long cluster number is larger than a safe JavaScript number.
 * @param {string} text
 * @returns {string | undefined}
 */
export function clusterIdFrom(text) {
  const match = String(text ?? '').match(/"ns1:viafID"\s*:\s*"?(\d{1,22})"?/);
  return match ? match[1] : undefined;
}
