import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/lib/teleprompter-store";
import {
  Play, Pause, RotateCcw, Maximize, Minimize, FlipHorizontal, FlipVertical,
  Mic, MicOff, Plus, Minus, Rows3, MoveHorizontal, SkipBack, SkipForward, Settings2,
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
  onVoiceSettings?: () => void;
}

export function ControlBar({
  settings, playing, onPlay, onReset, onRewind, onAdvance, onFullscreen, isFullscreen,
  onChange, speechSupported, listening, singleRow = false, onVoiceSettings,
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
  const containerClass = singleRow
    ? "inline-flex max-w-full flex-nowrap items-center gap-3 whitespace-nowrap rounded-xl border border-border/60 bg-card/80 px-3 py-2 backdrop-blur"
    : "flex max-w-full flex-col gap-2 overflow-x-hidden rounded-2xl border border-border/60 bg-card/80 px-3 py-3 backdrop-blur md:flex-row md:flex-wrap md:items-center md:gap-3 md:rounded-xl md:py-2";

  return (
    <div className={containerClass}>
      <div className="grid grid-cols-4 gap-2 sm:flex sm:items-center sm:gap-1">
        <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={onRewind} title="Rewind">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button size="sm" variant={playing ? "secondary" : "default"} className="w-full sm:w-auto" onClick={onPlay}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span className="ml-1.5 font-mono text-xs">{playing ? "Pause" : "Play"}</span>
        </Button>
        <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={onAdvance} title="Advance">
          <SkipForward className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={onReset} title="Reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="hidden h-8 w-px bg-border/60 md:block" />

      <div className="flex min-w-0 items-center gap-2 md:min-w-[180px]">
        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Speed</Label>
        <Slider
          value={[settings.speed]}
          min={20} max={240} step={5}
          onValueChange={(v) => onChange({ speed: v[0] })}
          className="flex-1 md:w-28"
        />
        <span className="w-8 font-mono text-xs text-primary tabular-nums">{settings.speed}</span>
      </div>

      <div className="flex items-center justify-between gap-2 md:justify-start">
        <Label className="mr-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Size</Label>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => num("fontSize", -4, 18, 160)}>
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-8 text-center font-mono text-xs tabular-nums">{settings.fontSize}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => num("fontSize", 4, 18, 160)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="hidden h-8 w-px bg-border/60 md:block" />

      <div className="flex flex-wrap items-center gap-2">
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
        <Button
          size="sm" variant={settings.lightbox ? "default" : "ghost"}
          onClick={() => onChange({ lightbox: !settings.lightbox })}
          title="Lightbox (horizontal) mode"
        >
          {settings.lightbox ? <MoveHorizontal className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
          <span className="ml-1.5 font-mono text-[10px] uppercase">{settings.lightbox ? "Lightbox" : "Vertical"}</span>
        </Button>

        <div className="flex min-w-[136px] flex-1 items-center gap-2 rounded-lg border border-primary/30 px-2 py-1">
          {settings.followMode ? (
            listening ? <Mic className="h-4 w-4 animate-pulse text-primary" /> : <Mic className="h-4 w-4 text-muted-foreground" />
          ) : <MicOff className="h-4 w-4 text-muted-foreground" />}
          <Label htmlFor="follow" className="font-mono text-[10px] uppercase tracking-wider">Follow</Label>
          <Switch
            id="follow"
            checked={settings.followMode}
            disabled={!speechSupported}
            onCheckedChange={(v) => onChange({ followMode: v })}
          />
        </div>

        {speechSupported && (
          <Button
            size="sm"
            variant={settings.voiceCommandsEnabled ? "default" : "ghost"}
            onClick={() => onChange({ voiceCommandsEnabled: !settings.voiceCommandsEnabled })}
            title="Voice commands settings"
          >
            <Mic className="h-4 w-4" />
            <span className="ml-1.5 font-mono text-[10px] uppercase">Commands</span>
          </Button>
        )}

        {onVoiceSettings && speechSupported && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onVoiceSettings}
            title="Configure voice commands"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        )}

        <div className="hidden md:block md:flex-1" />
        <Button size="sm" variant="ghost" className="w-full sm:w-auto md:ml-auto md:w-auto" onClick={onFullscreen}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          <span className="ml-1.5 font-mono text-[10px] uppercase">{isFullscreen ? "Exit" : "Fullscreen"}</span>
        </Button>
      </div>
    </div>
  );
}
