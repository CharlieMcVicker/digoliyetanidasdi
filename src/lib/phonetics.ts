/**
 * src/lib/phonetics.ts
 *
 * Pure orthographic conversion and phonetic normalization routines for
 * standard Cherokee D/G orthography and linguistic T/TH notation.
 */

/**
 * Normalizes a T/TH query string to lowercase canonical TTH without mutating
 * consonants (does not turn t -> th or k -> kh).
 */
export function normalizeTTHQuery(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\d+/g, '')
    .toLowerCase()
    .replace(/[’ʻʼʔ?]/g, "'")
    .replace(/[*:\-ː,._!;:"“”()‚]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts a D/G query string into canonical lowercase TTH using the exact
 * digohwelisgi consonant respelling rules:
 *   qu -> gw, tl -> dl
 *   t(?!s) -> th, d -> t, k -> kh, g -> k, j -> ts, ch -> tsh
 *   hn -> nh, hl -> lh, hy -> yh, hw -> wh
 *   sl(?=[aeiouv]) -> slh, ([^ht\s])s -> \1hs, vowel hiatus -> '
 */
export function normalizeDGQueryToTTH(raw: string): string {
  if (!raw) return '';
  let s = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\d+/g, '')
    .replace(/[:ː\-]/g, '')
    .toLowerCase()
    .replace(/qu/g, 'gw')
    .replace(/tl/g, 'dl');

  s = s.replace(/t(?!s)/g, 'th');
  s = s
    .replace(/d/g, 't')
    .replace(/k/g, 'kh')
    .replace(/g/g, 'k')
    .replace(/j/g, 'ts')
    .replace(/ch/g, 'tsh')
    .replace(/hn/g, 'nh')
    .replace(/hl/g, 'lh')
    .replace(/hy/g, 'yh')
    .replace(/hw/g, 'wh')
    .replace(/[?’ʻʼʔ]/g, "'");

  s = s.replace(/sl(?=[aeiouv])/g, 'slh');
  s = s.replace(/([^ht])s/g, '$1hs');
  s = s.replace(/([aeiouv])(?=[aeiouv])/g, "$1'");

  return normalizeTTHQuery(s);
}

/**
 * Strips aspiration ('h') and glottal stops ("'") for broad phonetic fallback.
 */
export function toBroadTTH(tth: string): string {
  return tth.replace(/[h']/g, '');
}

/**
 * 3-gram-only tokenizer for Cherokee phonetic substring/infix matching.
 * Words shorter than 3 characters are emitted as-is.
 */
export function phoneticNgramTokenizer(text: string): string[] {
  if (!text) return [];
  const normalized = text.toLowerCase().trim();
  const tokens = new Set<string>();
  const words = normalized.split(/\s+/).filter(Boolean);

  for (const w of words) {
    if (w.length < 3) {
      tokens.add(w);
    } else {
      for (let i = 0; i <= w.length - 3; i++) {
        tokens.add(w.substring(i, i + 3));
      }
    }
  }
  return Array.from(tokens);
}
