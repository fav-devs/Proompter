import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceWordByWord,
  findNearbyCursorAnchor,
  normalizeSpeech,
  tryMatchWord,
} from "@/lib/speech-follow";

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

const isMobileSpeechEnvironment = () => {
  if (typeof window === "undefined") return false;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const mobileUa = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  return coarsePointer || mobileUa;
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

  // Previous interim words, used to detect whether Chrome appended or rewrote
  // the live transcript between recognition events.
  const prevInterimWordsRef = useRef<string[]>([]);

  const [listening, setListening] = useState(false);
  const [interim, setInterim]     = useState("");
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    wordsRef.current       = normalizeSpeech(scriptText);
    committedRef.current   = 0;
    visualRef.current      = 0;
    prevInterimWordsRef.current = [];
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

  const setCursor = useCallback((index: number) => {
    const next = Math.max(0, Math.min(wordsRef.current.length, Math.floor(index)));
    committedRef.current = next;
    visualRef.current = next;
    prevInterimWordsRef.current = [];
    setInterim("");
  }, []);

  useEffect(() => {
    if (!enabled) {
      recRef.current?.stop?.();
      recRef.current = null;
      committedRef.current = 0;
      visualRef.current    = 0;
      prevInterimWordsRef.current = [];
      setListening(false);
      setInterim("");
      return;
    }

    const rec = getRecognition();
    if (!rec) { setError("Speech recognition not supported in this browser"); return; }
    const isMobileSpeech = isMobileSpeechEnvironment();

    rec.continuous     = !isMobileSpeech;
    rec.interimResults = true;
    rec.lang           = navigator.language || "en-US";

    rec.onstart = () => setListening(true);
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    rec.onend   = () => {
      if (!enabled) {
        setListening(false);
        return;
      }
      if (isMobileSpeech) {
        // Mobile browsers often surface a permission/banner prompt on every
        // recognition restart. Avoid the restart loop there and let follow mode
        // fall back to an idle state instead of repeatedly re-requesting access.
        setListening(false);
        return;
      }
      // Chrome needs a brief gap between sessions — calling start() synchronously
      // inside onend is sometimes silently ignored, leaving the mic "listening"
      // but not actually capturing. A short delay lets Chrome fully reset.
      // We intentionally do NOT flip listening=false here to keep the icon stable.
      restartTimer = setTimeout(() => {
        restartTimer = null;
        try { rec.start(); } catch { setListening(false); }
      }, 150);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error || "speech error");
    };

    rec.onresult = (event) => {
      const interimParts: string[] = [];

      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0].transcript;

        if (r.isFinal && i >= event.resultIndex) {
          // ── Final: authoritative correction pass ──────────────────────────
          // Run from committed (not visual) so we always correct from ground
          // truth even if interim drifted.
          const spokenWords = normalizeSpeech(t);
          const nextCommitted = advanceWordByWord(
            wordsRef.current, committedRef.current, spokenWords,
          );
          committedRef.current = nextCommitted;

          // First verify the live cursor against the LAST confirmed STT word.
          // This fixes the common case where interim overshot by 1-2 words:
          // anchor the cursor back to the actual last spoken word instead of
          // waiting for a larger committed/visual drift.
          const lastSpokenWord = spokenWords[spokenWords.length - 1];
          const anchoredCursor = findNearbyCursorAnchor(
            wordsRef.current,
            visualRef.current,
            lastSpokenWord,
            2,
          );

          if (anchoredCursor !== null && anchoredCursor !== visualRef.current) {
            emitVisual(anchoredCursor);
          } else if (nextCommitted !== visualRef.current) {
            emitVisual(nextCommitted);
          }

          // Reset interim tracking for the next utterance.
          prevInterimWordsRef.current = [];
          setInterim("");
        } else if (!r.isFinal) {
          interimParts.push(t);
        }
      }

      const interimText = interimParts.join(" ");
      if (!interimText) return;
      setInterim(interimText);

      // ── Interim: keep moving during long, unpaused speech ─────────────────
      // Chrome may append to one interim transcript, rewrite it, or roll the
      // active interim window forward before it emits a final result. Match both
      // from the last final cursor and the current visual cursor so the stage
      // keeps moving even when finalization waits for a pause.
      const currWords = normalizeSpeech(interimText);
      const prevWords = prevInterimWordsRef.current;
      const appendsPrevious =
        prevWords.length <= currWords.length &&
        prevWords.every((word, index) => word === currWords[index]);

      const fromCommitted = advanceWordByWord(wordsRef.current, committedRef.current, currWords);
      const fromVisual = advanceWordByWord(wordsRef.current, visualRef.current, currWords);
      const phraseCursor = Math.max(fromCommitted, fromVisual);
      if (phraseCursor > visualRef.current) emitVisual(phraseCursor);

      const deltaWords = appendsPrevious ? currWords.slice(prevWords.length) : currWords;
      if (deltaWords.length) {
        const deltaCursor = advanceWordByWord(wordsRef.current, visualRef.current, deltaWords);
        if (deltaCursor > visualRef.current) {
          emitVisual(deltaCursor);
        } else {
          for (const word of deltaWords) {
            const next = tryMatchWord(wordsRef.current, visualRef.current, word, 2);
            if (next !== null) emitVisual(next);
          }
        }
      }

      prevInterimWordsRef.current = currWords;
    };

    recRef.current = rec;
    try { rec.start(); } catch { /* noop */ }

    return () => {
      if (restartTimer !== null) clearTimeout(restartTimer);
      rec.onend = null;
      try { rec.stop(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, [enabled, emitVisual]);

  return { listening, interim, error, setCursor };
}
