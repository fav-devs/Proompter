/**
 * speech-follow.ts
 *
 * Word-by-word sequential script tracker.
 *
 * Each spoken word is looked up in the script near the current cursor.
 * The cursor advances by exactly 1 per matched word — overshoot is impossible.
 *
 * Two-phase matching:
 *   1. Sequential scan  — word-by-word within MAX_SIGNAL_SKIP of current pos.
 *      Handles normal speech flow and single missed/skipped script words.
 *   2. Wide resync       — if nothing matched at all (speaker jumped ahead),
 *      scan up to RESYNC_WINDOW words ahead to re-lock onto the new position.
 *
 * Filler / inserted words that don't match anything nearby are ignored.
 */

const MATCH_THRESHOLD = 0.72;
// Max script words to skip forward per spoken word during normal flow.
const MAX_SIGNAL_SKIP = 3;
// How far ahead to scan when the speaker has jumped sections.
const RESYNC_WINDOW = 80;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "if", "in", "into", "is", "it", "of", "on", "or", "so", "that", "the",
  "to", "up", "we", "with", "you",
]);

// ─── text utilities ──────────────────────────────────────────────────────────

export const normalizeSpeech = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/'/g, ""))
    .filter(Boolean);

const isSignalWord = (word: string) => word.length >= 4 || !STOP_WORDS.has(word);

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const next = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    next[0] = i;
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        prev[j] + 1,
        next[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = next[j];
  }
  return prev[b.length];
};

export const wordSimilarity = (scriptWord: string, heardWord: string): number => {
  if (!scriptWord || !heardWord) return 0;
  if (scriptWord === heardWord) return 1;
  const shortest = Math.min(scriptWord.length, heardWord.length);
  if (shortest <= 3) return scriptWord === heardWord ? 1 : 0;
  if (scriptWord.startsWith(heardWord) || heardWord.startsWith(scriptWord))
    return shortest / Math.max(scriptWord.length, heardWord.length);
  const sim = 1 - levenshteinDistance(scriptWord, heardWord) / Math.max(scriptWord.length, heardWord.length);
  return sim >= 0.72 ? sim : 0;
};

// ─── core tracker ────────────────────────────────────────────────────────────

/** Process words sequentially from `startPos`, advancing by at most MAX_SIGNAL_SKIP per word.
 *  Returns [newPos, signalMatchCount]. */
const scanSequential = (
  scriptWords: string[],
  startPos: number,
  spokenWords: string[],
): [number, number] => {
  let pos = startPos;
  let signalMatched = 0;
  for (const spoken of spokenWords) {
    if (!spoken) continue;
    // Stop words only match in-place (skip=0) to prevent them jumping over content.
    const skipLimit = isSignalWord(spoken) ? MAX_SIGNAL_SKIP : 0;
    for (let skip = 0; skip <= skipLimit; skip++) {
      const idx = pos + skip;
      if (idx >= scriptWords.length) break;
      if (wordSimilarity(scriptWords[idx], spoken) >= MATCH_THRESHOLD) {
        pos = idx + 1;
        if (isSignalWord(spoken)) signalMatched++;
        break;
      }
    }
    // No match → filler/insertion, leave pos unchanged
  }
  return [pos, signalMatched];
};

/**
 * Wide resync: scan ahead up to RESYNC_WINDOW when the speaker has jumped
 * to a different section.  Anchors on the first signal word match, then
 * runs sequential matching from there.  Requires at least 2 signal words
 * to match after the anchor to be accepted (avoids false positives).
 */
const tryResync = (
  scriptWords: string[],
  cursor: number,
  signalWords: string[],
): number | null => {
  if (signalWords.length < 2) return null;
  const wideEnd = Math.min(scriptWords.length, cursor + RESYNC_WINDOW);

  for (let anchorIdx = cursor + MAX_SIGNAL_SKIP + 1; anchorIdx < wideEnd; anchorIdx++) {
    if (wordSimilarity(scriptWords[anchorIdx], signalWords[0]) < MATCH_THRESHOLD) continue;

    // Anchor found. Run sequential from one past the anchor with remaining signals.
    const [candidate, extraMatched] = scanSequential(scriptWords, anchorIdx + 1, signalWords.slice(1));
    // Accept only if we matched at least one more signal word after the anchor.
    if (extraMatched >= 1 && candidate > anchorIdx + 1) return candidate;
  }
  return null;
};

/**
 * Advance `cursor` through `scriptWords` by matching each word in `spokenWords`.
 *
 * For each spoken word:
 *   • Signal word  → look ahead up to MAX_SIGNAL_SKIP script positions
 *   • Stop / short → only check exact cursor position (prevents hopping)
 *   • No match     → treat as filler/insertion, cursor stays put
 *
 * If fewer than 2 signal words matched (speaker may have jumped ahead),
/**
 * Try to match a single spoken word at/near `cursor` in the script.
 * Used for live interim word-by-word streaming.
 *
 * Signal words may skip up to 1 script position to absorb a single dropped word
 * from STT without letting one interim token jump multiple words ahead.
 * Stop words must match exactly so they don't hop over content words.
 *
 * Returns the new cursor (idx + 1) if matched, null if not.
 */
export const tryMatchWord = (
  scriptWords: string[],
  cursor: number,
  spokenWord: string,
  skipLimit?: number,
): number | null => {
  if (!spokenWord) return null;
  const limit = skipLimit ?? (isSignalWord(spokenWord) ? 1 : 0);
  for (let skip = 0; skip <= limit; skip++) {
    const idx = cursor + skip;
    if (idx >= scriptWords.length) break;
    if (wordSimilarity(scriptWords[idx], spokenWord) >= MATCH_THRESHOLD) {
      return idx + 1;
    }
  }
  return null;
};

/**
 * Verify that the last spoken word still lines up with the live cursor.
 * Returns the cursor position immediately after the matched word when that
 * word exists within a small +/- window around the current cursor.
 */
export const findNearbyCursorAnchor = (
  scriptWords: string[],
  cursor: number,
  spokenWord: string,
  radius = 2,
): number | null => {
  if (!spokenWord || !scriptWords.length) return null;

  const minCursor = Math.max(1, cursor - radius);
  const maxCursor = Math.min(scriptWords.length, cursor + radius);

  let bestCursor: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestScore = 0;

  for (let candidateCursor = minCursor; candidateCursor <= maxCursor; candidateCursor++) {
    const score = wordSimilarity(scriptWords[candidateCursor - 1], spokenWord);
    if (score < MATCH_THRESHOLD) continue;

    const distance = Math.abs(candidateCursor - cursor);
    if (
      bestCursor === null ||
      distance < bestDistance ||
      (distance === bestDistance && score > bestScore)
    ) {
      bestCursor = candidateCursor;
      bestDistance = distance;
      bestScore = score;
    }
  }

  return bestCursor;
};

/**
 * Advance `cursor` through `scriptWords` by matching each word in `spokenWords`.
 * Used for final (confirmed) transcripts — full correction pass with resync.
 */
export const advanceWordByWord = (
  scriptWords: string[],
  cursor: number,
  spokenWords: string[],
): number => {
  const signals = spokenWords.filter(isSignalWord);
  const [next, signalMatchCount] = scanSequential(scriptWords, cursor, spokenWords);

  // Attempt wide resync when signal words largely didn't match near cursor.
  // This handles the case where the speaker has jumped to a different section.
  if (signalMatchCount < 2 && signals.length >= 2) {
    const resynced = tryResync(scriptWords, cursor, signals);
    if (resynced != null && resynced > next) return resynced;
  }

  return next;
};
