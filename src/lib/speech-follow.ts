export type FollowMatchMode = "interim" | "final";

export type FollowProgressState = {
  committedCursor: number;
  visibleCursor: number;
  pendingInterimCursor: number | null;
  interimStreak: number;
  lastInterimWordCount: number;
};

const STRONG_MATCH_THRESHOLD = 0.78;
const EXACTISH_MATCH_THRESHOLD = 0.92;
const SEARCH_BACKTRACK = 10;
const SEARCH_AHEAD = 220;
const DISTANCE_PENALTY_START = 48;
const MAX_INTERIM_LEAD = 10;
const MIN_INTERIM_LEAD = 4;
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "if", "in", "into", "is", "it", "of", "on", "or", "so", "that", "the",
  "to", "up", "we", "with", "you",
]);

type Alignment = {
  adjustedScore: number;
  strongMatches: number;
  exactishMatches: number;
  signalMatches: number;
  maxConsecutiveMatches: number;
  signalCoverage: number;
  endIndexExclusive: number;
};

const sanitizeWord = (word: string) => word.replace(/'/g, "");

const isSignalWord = (word: string) => word.length >= 4 || !STOP_WORDS.has(word);

export const normalizeSpeech = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .map(sanitizeWord)
    .filter(Boolean);

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const next = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    next[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(
        prev[j] + 1,
        next[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }

    for (let j = 0; j <= b.length; j++) prev[j] = next[j];
  }

  return prev[b.length];
};

const wordSimilarity = (scriptWord: string, heardWord: string) => {
  if (!scriptWord || !heardWord) return 0;
  if (scriptWord === heardWord) return 1;

  const a = sanitizeWord(scriptWord);
  const b = sanitizeWord(heardWord);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const shortest = Math.min(a.length, b.length);
  if (shortest <= 3) return 0;

  if (a.startsWith(b) || b.startsWith(a)) {
    return shortest / Math.max(a.length, b.length);
  }

  const similarity = 1 - levenshteinDistance(a, b) / Math.max(a.length, b.length);
  return similarity >= 0.72 ? similarity : 0;
};

const alignPhrase = (
  scriptWords: string[],
  heardWords: string[],
  absoluteWindowStart: number,
  cursor: number,
): Alignment | null => {
  const rows = heardWords.length;
  const cols = scriptWords.length;
  const scores = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));
  const trace = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));
  const sims = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));

  let bestScore = 0;
  let bestI = 0;
  let bestJ = 0;

  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      const similarity = wordSimilarity(scriptWords[j - 1], heardWords[i - 1]);
      sims[i][j] = similarity;

      const diag =
        scores[i - 1][j - 1] +
        (similarity >= STRONG_MATCH_THRESHOLD ? 1.7 + similarity * 1.6 : -1.4);
      const up = scores[i - 1][j] - 0.9;
      const left = scores[i][j - 1] - 0.45;

      let bestLocal = 0;
      let direction = 0;

      if (diag > bestLocal) {
        bestLocal = diag;
        direction = 1;
      }
      if (up > bestLocal) {
        bestLocal = up;
        direction = 2;
      }
      if (left > bestLocal) {
        bestLocal = left;
        direction = 3;
      }

      scores[i][j] = bestLocal;
      trace[i][j] = direction;

      if (bestLocal > bestScore || (bestLocal === bestScore && j < bestJ)) {
        bestScore = bestLocal;
        bestI = i;
        bestJ = j;
      }
    }
  }

  if (!bestScore) return null;

  let i = bestI;
  let j = bestJ;
  const matchedScriptIndexes: number[] = [];
  const matchedHeardIndexes: number[] = [];
  let strongMatches = 0;
  let exactishMatches = 0;
  let signalMatches = 0;

  while (i > 0 && j > 0 && scores[i][j] > 0) {
    const direction = trace[i][j];

    if (direction === 1) {
      const similarity = sims[i][j];
      if (similarity >= STRONG_MATCH_THRESHOLD) {
        strongMatches++;
        matchedScriptIndexes.push(j - 1);
        matchedHeardIndexes.push(i - 1);

        if (similarity >= EXACTISH_MATCH_THRESHOLD) exactishMatches++;
        if (isSignalWord(scriptWords[j - 1]) || isSignalWord(heardWords[i - 1])) {
          signalMatches++;
        }
      }

      i--;
      j--;
    } else if (direction === 2) {
      i--;
    } else if (direction === 3) {
      j--;
    } else {
      break;
    }
  }

  if (!strongMatches) return null;

  matchedScriptIndexes.reverse();
  matchedHeardIndexes.reverse();

  let maxConsecutiveMatches = 0;
  let runLength = 0;

  for (let index = 0; index < matchedScriptIndexes.length; index++) {
    const isConsecutive =
      index > 0 &&
      matchedScriptIndexes[index] === matchedScriptIndexes[index - 1] + 1 &&
      matchedHeardIndexes[index] === matchedHeardIndexes[index - 1] + 1;

    runLength = isConsecutive ? runLength + 1 : 1;
    maxConsecutiveMatches = Math.max(maxConsecutiveMatches, runLength);
  }

  const signalWordCount = heardWords.filter(isSignalWord).length || heardWords.length;
  const lastMatchedIndex = matchedScriptIndexes[matchedScriptIndexes.length - 1];
  const absoluteEndIndex = absoluteWindowStart + lastMatchedIndex + 1;
  const adjustedScore =
    bestScore - Math.max(0, absoluteEndIndex - cursor - DISTANCE_PENALTY_START) * 0.04;

  return {
    adjustedScore,
    strongMatches,
    exactishMatches,
    signalMatches,
    maxConsecutiveMatches,
    signalCoverage: signalMatches / signalWordCount,
    endIndexExclusive: absoluteEndIndex,
  };
};

