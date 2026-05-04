import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API types (browsers vary)
type SR = any;

const getRecognition = (): SR | null => {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
};

export const isSpeechSupported = () => {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
};

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);

export function useSpeechFollow(opts: {
  enabled: boolean;
  scriptText: string;
  onWordIndex: (index: number) => void;
}) {
  const { enabled, scriptText, onWordIndex } = opts;
  const recRef = useRef<SR | null>(null);
  const wordsRef = useRef<string[]>([]);
  const cursorRef = useRef(0);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    wordsRef.current = normalize(scriptText);
    cursorRef.current = 0;
  }, [scriptText]);

  const advance = useCallback(
    (heard: string) => {
      const heardWords = normalize(heard);
      if (!heardWords.length) return;
      const words = wordsRef.current;
      let cursor = cursorRef.current;
      const WINDOW = 12;
      for (const hw of heardWords) {
        const end = Math.min(words.length, cursor + WINDOW);
        let matched = -1;
        for (let i = cursor; i < end; i++) {
          if (words[i] === hw || words[i].startsWith(hw) || hw.startsWith(words[i])) {
            matched = i;
            break;
          }
        }
        if (matched >= 0) cursor = matched + 1;
      }
      if (cursor !== cursorRef.current) {
        cursorRef.current = cursor;
        onWordIndex(cursor);
      }
    },
    [onWordIndex]
  );

  useEffect(() => {
    if (!enabled) {
      recRef.current?.stop?.();
      recRef.current = null;
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
    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error || "speech error");
    };
    rec.onresult = (event: any) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0].transcript;
        if (r.isFinal) advance(t);
        else interimText += t;
      }
      if (interimText) {
        setInterim(interimText);
        advance(interimText);
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
