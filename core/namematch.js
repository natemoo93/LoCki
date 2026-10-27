/**
 * Find Wikidata items by name and dates, for records that the P244 search does not find.
 * A match with identical dates is a duplicate. A match in the year tolerance is evidence only.
 */

import { USER_AGENT } from './wikidata.js';

/** The query service has current data. The search index can be late. */
const SPARQL = 'https://query.wikidata.org/sparql';

/** The address of a Wikidata item page. */
const ITEM_URL = 'https://www.wikidata.org/wiki/';

/** The maximum wait. SPARQL is slower than the search index. */
const TIMEOUT_MS = 10000;

/**
 * The maximum difference in years between two dates that match.
 * Catalogues often have a difference of one year.
 */
export const YEAR_TOLERANCE = 1;

/**
 * @typedef {{
 *   status: 'none' | 'possible' | 'duplicate' | 'skipped' | 'error',
 *   items: {id: string, url: string, label: string, birth: number, death: number, exact: boolean}[],
 *   detail?: string
 * }} NameMatchResult
 */

/**
 * Find an item with this name, these two years, and no P244.
 * Search for the name with and without diacritics. This function does not throw. A failure gives the status 'error'.
 * @param {{label: string, birth?: {year: number}, death?: {year: number}}} draft
 * @param {{signal?: AbortSignal}} [opts]
 * @returns {Promise<NameMatchResult>}
 */
export async function findNameMatches(draft, opts = {}) {
  const label = String(draft?.label ?? '').trim();
  const birth = draft?.birth?.year;
  const death = draft?.death?.year;

  // Both years are necessary. A name and one year are not sufficient evidence.
  if (!label || !Number.isInteger(birth) || !Number.isInteger(death)) {
    return { status: 'skipped', items: [], detail: 'The check needs a name, a birth year, and a death year.' };
  }

  const query = buildQuery(nameForms(label), birth, death);
  const url = `${SPARQL}?format=json&query=${encodeURIComponent(query)}`;

  const timer = new AbortController();
  const t = setTimeout(() => timer.abort(), TIMEOUT_MS);
  const signal = anySignal([opts.signal, timer.signal]);

  try {
    const res = await fetch(url, {
      signal,
      headers: {
        Accept: 'application/sparql-results+json',
        'Api-User-Agent': USER_AGENT,
        'User-Agent': USER_AGENT,
      },
    });

    if (res.status === 429) {
      return { status: 'error', items: [], detail: 'Wikidata rate limit. Do the check manually.' };
    }
    if (!res.ok) {
      return { status: 'error', items: [], detail: `The query service sent error ${res.status}.` };
    }

    const data = await res.json();
    const rows = data?.results?.bindings ?? [];
    if (rows.length === 0) return { status: 'none', items: [] };

    const items = uniqueItems(rows.map((r) => toItem(r, draft)).filter(Boolean));
    const exact = items.filter((i) => i.exact);
    return exact.length ? { status: 'duplicate', items: exact } : { status: 'possible', items };
  } catch (cause) {
    if (cause?.name === 'AbortError') {
      const stopped = opts.signal?.aborted;
      return {
        status: 'error',
        items: [],
        detail: stopped ? 'You cancelled the check.' : 'The query service did not answer in the time limit.',
      };
    }
    return { status: 'error', items: [], detail: `Cannot connect to the query service. ${cause.message}` };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Get the name and, if it is different, the name without diacritics.
 * @param {string} label
 * @returns {string[]}
 */
export function nameForms(label) {
  const plain = stripDiacritics(label);
  return plain === label ? [label] : [label, plain];
}

/**
 * Remove the combining marks and the ALA-LC modifier letters from a name.
 * @param {string} name
 * @returns {string}
 */
export function stripDiacritics(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\p{M}ʹ-ʼ]/gu, '')
    .normalize('NFC');
}

/**
 * Make the SPARQL query. One label must match exactly and the years must be in tolerance.
 * Exclude an item that has P244.
 * @param {string | string[]} labels
 * @param {number} birth
 * @param {number} death
 * @returns {string}
 */
