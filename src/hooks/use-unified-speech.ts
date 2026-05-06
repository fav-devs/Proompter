import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceWordByWord,
  findNearbyCursorAnchor,
  normalizeSpeech,
  tryMatchWord,
} from "@/lib/speech-follow";
import {
  findMatchingCommand,
  loadVoiceConfig,
  transcriptHasWakeWord,
} from "@/lib/voice-commands";

interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  isFinal: boolean;
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
interface SpeechRecognitionErrorEventLike { error: string }
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
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

export function useUnifiedSpeech(opts: {
  followEnabled: boolean;
  commandsEnabled: boolean;
  scriptText: string;
  onWordIndex: (index: number) => void;
  onCommand: (action: string) => void;
  onWakeWord?: (wakeWord: string) => void;
}) {
  const {
    followEnabled,
    commandsEnabled,
    scriptText,
    onWordIndex,
    onCommand,
    onWakeWord,
  } = opts;
  const enabled = followEnabled || commandsEnabled;
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wordsRef = useRef<string[]>([]);
  const committedRef = useRef(0);
  const visualRef = useRef(0);
  const prevInterimWordsRef = useRef<string[]>([]);
  const lastWakeAtRef = useRef(0);

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    wordsRef.current = normalizeSpeech(scriptText);
    committedRef.current = 0;
    visualRef.current = 0;
    prevInterimWordsRef.current = [];
    setInterim("");
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

  const handleCommandTranscript = useCallback((transcript: string, isFinal: boolean) => {
    if (!commandsEnabled) return false;

    const config = { ...loadVoiceConfig(), enabled: true };
    const hasWakeWord = transcriptHasWakeWord(transcript, config.wakeWord);

    if (hasWakeWord) {
      const now = Date.now();
      if (now - lastWakeAtRef.current > 1200) {
        lastWakeAtRef.current = now;
        onWakeWord?.(config.wakeWord);
      }
    }

    if (!isFinal) return hasWakeWord;

    const matchedCommand = findMatchingCommand(transcript, config);
    if (matchedCommand) onCommand(matchedCommand.action);

    return Boolean(matchedCommand) || hasWakeWord;
  }, [commandsEnabled, onCommand, onWakeWord]);

  const handleFinalFollowTranscript = useCallback((transcript: string) => {
    if (!followEnabled) return;

    const spokenWords = normalizeSpeech(transcript);
    const nextCommitted = advanceWordByWord(
      wordsRef.current, committedRef.current, spokenWords,
    );
    committedRef.current = nextCommitted;

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

    prevInterimWordsRef.current = [];
    setInterim("");
  }, [emitVisual, followEnabled]);

  const handleInterimFollowTranscript = useCallback((transcript: string) => {
    if (!followEnabled) return;

    setInterim(transcript);

    const currWords = normalizeSpeech(transcript);
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
  }, [emitVisual, followEnabled]);

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

    const isMobileSpeech = isMobileSpeechEnvironment();
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    rec.continuous = !isMobileSpeech;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onstart = () => setListening(true);
    rec.onend = () => {
      if (!enabled) {
        setListening(false);
        return;
      }
      if (isMobileSpeech) {
        setListening(false);
        return;
      }
      restartTimer = setTimeout(() => {
        restartTimer = null;
        try { rec.start(); } catch { setListening(false); }
      }, 150);
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(event.error || "speech error");
    };
    rec.onresult = (event) => {
      const interimParts: string[] = [];

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal && i >= event.resultIndex) {
          const handledCommand = handleCommandTranscript(transcript, true);
          if (!handledCommand) handleFinalFollowTranscript(transcript);
        } else if (!result.isFinal) {
          handleCommandTranscript(transcript, false);
          interimParts.push(transcript);
        }
      }

      const interimText = interimParts.join(" ");
      if (!interimText) return;

      const commandConfig = { ...loadVoiceConfig(), enabled: commandsEnabled };
      if (commandsEnabled && transcriptHasWakeWord(interimText, commandConfig.wakeWord)) return;
      handleInterimFollowTranscript(interimText);
    };

    recRef.current = rec;
    try { rec.start(); } catch { /* noop */ }

    return () => {
      if (restartTimer !== null) clearTimeout(restartTimer);
      rec.onend = null;
      try { rec.stop(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, [
    commandsEnabled,
    enabled,
    handleCommandTranscript,
    handleFinalFollowTranscript,
    handleInterimFollowTranscript,
  ]);

  return { listening, interim, error, setCursor };
}
