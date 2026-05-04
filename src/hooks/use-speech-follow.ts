import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyFollowTranscript,
  createFollowProgressState,
  normalizeSpeech,
  type FollowProgressState,
} from "@/lib/speech-follow";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
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
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wordsRef = useRef<string[]>([]);
  const progressRef = useRef<FollowProgressState>(createFollowProgressState());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    wordsRef.current = normalizeSpeech(scriptText);
    progressRef.current = createFollowProgressState();
  }, [scriptText]);

  const commitState = useCallback(
    (nextState: FollowProgressState) => {
      const prevState = progressRef.current;
      progressRef.current = nextState;

      if (nextState.visibleCursor !== prevState.visibleCursor) {
        onWordIndex(nextState.visibleCursor);
      }
    },
    [onWordIndex]
  );

  const advance = useCallback(
    (heard: string, mode: "interim" | "final") => {
      const nextState = applyFollowTranscript({
        state: progressRef.current,
        scriptWords: wordsRef.current,
        heardText: heard,
        mode,
      });
      commitState(nextState);
    },
    [commitState]
  );

  useEffect(() => {
    if (!enabled) {
      recRef.current?.stop?.();
      recRef.current = null;
      progressRef.current = createFollowProgressState();
      setListening(false);
      setInterim("");
      return;
    }
    const rec = getRecognition();
    if (!rec) {
      setError("Speech recognition not supported in this browser");
      return;
    }
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      // auto-restart while enabled
      if (enabled) {
        try { rec.start(); } catch { /* noop */ }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error || "speech error");
    };
    rec.onresult = (event) => {
      const interimParts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0].transcript;
        if (r.isFinal) {
          advance(t, "final");
        } else {
          interimParts.push(t);
        }
      }
      const interimText = interimParts.join(" ").trim();
      if (interimText) {
        setInterim(interimText);
        advance(interimText, "interim");
      } else {
        setInterim("");
      }
    };

    recRef.current = rec;
    try { rec.start(); } catch { /* noop */ }

    return () => {
      try { rec.onend = null; rec.stop(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, [enabled, advance]);

  return { listening, interim, error };
}
