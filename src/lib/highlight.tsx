import React from 'react';
import type { SearchMode } from '../types/corpus';
import {
  normalizeDGQueryToTTH,
  normalizeTTHQuery,
  toBroadTTH,
} from './phonetics';

/**
 * Builds a character-sequence RegExp that highlights each query token inside a
 * phonetic word (allowing optional 'h' or "'" between characters so both Strict
 * and Broad matches highlight cleanly).
 */
export function buildPhoneticHighlightRegex(
  rawQuery: string,
  mode: SearchMode
): RegExp | null {
  if (mode === 'english') return null;
  const strictQuery =
    mode === 'dg' ? normalizeDGQueryToTTH(rawQuery) : normalizeTTHQuery(rawQuery);
  const broadTokens = toBroadTTH(strictQuery)
    .split(/\s+/)
    .filter(Boolean);
  if (broadTokens.length === 0) return null;

  // Sort longer tokens first so overlapping prefixes match greedily
  const patterns = [...broadTokens]
    .sort((a, b) => b.length - a.length)
    .map(tok =>
      tok
        .split('')
        .map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join("[h']*")
    );

  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

/**
 * Builds a RegExp for highlighting English search query terms.
 */
export function buildEnglishHighlightRegex(rawQuery: string): RegExp | null {
  const tokens = rawQuery
    .trim()
    .split(/\s+/)
    .map(t => t.replace(/[^\w']/g, ''))
    .filter(t => t.length >= 2);
  if (tokens.length === 0) return null;

  const patterns = [...tokens]
    .sort((a, b) => b.length - a.length)
    .map(tok => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

/**
 * Splits text by a single outer-capturing-group RegExp and renders matched
 * substrings inside a highlighted <mark> element.
 */
export function renderHighlightedToken(
  text: string,
  regex: RegExp | null
): React.ReactNode {
  if (!regex || !text) return text;
  const parts = text.split(regex);
  if (parts.length <= 1) return text;

  return parts.map((part, idx) => {
    // Because buildPhoneticHighlightRegex / buildEnglishHighlightRegex uses a single outer capturing group,
    // odd indices in split() are the matched substrings.
    if (idx % 2 === 1) {
      return (
        <mark
          key={idx}
          className="bg-sky-100 text-sky-950 font-semibold rounded px-0.5 underline decoration-sky-500 decoration-2 underline-offset-2"
        >
          {part}
        </mark>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}
