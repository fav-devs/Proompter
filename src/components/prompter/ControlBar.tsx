import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/lib/teleprompter-store";
import {
  Play, Pause, RotateCcw, Maximize, Minimize, FlipHorizontal, FlipVertical,
  Mic, MicOff, Plus, Minus, Rows3, MoveHorizontal, SkipBack, SkipForward,
} from "lucide-react";

type NumericSettingKey = "fontSize" | "lineHeight" | "speed";

interface Props {
  settings: Settings;
  playing: boolean;
  onPlay: () => void;
  onReset: () => void;
  onRewind: () => void;
  onAdvance: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  onChange: (patch: Partial<Settings>) => void;
  speechSupported: boolean;
  listening: boolean;
  singleRow?: boolean;
}

export function ControlBar({
  settings, playing, onPlay, onReset, onRewind, onAdvance, onFullscreen, isFullscreen,
  onChange, speechSupported, listening, singleRow = false,
}: Props) {
  const num = (key: NumericSettingKey, delta: number, min: number, max: number) => {
    const nextValue = Math.min(max, Math.max(min, settings[key] + delta));

    if (key === "fontSize") {
      onChange({ fontSize: nextValue });
      return;
    }

    if (key === "lineHeight") {
      onChange({ lineHeight: nextValue });
      return;
    }

    onChange({ speed: nextValue });
  };
  return (
    <div
      className={
        "flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-3 py-2 backdrop-blur " +
        (singleRow ? "inline-flex max-w-full flex-nowrap whitespace-nowrap" : "flex-wrap")
      }
    >
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onRewind} title="Rewind">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button size="sm" variant={playing ? "secondary" : "default"} onClick={onPlay}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span className="ml-1.5 font-mono text-xs">{playing ? "Pause" : "Play"}</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={onAdvance} title="Advance">
          <SkipForward className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset} title="Reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-8 w-px bg-border/60" />

      {/* Speed */}
      <div className="flex items-center gap-2 min-w-[180px]">
        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Speed</Label>
        <Slider
          value={[settings.speed]}
          min={20} max={240} step={5}
          onValueChange={(v) => onChange({ speed: v[0] })}
          className="w-28"
        />
        <span className="font-mono text-xs text-primary tabular-nums w-8">{settings.speed}</span>
      </div>

      {/* Font size */}
      <div className="flex items-center gap-1">
        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Size</Label>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => num("fontSize", -4, 18, 160)}>
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="font-mono text-xs tabular-nums w-8 text-center">{settings.fontSize}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => num("fontSize", 4, 18, 160)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="h-8 w-px bg-border/60" />

      {/* Mirror */}
      <Button
        size="sm" variant={settings.mirrorH ? "default" : "ghost"}
        onClick={() => onChange({ mirrorH: !settings.mirrorH })}
        title="Mirror horizontal"
      >
        <FlipHorizontal className="h-4 w-4" />
      </Button>
      <Button
        size="sm" variant={settings.mirrorV ? "default" : "ghost"}
        onClick={() => onChange({ mirrorV: !settings.mirrorV })}
        title="Mirror vertical"
      >
        <FlipVertical className="h-4 w-4" />
      </Button>

      {/* Lightbox */}
      <Button
        size="sm" variant={settings.lightbox ? "default" : "ghost"}
        onClick={() => onChange({ lightbox: !settings.lightbox })}
        title="Lightbox (horizontal) mode"
      >
        {settings.lightbox ? <MoveHorizontal className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
        <span className="ml-1.5 font-mono text-[10px] uppercase">{settings.lightbox ? "Lightbox" : "Vertical"}</span>
      </Button>

      <div className="h-8 w-px bg-border/60" />

      {/* Follow Mode */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 px-2 py-1">
        {settings.followMode ? (
          listening ? <Mic className="h-4 w-4 text-primary animate-pulse" /> : <Mic className="h-4 w-4 text-muted-foreground" />
        ) : <MicOff className="h-4 w-4 text-muted-foreground" />}
        <Label htmlFor="follow" className="font-mono text-[10px] uppercase tracking-wider">Follow</Label>
        <Switch
          id="follow"
          checked={settings.followMode}
          disabled={!speechSupported}
          onCheckedChange={(v) => onChange({ followMode: v })}
        />
      </div>

      <div className="ml-auto" />
      <Button size="sm" variant="ghost" onClick={onFullscreen}>
        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        <span className="ml-1.5 font-mono text-[10px] uppercase">{isFullscreen ? "Exit" : "Fullscreen"}</span>
      </Button>
    </div>
  );
}