export function buildQuery(labels, birth, death) {
  const names = [].concat(labels).map((l) => `${sparqlString(l)}@en`).join(' ');
  return `SELECT ?item ?itemLabel ?birth ?death ?birthDate ?deathDate WHERE {
  VALUES ?name { ${names} }
  ?item rdfs:label ?name .
  ?item wdt:P31 wd:Q5 .
  ?item wdt:P569 ?birthDate .
  ?item wdt:P570 ?deathDate .
  FILTER NOT EXISTS { ?item wdt:P244 ?lc . }
  BIND(YEAR(?birthDate) AS ?birth)
  BIND(YEAR(?deathDate) AS ?death)
  FILTER(ABS(?birth - ${birth}) <= ${YEAR_TOLERANCE})
  FILTER(ABS(?death - ${death}) <= ${YEAR_TOLERANCE})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 5`;
}

/**
 * Make a SPARQL string literal. Escape quotes, backslashes, and line breaks.
 * Thus a name cannot end the literal and change the query.
 * @param {string} value
 * @returns {string}
 */
function sparqlString(value) {
  const bs = String.fromCharCode(92);
  const body = String(value)
    .split(bs)
    .join(bs + bs)
    .split('"')
    .join(bs + '"')
    .split(String.fromCharCode(10))
    .join(bs + 'n')
    .split(String.fromCharCode(13))
    .join(bs + 'r')
    .split(String.fromCharCode(9))
    .join(bs + 't');
  return '"' + body + '"';
}

/**
 * Change one result row into an item. Return undefined if the row has no usable item URI.
 * The item is exact if both dates are identical to the record dates.
 * @param {object} row
 * @param {{birth?: object, death?: object}} draft
 */
function toItem(row, draft) {
  const uri = row?.item?.value ?? '';
  const id = uri.split('/').pop();
  if (!/^Q\d+$/.test(id ?? '')) return undefined;

  return {
    id,
    url: ITEM_URL + id,
    label: row?.itemLabel?.value ?? '',
    birth: Number(row?.birth?.value),
    death: Number(row?.death?.value),
    exact: sameDate(draft.birth, row?.birthDate?.value) && sameDate(draft.death, row?.deathDate?.value),
  };
}

/**
 * Keep one item for each ID. Keep the exact item if there is one.
 * An item with two birth dates gives two rows.
 * @param {object[]} items
 */
function uniqueItems(items) {
  const byId = new Map();
  for (const item of items) {
    if (!byId.has(item.id) || item.exact) byId.set(item.id, item);
  }
  return [...byId.values()];
}

/**
 * Return true if a Wikidata date is identical to a record date at the precision of the record.
 * A circa date is never identical.
 * @param {{year: number, month?: number, day?: number, circa?: boolean} | undefined} date
 * @param {string | undefined} value a Wikidata time, such as "1835-11-30T00:00:00Z"
 * @returns {boolean}
 */
export function sameDate(date, value) {
  const m = String(value ?? '').match(/^([+-]?\d+)-(\d{2})-(\d{2})/);
  if (!date || date.circa || !m) return false;
  if (Number(m[1]) !== date.year) return false;
  if (date.month !== undefined && Number(m[2]) !== date.month) return false;
  if (date.day !== undefined && Number(m[3]) !== date.day) return false;
  return true;
}

/**
 * Make one signal that aborts when one of the given signals aborts.
 * @param {(AbortSignal | undefined)[]} signals
 * @returns {AbortSignal}
 */
function anySignal(signals) {
  const list = signals.filter(Boolean);
  if (list.length === 1) return list[0];
  if (typeof AbortSignal !== 'undefined' && AbortSignal.any) return AbortSignal.any(list);

  const ctl = new AbortController();
  for (const s of list) {
    if (s.aborted) {
      ctl.abort();
      break;
    }
    s.addEventListener('abort', () => ctl.abort(), { once: true });
  }
  return ctl.signal;
}
