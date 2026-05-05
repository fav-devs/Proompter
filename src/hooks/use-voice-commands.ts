import { useCallback, useEffect, useRef } from "react";
import {
  findMatchingCommand,
  loadVoiceConfig,
  type VoiceCommandsConfig,
} from "@/lib/voice-commands";

export function useVoiceCommands(opts: {
  enabled: boolean;
  onCommand: (action: string) => void;
}) {
  const { enabled, onCommand } = opts;
  const recRef = useRef<any>(null);
  const configRef = useRef<VoiceCommandsConfig>(loadVoiceConfig());

  // Update config when enabled changes
  useEffect(() => {
    configRef.current = loadVoiceConfig();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      recRef.current?.stop?.();
      recRef.current = null;
      return;
    }

    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    recRef.current = rec;

    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";

    rec.onstart = () => {
      // Voice commands listening started
    };

    rec.onend = () => {
      if (enabled) {
        try {
          rec.start();
        } catch {
          /* noop */
        }
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      console.error("Voice command error:", e.error);
    };

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript;
          const config = configRef.current;
          if (!config.enabled) return;

          const matchedCommand = findMatchingCommand(transcript, config);
          if (matchedCommand) {
            onCommand(matchedCommand.action);
          }
        }
      }
    };

    try {
      rec.start();
    } catch {
      /* already started or not supported */
    }

    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, [enabled, onCommand]);
}
