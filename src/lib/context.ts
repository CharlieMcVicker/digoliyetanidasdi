/**
 * src/lib/context.ts
 *
 * Context window generators and speaker turn resolution for ordered corpus
 * sources (Bible chapters and Saving the Voices elder interview turns).
 */

import type {
  BibleContextWindow,
  DocumentMeta,
  InterviewContextWindow,
  OrderedSourceContextWindow,
  PhraseRecord,
  TurnContainerModel,
} from '../types/corpus';

/**
 * Resolves a turn ID and 1-based phrase index from phrase properties or ID patterns.
 */
export function resolvePhraseTurnIdentity(phrase: PhraseRecord): {
  turnId: string;
  phraseIndex: number;
} {
  if (phrase.turn_id) {
    return {
      turnId: phrase.turn_id,
      phraseIndex: phrase.phrase_index ?? 1,
    };
  }
  const idMatch = phrase.id.match(/_(seg-\d+)_p(\d+)$/i);
  if (idMatch) {
    return {
      turnId: idMatch[1],
      phraseIndex: parseInt(idMatch[2], 10) || 1,
    };
  }
  const segMatch = phrase.id.match(/_seg_(\d+)$/i);
  if (segMatch) {
    return {
      turnId: `seg-${segMatch[1]}`,
      phraseIndex: 1,
    };
  }
  return {
    turnId: phrase.id,
    phraseIndex: 1,
  };
}

/**
 * Computes a lookup map from phrase.id -> { turnId, phraseIndex, turnPhraseCount }
 * across all phrases so search cards can show "Part X of Y" even if turn_phrase_count
 * was not pre-baked into JSON.
 */
export function buildTurnPartCountsMap(
  phrases: PhraseRecord[]
): Map<string, { turnId: string; phraseIndex: number; turnPhraseCount: number }> {
  const countsBySourceTurn = new Map<string, PhraseRecord[]>();

  for (const p of phrases) {
    if (!p.source_id.startsWith('stv_')) continue;
    const { turnId } = resolvePhraseTurnIdentity(p);
    const key = `${p.source_id}::${turnId}`;
    const list = countsBySourceTurn.get(key);
    if (list) {
      list.push(p);
    } else {
      countsBySourceTurn.set(key, [p]);
    }
  }

  const result = new Map<
    string,
    { turnId: string; phraseIndex: number; turnPhraseCount: number }
  >();

  for (const group of countsBySourceTurn.values()) {
    group.sort((a, b) => a.loc_index - b.loc_index);
    const total = group.length;
    group.forEach((p, idx) => {
      const { turnId, phraseIndex } = resolvePhraseTurnIdentity(p);
      result.set(p.id, {
        turnId,
        phraseIndex: p.phrase_index ?? phraseIndex ?? idx + 1,
        turnPhraseCount: p.turn_phrase_count ?? total,
      });
    });
  }

  return result;
}

/**
 * Pure transformation that builds a Context Detail window for an ordered source
 * (`biblical_chapter` or `marked_syllabary_corpus`).
 */
export function buildOrderedSourceContextWindow(
  targetPhrase: PhraseRecord,
  source: DocumentMeta,
  allPhrases: PhraseRecord[],
  radiusBefore: number,
  radiusAfter: number
): OrderedSourceContextWindow | null {
  if (source.source_type === 'dictionary_collection') {
    return null;
  }

  const sourcePhrases = allPhrases
    .filter(p => p.source_id === source.source_id)
    .sort((a, b) => a.loc_index - b.loc_index);

  if (sourcePhrases.length === 0) {
    return null;
  }

  if (source.source_type === 'biblical_chapter') {
    const targetIdx = Math.max(
      0,
      sourcePhrases.findIndex(p => p.id === targetPhrase.id)
    );
    const startIndex = Math.max(0, targetIdx - radiusBefore);
    const endIndex = Math.min(sourcePhrases.length - 1, targetIdx + radiusAfter);

    const verses = sourcePhrases.slice(startIndex, endIndex + 1);
    const result: BibleContextWindow = {
      kind: 'biblical_chapter',
      source,
      targetPhrase,
      verses,
      totalVerses: sourcePhrases.length,
      startIndex,
      endIndex,
      hasPrevious: startIndex > 0,
      hasNext: endIndex < sourcePhrases.length - 1,
    };
    return result;
  }

  // Saving the Voices (`marked_syllabary_corpus`): group phrases by turnId in chronological order
  const turnOrder: string[] = [];
  const turnMap = new Map<string, PhraseRecord[]>();

  for (const p of sourcePhrases) {
    const { turnId } = resolvePhraseTurnIdentity(p);
    if (!turnMap.has(turnId)) {
      turnOrder.push(turnId);
      turnMap.set(turnId, []);
    }
    turnMap.get(turnId)!.push(p);
  }

  const { turnId: targetTurnId } = resolvePhraseTurnIdentity(targetPhrase);
  const targetTurnIdx = Math.max(0, turnOrder.indexOf(targetTurnId));
  const startTurnIndex = Math.max(0, targetTurnIdx - radiusBefore);
  const endTurnIndex = Math.min(turnOrder.length - 1, targetTurnIdx + radiusAfter);

  const defaultSpeaker = source.title
    .replace(/^Saving the Voices:\s*/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();

  const turns: TurnContainerModel[] = [];
  for (let i = startTurnIndex; i <= endTurnIndex; i++) {
    const tId = turnOrder[i];
    const tPhrases = turnMap.get(tId) || [];
    const first = tPhrases[0];
    const last = tPhrases[tPhrases.length - 1];

    let speakerLabel = first?.speaker_label || '';
    if (!speakerLabel && first?.loc_label.includes('•')) {
      speakerLabel = first.loc_label.split('•').pop()?.trim() || '';
    }
    if (!speakerLabel) {
      speakerLabel = defaultSpeaker;
    }

    const turnStartSec =
      first?.turn_start_sec ??
      first?.global_start_sec ??
      first?.audio_start ??
      0;
    const turnEndSec =
      last?.turn_end_sec ??
      last?.global_end_sec ??
      last?.audio_end ??
      turnStartSec;

    // Infer turn_audio_path if not explicitly present on local STV recordings
    const isRemote =
      first?.audio_path.startsWith('http://') ||
      first?.audio_path.startsWith('https://');
    const inferredTurnAudioPath =
      first?.turn_audio_path ??
      (!isRemote && tId.startsWith('seg-')
        ? `stv_turn_audio/${source.source_id}/${tId}.mp3`
        : isRemote
          ? first.audio_path
          : null);

    turns.push({
      turnId: tId,
      turnIndex: i,
      speakerLabel,
      englishText: first?.english_text ?? null,
      turnAudioPath: inferredTurnAudioPath ?? null,
      turnStartSec,
      turnEndSec,
      phrases: tPhrases,
      isTargetTurn: tId === targetTurnId,
    });
  }

  const result: InterviewContextWindow = {
    kind: 'marked_syllabary_corpus',
    source,
    targetPhrase,
    targetTurnId,
    turns,
    totalTurns: turnOrder.length,
    startTurnIndex,
    endTurnIndex,
    hasPrevious: startTurnIndex > 0,
    hasNext: endTurnIndex < turnOrder.length - 1,
  };
  return result;
}
