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
  TurnRecord,
  WordAlignment,
  WordTurnTiming,
} from '../types/corpus';
import { formatTimeRange } from './format';

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
 * Calculates the absolute start and end time (in seconds) of a word inside
 * its parent turn audio file.
 */
export function computeWordTurnTime(
  phrase: PhraseRecord,
  word: WordAlignment
): { startSec: number; endSec: number } {
  const phraseOffset =
    phrase.turn_start_sec !== undefined && phrase.global_start_sec !== undefined
      ? Math.max(0, phrase.global_start_sec - phrase.turn_start_sec)
      : 0;
  return {
    startSec: Number((phraseOffset + word.start).toFixed(3)),
    endSec: Number((phraseOffset + word.end).toFixed(3)),
  };
}

/**
 * Calculates the start and end time (in seconds) of a phrase/part inside
 * its parent turn audio file.
 */
export function computePhraseTurnTime(
  phrase: PhraseRecord
): { startSec: number; endSec: number } {
  const startSec =
    phrase.turn_start_sec !== undefined && phrase.global_start_sec !== undefined
      ? Math.max(0, phrase.global_start_sec - phrase.turn_start_sec)
      : 0;

  const rawEnd =
    phrase.turn_start_sec !== undefined && phrase.global_end_sec !== undefined
      ? phrase.global_end_sec - phrase.turn_start_sec
      : phrase.audio_end
        ? startSec + phrase.audio_end
        : startSec;

  const endSec = Math.max(startSec + 0.05, rawEnd);

  return {
    startSec: Number(startSec.toFixed(3)),
    endSec: Number(endSec.toFixed(3)),
  };
}

/**
 * Computes all word intervals for a turn mapped into the turn's audio timeline.
 */
export function computeTurnWordTimings(turn: TurnRecord): WordTurnTiming[] {
  const timings: WordTurnTiming[] = [];
  turn.phrases.forEach((phrase, pIdx) => {
    const phraseOffset =
      phrase.turn_start_sec !== undefined && phrase.global_start_sec !== undefined
        ? Math.max(0, phrase.global_start_sec - phrase.turn_start_sec)
        : 0;
    phrase.words.forEach((w, wIdx) => {
      timings.push({
        phraseId: phrase.id,
        phraseIndex: pIdx,
        wordIndex: wIdx,
        word: w.word,
        startSec: Number((phraseOffset + w.start).toFixed(3)),
        endSec: Number((phraseOffset + w.end).toFixed(3)),
      });
    });
  });
  return timings;
}

/**
 * Pure transformation that groups phrases across the entire corpus into canonical TurnRecords.
 *
 * - For Saving the Voices (`marked_syllabary_corpus`): groups aligned subchunks into elder interview turns.
 * - For Biblical chapters and Dictionary collections: wraps each verse or example sentence as a 1-phrase turn.
 */
export function buildCorpusTurns(
  phrases: PhraseRecord[],
  sourcesMap?: Map<string, DocumentMeta>
): Map<string, TurnRecord> {
  const turnGroups = new Map<string, PhraseRecord[]>();

  for (const p of phrases) {
    const { turnId } = resolvePhraseTurnIdentity(p);
    const key = `${p.source_id}::${turnId}`;
    const list = turnGroups.get(key);
    if (list) {
      list.push(p);
    } else {
      turnGroups.set(key, [p]);
    }
  }

  const result = new Map<string, TurnRecord>();

  for (const [key, group] of turnGroups.entries()) {
    group.sort((a, b) => a.loc_index - b.loc_index);
    const first = group[0];
    const last = group[group.length - 1];

    const turnId = resolvePhraseTurnIdentity(first).turnId;
    const isSTV = first.source_id.startsWith('stv_');

    let speakerLabel = first.speaker_label || '';
    if (!speakerLabel && first.loc_label.includes('•')) {
      speakerLabel = first.loc_label.split('•').pop()?.trim() || '';
    }
    if (!speakerLabel && sourcesMap) {
      const src = sourcesMap.get(first.source_id);
      if (src) {
        speakerLabel = src.title
          .replace(/^Saving the Voices:\s*/i, '')
          .replace(/\s*\([^)]*\)\s*$/, '')
          .trim();
      }
    }

    const turnStartSec =
      first.turn_start_sec ??
      first.global_start_sec ??
      first.audio_start ??
      0;
    const turnEndSec =
      last.turn_end_sec ??
      last.global_end_sec ??
      last.audio_end ??
      (turnStartSec + 1);

    const durationSec = Math.max(0, turnEndSec - turnStartSec);

    let locLabel: string;
    if (isSTV) {
      const cleanTurnId = turnId.startsWith('seg-')
        ? `Seg ${turnId.replace('seg-', '')}`
        : turnId;
      locLabel = speakerLabel
        ? `${cleanTurnId} (${formatTimeRange(turnStartSec, turnEndSec)}) • ${speakerLabel}`
        : `${cleanTurnId} (${formatTimeRange(turnStartSec, turnEndSec)})`;
    } else {
      locLabel = first.loc_label;
    }

    const isRemote =
      first.audio_path.startsWith('http://') ||
      first.audio_path.startsWith('https://');
    const turnAudioPath =
      first.turn_audio_path ??
      (!isRemote && isSTV && turnId.startsWith('seg-')
        ? `stv_turn_audio/${first.source_id}/${turnId}.mp3`
        : isRemote
          ? first.audio_path
          : first.audio_path);

    const syllabaryText = group
      .map(p => p.syllabary_text.trim())
      .filter(Boolean)
      .join(' ');
    const phoneticText = group
      .map(p => p.phonetic_text.trim())
      .filter(Boolean)
      .join(' ');
    const phoneticBroad = group
      .map(p => p.phonetic_broad.trim())
      .filter(Boolean)
      .join(' ');

    const meanConf =
      group.reduce((acc, p) => acc + (p.mean_confidence || 0), 0) / group.length;

    const hasAnomalies = group.some(p => p.has_anomalies);

    result.set(key, {
      id: key,
      turn_id: turnId,
      source_id: first.source_id,
      speaker_label: speakerLabel,
      loc_label: locLabel,
      loc_index: first.loc_index,
      english_text: first.english_text ?? null,
      turn_audio_path: turnAudioPath,
      turn_start_sec: turnStartSec,
      turn_end_sec: turnEndSec,
      duration_sec: durationSec,
      mean_confidence: Number(meanConf.toFixed(4)),
      has_anomalies: hasAnomalies,
      phrases: group,
      syllabary_text: syllabaryText,
      phonetic_text: phoneticText,
      phonetic_broad: phoneticBroad,
    });
  }

  return result;
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
