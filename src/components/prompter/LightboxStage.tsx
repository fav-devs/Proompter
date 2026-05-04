import { useEffect, useMemo, useRef, useState } from "react";
import type { Settings } from "@/lib/teleprompter-store";

interface Props {
  text: string;
  settings: Settings;
  playing: boolean;
  followWordIndex: number | null;
}

// Lightbox horizontal mode — single line, words slide right→left like a stock ticker / marquee
export function LightboxStage({ text, settings, playing, followWordIndex }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [offset, setOffset] = useState(0);
  const targetRef = useRef(0);
  const lastTs = useRef<number | null>(null);

  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  useEffect(() => {
    setOffset(0);
    targetRef.current = 0;
  }, [text]);

  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      const container = containerRef.current;
      const track = trackRef.current;
      if (container && track) {
        const max = Math.max(0, track.scrollWidth - container.clientWidth * 0.5);
        if (settings.followMode && followWordIndex != null) {
          const idx = Math.min(followWordIndex, words.length - 1);
          const el = wordRefs.current[idx];
          if (el) {
            const focus = container.clientWidth * 0.4;
            targetRef.current = Math.min(max, Math.max(0, el.offsetLeft - focus));
          }
        } else if (playing) {
          // horizontal speed scales with font size
          const speedPx = settings.speed * 1.6;
          targetRef.current = Math.min(max, targetRef.current + speedPx * dt);
        }
        setOffset((prev) => {
          const diff = targetRef.current - prev;
          if (Math.abs(diff) < 0.5) return targetRef.current;
          return prev + diff * Math.min(1, dt * 6);
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); lastTs.current = null; };
  }, [playing, settings.speed, settings.followMode, followWordIndex, words.length]);

  const transform = useMemo(() => {
    const sx = settings.mirrorH ? -1 : 1;
    const sy = settings.mirrorV ? -1 : 1;
    return `translateX(${-offset}px) scale(${sx}, ${sy})`;
  }, [offset, settings.mirrorH, settings.mirrorV]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-background paper-grain rounded-none"
    >
      {/* center focus marker */}
      <div className="pointer-events-none absolute top-0 bottom-0 z-10" style={{ left: "40%" }}>
        <div className="h-full w-px bg-primary/40" style={{ boxShadow: "0 0 24px hsl(var(--primary) / 0.5)" }} />
      </div>
      <div className="absolute inset-0 flex items-center scroll-mask-x">
        <div
          ref={trackRef}
          className="whitespace-nowrap pl-[40vw] pr-[60vw]"
          style={{
            transform,
            transformOrigin: "center center",
            fontSize: settings.fontSize * 1.4,
            lineHeight: 1,
            willChange: "transform",
            color: "hsl(var(--secondary))",
            fontFamily: "Merriweather, Georgia, serif",
          }}
        >
          {words.map((w, i) => {
            const isCurrent = settings.followMode && followWordIndex != null && i === followWordIndex - 1;
            const isPast = settings.followMode && followWordIndex != null && i < followWordIndex - 1;
            return (
              <span
                key={i}
                ref={(el) => (wordRefs.current[i] = el)}
                className={
                  "inline-block px-3 " +
                  (isCurrent
                    ? "text-primary text-glow"
                    : isPast
                    ? "text-muted-foreground/40"
                    : "text-glow-soft")
                }
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
