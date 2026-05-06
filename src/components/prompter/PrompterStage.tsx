import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Settings } from "@/lib/teleprompter-store";

interface Props {
  text: string;
  settings: Settings;
  playing: boolean;
  followWordIndex: number | null;
  onWordCount?: (n: number) => void;
}

// Vertical scrolling teleprompter
export function PrompterStage({ text, settings, playing, followWordIndex, onWordCount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [offset, setOffset] = useState(0);
  const targetRef = useRef(0);
  const lastTs = useRef<number | null>(null);

  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const wordOnly = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  useEffect(() => {
    onWordCount?.(wordOnly.length);
  }, [wordOnly.length, onWordCount]);

  // Reset on text change
  useEffect(() => {
    setOffset(0);
    targetRef.current = 0;
  }, [text]);

  useEffect(() => {
    const onSeek = (event: Event) => {
      const detail = (event as CustomEvent<{ direction: "backward" | "forward" }>).detail;
      const container = containerRef.current;
      const content = contentRef.current;
      if (!detail || !container || !content) return;

      const max = Math.max(0, content.scrollHeight - container.clientHeight * 0.45);
      const step = container.clientHeight * 0.28;
      const direction = detail.direction === "backward" ? -1 : 1;
      const nextOffset = Math.min(max, Math.max(0, targetRef.current + step * direction));

      targetRef.current = nextOffset;
      setOffset(nextOffset);

      const focusY = nextOffset + container.clientHeight * 0.38;
      let cursor = 0;
      let bestCursor = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < words.length; i++) {
        if (/^\s+$/.test(words[i])) continue;
        cursor++;
        const el = wordRefs.current[i];
        if (!el) continue;
        const centerY = el.offsetTop + el.offsetHeight / 2;
        const distance = Math.abs(centerY - focusY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCursor = cursor;
        }
      }

      window.dispatchEvent(new CustomEvent("prompter:cursor", { detail: { index: bestCursor } }));
    };

    window.addEventListener("prompter:seek", onSeek);
    return () => window.removeEventListener("prompter:seek", onSeek);
  }, [words]);

  // Animation loop
  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;

      const container = containerRef.current;
      const content = contentRef.current;
      if (container && content) {
        const max = Math.max(0, content.scrollHeight - container.clientHeight * 0.45);

        if (settings.followMode && followWordIndex != null) {
          // center the currently matched word instead of the next word ahead
          const idx = Math.min(Math.max(0, followWordIndex - 1), wordOnly.length - 1);
          let n = -1;
          let domIdx = -1;
          for (let i = 0; i < words.length; i++) {
            if (!/^\s+$/.test(words[i])) {
              n++;
              if (n === idx) { domIdx = i; break; }
            }
          }
          const el = wordRefs.current[domIdx];
          if (el) {
            const focus = container.clientHeight * 0.38;
            targetRef.current = Math.min(max, Math.max(0, el.offsetTop - focus));
          }
        } else if (playing) {
          targetRef.current = Math.min(max, targetRef.current + settings.speed * dt);
        }

        // smooth lerp toward target
        setOffset((prev) => {
          const diff = targetRef.current - prev;
          if (Math.abs(diff) < 0.5) return targetRef.current;
          return prev + diff * Math.min(1, dt * 6);
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastTs.current = null;
    };
  }, [playing, settings.speed, settings.followMode, followWordIndex, words, wordOnly.length]);

  const transform = useMemo(() => {
    const sx = settings.mirrorH ? -1 : 1;
    const sy = settings.mirrorV ? -1 : 1;
    return `translateY(${-offset}px) scale(${sx}, ${sy})`;
  }, [offset, settings.mirrorH, settings.mirrorV]);

  // current word for highlight (follow mode)
  const highlightDomIdx = useMemo(() => {
    if (!settings.followMode || !settings.followHighlight || followWordIndex == null) return -1;
    let n = -1;
    for (let i = 0; i < words.length; i++) {
      if (!/^\s+$/.test(words[i])) {
        n++;
        if (n === followWordIndex - 1) return i;
      }
    }
    return -1;
  }, [followWordIndex, settings.followHighlight, settings.followMode, words]);

  let wIdx = -1;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl bg-card paper-grain stage-vignette"
      style={{ boxShadow: "var(--shadow-stage)" }}
    >
      {/* focus line */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-10 border-t border-primary/40"
        style={{ top: "38%", boxShadow: "0 0 24px hsl(var(--primary) / 0.4)" }}
      />
      <div
        ref={contentRef}
        className="scroll-mask"
        style={{
          transform,
          transformOrigin: "center center",
          paddingInline: "clamp(1rem, 8vw, 6rem)",
          paddingTop: "38vh",
          paddingBottom: "42vh",
          fontSize: settings.fontSize,
          lineHeight: settings.lineHeight,
          willChange: "transform",
          fontFamily: "Merriweather, Georgia, serif",
          color: "hsl(var(--secondary))",
        }}
      >
        {words.map((w, i) => {
          const isSpace = /^\s+$/.test(w);
          if (!isSpace) wIdx++;
          const isCurrent = i === highlightDomIdx;
          const isPast =
            settings.followMode &&
            settings.followHighlight &&
            followWordIndex != null &&
            wIdx < followWordIndex - 1 &&
            !isSpace;
          return (
            <span
              key={i}
              ref={(el) => (wordRefs.current[i] = el)}
              className={
                isCurrent
                  ? "text-primary text-glow"
                  : isPast
                  ? "text-muted-foreground/50"
                  : "text-glow-soft"
              }
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
}
