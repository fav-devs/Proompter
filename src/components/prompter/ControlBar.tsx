import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/lib/teleprompter-store";
import {
  Play, Pause, RotateCcw, Maximize, Minimize, FlipHorizontal, FlipVertical,
  Mic, MicOff, Plus, Minus, Rows3, MoveHorizontal, SkipBack, SkipForward, Settings2,
  Eye, EyeOff,
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
    ? "inline-flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap rounded-xl border border-border/60 bg-card/85 p-1.5 shadow-sm"
    : "flex max-w-full flex-wrap items-center gap-1.5 overflow-x-hidden rounded-xl border border-border/60 bg-card/85 p-1.5 shadow-sm";
  const groupClass = "flex min-h-9 items-center gap-0.5 rounded-lg border border-border/45 bg-background/35 p-0.5";
  const iconButtonClass = "h-8 w-8 shrink-0";
  const quietIconButtonClass = `${iconButtonClass} text-muted-foreground data-[state=on]:text-primary`;

  return (
    <div className={containerClass}>
      <div className={groupClass}>
        <Button size="icon" variant="ghost" className={iconButtonClass} onClick={onRewind} title="Rewind">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={playing ? "secondary" : "default"}
          className="h-8 shrink-0 px-3"
          onClick={onPlay}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span className="ml-1.5 font-mono text-[11px]">{playing ? "Pause" : "Play"}</span>
        </Button>
        <Button size="icon" variant="ghost" className={iconButtonClass} onClick={onAdvance} title="Advance">
          <SkipForward className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className={iconButtonClass} onClick={onReset} title="Reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-9 min-w-[170px] flex-1 items-center gap-2 rounded-lg border border-border/45 bg-background/35 px-2 py-1 sm:max-w-[230px]">
        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Spd</Label>
        <Slider
          value={[settings.speed]}
          min={20} max={240} step={5}
          onValueChange={(v) => onChange({ speed: v[0] })}
          className="min-w-0 flex-1"
        />
        <span className="w-8 text-right font-mono text-[11px] text-primary tabular-nums">{settings.speed}</span>
      </div>

      <div className={groupClass}>
        <Label className="px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Size</Label>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => num("fontSize", -4, 18, 160)} title="Decrease text size">
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-7 text-center font-mono text-[11px] tabular-nums">{settings.fontSize}</span>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => num("fontSize", 4, 18, 160)} title="Increase text size">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className={groupClass}>
        <Button
          size="icon" variant={settings.mirrorH ? "default" : "ghost"}
          className={quietIconButtonClass}
          onClick={() => onChange({ mirrorH: !settings.mirrorH })}
          title="Mirror horizontal"
        >
          <FlipHorizontal className="h-4 w-4" />
        </Button>
        <Button
          size="icon" variant={settings.mirrorV ? "default" : "ghost"}
          className={quietIconButtonClass}
          onClick={() => onChange({ mirrorV: !settings.mirrorV })}
          title="Mirror vertical"
        >
          <FlipVertical className="h-4 w-4" />
        </Button>
        <Button
          size="icon" variant={settings.lightbox ? "default" : "ghost"}
          className={quietIconButtonClass}
          onClick={() => onChange({ lightbox: !settings.lightbox })}
          title="Lightbox (horizontal) mode"
        >
          {settings.lightbox ? <MoveHorizontal className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
        </Button>
      </div>

      {speechSupported && (
        <div className="flex min-h-9 items-center gap-1 rounded-lg border border-primary/25 bg-background/35 px-2 py-1">
          <span className="flex h-7 w-7 items-center justify-center" title={listening ? "Listening" : "Follow mode"}>
            {settings.followMode ? (
              listening ? <Mic className="h-4 w-4 animate-pulse text-primary" /> : <Mic className="h-4 w-4 text-muted-foreground" />
            ) : <MicOff className="h-4 w-4 text-muted-foreground" />}
          </span>
          <Label htmlFor="follow" className="sr-only">Follow mode</Label>
          <Switch
            id="follow"
            checked={settings.followMode}
            disabled={!speechSupported}
            onCheckedChange={(v) => onChange({ followMode: v })}
          />
          <Button
            size="icon"
            variant={settings.followHighlight ? "ghost" : "secondary"}
            className="h-8 w-8 shrink-0"
            disabled={!settings.followMode}
            onClick={() => onChange({ followHighlight: !settings.followHighlight })}
            title={settings.followHighlight ? "Hide cursor highlight" : "Show cursor highlight"}
          >
            {settings.followHighlight ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        {speechSupported && (
          <Button
            size="icon"
            variant={settings.voiceCommandsEnabled ? "default" : "ghost"}
            className={iconButtonClass}
            onClick={() => onChange({ voiceCommandsEnabled: !settings.voiceCommandsEnabled })}
            title="Voice commands"
          >
            <Mic className="h-4 w-4" />
          </Button>
        )}

        {onVoiceSettings && speechSupported && (
          <Button
            size="icon"
            variant="ghost"
            className={iconButtonClass}
            onClick={onVoiceSettings}
            title="Configure voice commands"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        )}

        <Button size="icon" variant="ghost" className={iconButtonClass} onClick={onFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
