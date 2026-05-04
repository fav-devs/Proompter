import { useCallback, useEffect, useRef, useState } from "react";
import { advanceWordByWord, normalizeSpeech, tryMatchWord } from "@/lib/speech-follow";

interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  isFinal: boolean; length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  length: number; [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number; results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike { error: string }
interface SpeechRecognitionLike {
  continuous: boolean; interimResults: boolean; lang: string;
  onstart: (() => void) | null;
  onend:   (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  start(): void; stop(): void;
}
interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

const getRecognition = (): SpeechRecognitionLike | null => {
  const w = window as SpeechRecognitionWindow;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
};

export const isSpeechSupported = () => {
  if (typeof window === "undefined") return false;
  const w = window as SpeechRecognitionWindow;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
};

export function useSpeechFollow(opts: {
  enabled: boolean;
  scriptText: string;
  onWordIndex: (index: number) => void;
}) {
  const { enabled, scriptText, onWordIndex } = opts;
  const recRef   = useRef<SpeechRecognitionLike | null>(null);
  const wordsRef = useRef<string[]>([]);

  /**
   * Two cursors:
   *   committed — advanced only by final results (ground truth, never drifts)
   *   visual    — streamed word-by-word from interim; snapped to committed on
   *               each final (error correction)
   */
  const committedRef = useRef(0);
  const visualRef    = useRef(0);

  // How many words the previous interim event had (to detect new words).
  const prevInterimLenRef = useRef(0);

  const [listening, setListening] = useState(false);
  const [interim, setInterim]     = useState("");
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    wordsRef.current       = normalizeSpeech(scriptText);
    committedRef.current   = 0;
    visualRef.current      = 0;
    prevInterimLenRef.current = 0;
  }, [scriptText]);

  const emitVisual = useCallback(
    (next: number) => {
      if (next !== visualRef.current) {
        visualRef.current = next;
        onWordIndex(next);
      }
    },
    [onWordIndex],
  );

  useEffect(() => {
    if (!enabled) {
      recRef.current?.stop?.();
      recRef.current = null;
      committedRef.current = 0;
      visualRef.current    = 0;
      prevInterimLenRef.current = 0;
      setListening(false);
      setInterim("");
      return;
    }

    const rec = getRecognition();
    if (!rec) { setError("Speech recognition not supported in this browser"); return; }

    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = navigator.language || "en-US";

    rec.onstart = () => setListening(true);
    rec.onend   = () => {
      if (!enabled) {
        setListening(false);
        return;
      }
      // Restart silently — don't flip listening→false→true which causes the
      // mic icon to flicker every time Chrome ends a speech segment.
      try { rec.start(); } catch { setListening(false); }
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error || "speech error");
    };

    rec.onresult = (event) => {
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0].transcript;

        if (r.isFinal) {
          // ── Final: authoritative correction pass ──────────────────────────
          // Run from committed (not visual) so we always correct from ground
          // truth even if interim drifted.
          const spokenWords = normalizeSpeech(t);
          const nextCommitted = advanceWordByWord(
            wordsRef.current, committedRef.current, spokenWords,
          );
          committedRef.current = nextCommitted;

          // Only snap visual to committed for large resync jumps (e.g. speaker
          // skipped a section). For normal speech the interim already advanced
          // visual word-by-word; emitting here would add an unwanted extra word
          // at the moment the speaker pauses.
          if (nextCommitted > visualRef.current + 2) {
            emitVisual(nextCommitted);
          }

          // Reset interim tracking for the next utterance.
          prevInterimLenRef.current = 0;
          setInterim("");
        } else {
          interimText = t;
        }
      }

      if (!interimText) return;
      setInterim(interimText);

      // ── Interim: stream each newly detected word immediately ──────────────
      // Chrome accumulates words in the interim transcript. We process only
      // the words that are NEW since the last event (the delta).
      const currWords = normalizeSpeech(interimText);
      const prevLen   = prevInterimLenRef.current;

      for (let i = prevLen; i < currWords.length; i++) {
        const next = tryMatchWord(wordsRef.current, visualRef.current, currWords[i]);
        if (next !== null) emitVisual(next);
      }

      // ── Anchor verification ───────────────────────────────────────────────
      // The LAST word the STT recognised is the most reliable position anchor.
      // After processing the delta, verify the cursor stopped right after it.
      // If it didn't (the word slipped by because the cursor was behind earlier
      // words in the same delta), give it one more pass from the updated cursor.
      if (currWords.length > prevLen) {
        const lastWord = currWords[currWords.length - 1];
        const curPos   = visualRef.current;
        const atCursor = wordsRef.current[curPos - 1];
        if (!atCursor || wordSimilarity(atCursor, lastWord) < MATCH_THRESHOLD) {
          // Last word didn't land — try again from where the cursor is now.
          const anchor = tryMatchWord(wordsRef.current, curPos, lastWord);
          if (anchor !== null) emitVisual(anchor);
        }
      }

      prevInterimLenRef.current = currWords.length;
    };

    recRef.current = rec;
    try { rec.start(); } catch { /* noop */ }

    return () => {
      try { rec.onend = null; rec.stop(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, [enabled, emitVisual]);

  return { listening, interim, error };
}
