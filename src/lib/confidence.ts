export interface ConfidenceColorClasses {
  badge: string;
  word: string;
  label: string;
  description: string;
  isLow: boolean;
}

export interface RowConfidenceFlair {
  pill: string;
  dot: string;
  label: string;
}

/**
 * Returns comprehensive confidence color classes and descriptions used for PhraseCard badges and words.
 */
export function getConfidenceColorClasses(
  conf: number,
  flagged?: boolean
): ConfidenceColorClasses {
  if (flagged || conf < 0.1) {
    return {
      badge: 'bg-rose-50 text-rose-800 border-rose-200',
      word: 'bg-rose-100 text-rose-950 border-rose-300 ring-1 ring-rose-200',
      label: 'Uncertain timing',
      description: 'Machine-generated word timing is uncertain here and may be slightly off',
      isLow: true,
    };
  }
  if (conf < 0.8) {
    return {
      badge: 'bg-amber-50 text-amber-900 border-amber-200',
      word: 'bg-amber-100 text-amber-950 border-amber-300 ring-1 ring-amber-200',
      label: 'Approximate match',
      description: 'Conversational or rapid speech — computer-aligned timing is approximate',
      isLow: false,
    };
  }
  return {
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    word: 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-1 ring-emerald-200',
    label: 'Clear match',
    description: 'Clear computer-generated audio alignment',
    isLow: false,
  };
}

/**
 * Returns compact underline classes for word highlights in context rows.
 */
export function getWordHighlightClasses(conf: number, flagged?: boolean): string {
  if (flagged || conf < 0.1) {
    return 'bg-rose-100/90 text-rose-950 underline decoration-rose-400';
  }
  if (conf < 0.8) {
    return 'bg-amber-100/90 text-amber-950 underline decoration-amber-400';
  }
  return 'bg-emerald-100/90 text-emerald-950 underline decoration-emerald-500';
}

/**
 * Returns pill and dot color styles for row-level confidence flair in context detail rows.
 */
export function getRowConfidenceFlair(
  conf: number,
  flagged?: boolean
): RowConfidenceFlair {
  if (flagged || conf < 0.1) {
    return {
      pill: 'bg-rose-50 text-rose-800 border-rose-200',
      dot: 'bg-rose-500',
      label: 'Uncertain timing',
    };
  }
  if (conf < 0.8) {
    return {
      pill: 'bg-amber-50 text-amber-900 border-amber-200',
      dot: 'bg-amber-500',
      label: 'Approximate',
    };
  }
  return {
    pill: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Clear match',
  };
}
