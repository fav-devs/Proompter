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
          // align target so the followed word sits at ~38% from top
          const idx = Math.min(followWordIndex, wordOnly.length - 1);
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
    if (!settings.followMode || followWordIndex == null) return -1;
    let n = -1;
    for (let i = 0; i < words.length; i++) {
      if (!/^\s+$/.test(words[i])) {
        n++;
        if (n === followWordIndex - 1) return i;
      }
    }
    return -1;
  }, [followWordIndex, settings.followMode, words]);

  let wIdx = -1;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-card paper-grain stage-vignette rounded-2xl"
      style={{ boxShadow: "var(--shadow-stage)" }}
    >
      {/* focus line */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-10 border-t border-primary/40"
        style={{ top: "38%", boxShadow: "0 0 24px hsl(var(--primary) / 0.4)" }}
      />
      <div
        ref={contentRef}
        className="px-[12%] py-[40vh] scroll-mask"
        style={{
          transform,
          transformOrigin: "center center",
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
