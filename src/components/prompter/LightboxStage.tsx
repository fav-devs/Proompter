import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
  const focusRatio = settings.focusPosition / 100;

  useEffect(() => {
    setOffset(0);
    targetRef.current = 0;
  }, [text]);

  useEffect(() => {
    const onSeek = (event: Event) => {
      const detail = (event as CustomEvent<{ direction: "backward" | "forward" }>).detail;
      const container = containerRef.current;
      const track = trackRef.current;
      if (!detail || !container || !track) return;

      const max = Math.max(0, track.scrollWidth - container.clientWidth * (1 - focusRatio + 0.1));
      const step = container.clientWidth * 0.28;
      const direction = detail.direction === "backward" ? -1 : 1;
      const nextOffset = Math.min(max, Math.max(0, targetRef.current + step * direction));

      targetRef.current = nextOffset;
      setOffset(nextOffset);

      const focusX = nextOffset + container.clientWidth * focusRatio;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < words.length; i++) {
        const el = wordRefs.current[i];
        if (!el) continue;
        const centerX = el.offsetLeft + el.offsetWidth / 2;
        const distance = Math.abs(centerX - focusX);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i + 1;
        }
      }

      window.dispatchEvent(new CustomEvent("prompter:cursor", { detail: { index: bestIndex } }));
    };

    window.addEventListener("prompter:seek", onSeek);
    return () => window.removeEventListener("prompter:seek", onSeek);
  }, [focusRatio, words]);

  const updateFocusPosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    const next = Math.min(72, Math.max(22, percent));
    window.dispatchEvent(new CustomEvent("prompter:focus-position", { detail: { position: next } }));
  }, []);

  const onFocusPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFocusPosition(event.clientX);
  }, [updateFocusPosition]);

  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      const container = containerRef.current;
      const track = trackRef.current;
      if (container && track) {
        const max = Math.max(0, track.scrollWidth - container.clientWidth * (1 - focusRatio + 0.1));
        if (settings.followMode && followWordIndex != null) {
          const idx = Math.min(Math.max(0, followWordIndex - 1), words.length - 1);
          const el = wordRefs.current[idx];
          if (el) {
            const focus = container.clientWidth * focusRatio;
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
  }, [playing, settings.speed, settings.followMode, followWordIndex, words.length, focusRatio]);

  const transform = useMemo(() => {
    const sx = settings.mirrorH ? -1 : 1;
    const sy = settings.mirrorV ? -1 : 1;
    return `translateX(${-offset}px) scale(${sx}, ${sy})`;
  }, [offset, settings.mirrorH, settings.mirrorV]);
  const recentPastWordStart = followWordIndex == null ? -1 : Math.max(0, followWordIndex - 18);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl bg-card paper-grain"
    >
      <div
        className="group absolute bottom-0 top-0 z-20 flex w-5 -translate-x-1/2 cursor-col-resize justify-center"
        style={{ left: `${settings.focusPosition}%` }}
        onPointerDown={onFocusPointerDown}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFocusPosition(event.clientX);
        }}
        title="Drag focus line"
      >
        <div className="pointer-events-none h-full w-px bg-primary/45 transition-colors group-hover:bg-primary" style={{ boxShadow: "0 0 24px hsl(var(--primary) / 0.5)" }} />
        <div className="pointer-events-none absolute top-3 rounded border border-primary/35 bg-background/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          Drag
        </div>
      </div>
      <div className="absolute inset-0 flex items-center scroll-mask-x">
        <div
          ref={trackRef}
          className="whitespace-nowrap"
          style={{
            transform,
            transformOrigin: "center center",
            paddingLeft: `${settings.focusPosition}vw`,
            paddingRight: `${100 - settings.focusPosition + 20}vw`,
            fontSize: settings.fontSize * 1.4,
            lineHeight: 1,
            willChange: "transform",
            color: "hsl(var(--secondary))",
            fontFamily: "Merriweather, Georgia, serif",
          }}
        >
          {words.map((w, i) => {
            const isCurrent =
              settings.followMode &&
              settings.followHighlight &&
              followWordIndex != null &&
              i === followWordIndex - 1;
            const isPast =
              settings.followMode &&
              settings.followHighlight &&
              followWordIndex != null &&
              i < followWordIndex - 1 &&
              i >= recentPastWordStart;
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