export const findFollowIndex = (options: {
  scriptWords: string[];
  heardText: string;
  cursor: number;
  mode: FollowMatchMode;
}) => {
  const heardWords = normalizeSpeech(options.heardText);
  if (heardWords.length < 2 || !options.scriptWords.length) return null;

  const windowStart = Math.max(0, options.cursor - SEARCH_BACKTRACK);
  const windowEnd = Math.min(options.scriptWords.length, options.cursor + SEARCH_AHEAD);
  const windowWords = options.scriptWords.slice(windowStart, windowEnd);
  const alignment = alignPhrase(windowWords, heardWords, windowStart, options.cursor);
  if (!alignment) return null;

  const minStrongMatches = heardWords.length >= 6 ? 3 : 2;
  const minScore = options.mode === "final" ? 3.2 : 4.2;
  const minSignalCoverage = options.mode === "final" ? 0.34 : 0.5;
  const hasReliableAnchor =
    alignment.signalMatches > 0 ||
    alignment.exactishMatches >= 3 ||
    alignment.maxConsecutiveMatches >= 3;

  if (alignment.adjustedScore < minScore) return null;
  if (alignment.strongMatches < minStrongMatches && alignment.maxConsecutiveMatches < 2) return null;
  if (alignment.signalCoverage < minSignalCoverage && alignment.strongMatches < 3) return null;
  if (!hasReliableAnchor) return null;
  if (alignment.endIndexExclusive <= options.cursor) return null;

  return alignment.endIndexExclusive;
};

export const createFollowProgressState = (): FollowProgressState => ({
  committedCursor: 0,
  visibleCursor: 0,
  pendingInterimCursor: null,
  interimStreak: 0,
  lastInterimWordCount: 0,
});

export const settleInterimProgress = (state: FollowProgressState): FollowProgressState => ({
  ...state,
  visibleCursor: state.committedCursor,
  pendingInterimCursor: null,
  interimStreak: 0,
  lastInterimWordCount: 0,
});

export const applyFollowTranscript = (options: {
  state: FollowProgressState;
  scriptWords: string[];
  heardText: string;
  mode: FollowMatchMode;
}) => {
  const heardWords = normalizeSpeech(options.heardText);
  const candidate = findFollowIndex({
    scriptWords: options.scriptWords,
    heardText: options.heardText,
    cursor: options.state.committedCursor,
    mode: options.mode,
  });

  if (options.mode === "final") {
    if (candidate == null || candidate <= options.state.committedCursor) {
      return settleInterimProgress(options.state);
    }

    return {
      committedCursor: candidate,
      visibleCursor: candidate,
      pendingInterimCursor: null,
      interimStreak: 0,
      lastInterimWordCount: 0,
    };
  }

  if (candidate == null || candidate <= options.state.committedCursor) {
    return {
      ...options.state,
      pendingInterimCursor: null,
      interimStreak: 0,
      lastInterimWordCount: heardWords.length,
    };
  }

  const clampedCandidate = Math.min(
    candidate,
    options.state.committedCursor + Math.min(MAX_INTERIM_LEAD, Math.max(MIN_INTERIM_LEAD, heardWords.length + 2)),
  );
  const continuingRun =
    options.state.pendingInterimCursor != null &&
    clampedCandidate >= options.state.pendingInterimCursor &&
    clampedCandidate <= options.state.pendingInterimCursor + 3 &&
    heardWords.length >= options.state.lastInterimWordCount;
  const nextStreak = continuingRun ? options.state.interimStreak + 1 : 1;
  const nextVisibleCursor =
    nextStreak >= 2 && clampedCandidate > options.state.visibleCursor
      ? clampedCandidate
      : options.state.visibleCursor;

  return {
    ...options.state,
    visibleCursor: nextVisibleCursor,
    pendingInterimCursor: clampedCandidate,
    interimStreak: nextStreak,
    lastInterimWordCount: heardWords.length,
  };
};
