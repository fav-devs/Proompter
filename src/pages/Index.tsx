import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PrompterStage } from "@/components/prompter/PrompterStage";
import { LightboxStage } from "@/components/prompter/LightboxStage";
import { ControlBar } from "@/components/prompter/ControlBar";
import { ScriptLibrary } from "@/components/prompter/ScriptLibrary";
import { VoiceCommandSettings } from "@/components/VoiceCommandSettings";
import {
  defaultSettings,
  loadScripts, loadSettings, saveScripts, saveSettings,
  type Script, type Settings,
} from "@/lib/teleprompter-store";
import { isSpeechSupported, useSpeechFollow } from "@/hooks/use-speech-follow";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Menu, Sparkles } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [scripts, setScripts] = useState<Script[]>(() => loadScripts());
  const [activeId, setActiveId] = useState<string>(() => loadScripts()[0]?.id ?? "");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [playing, setPlaying] = useState(false);
  const [followIdx, setFollowIdx] = useState<number | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const stageWrapRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => scripts.find((s) => s.id === activeId) ?? scripts[0],
    [scripts, activeId]
  );

  // Persist
  useEffect(() => { saveScripts(scripts); }, [scripts]);
  useEffect(() => { saveSettings(settings); }, [settings]);

  // Reset follow when script changes
  useEffect(() => { setFollowIdx(null); }, [activeId]);

  const speechSupported = isSpeechSupported();
  const { listening, interim, error: speechError } = useSpeechFollow({
    enabled: settings.followMode,
    scriptText: active?.body ?? "",
    onWordIndex: setFollowIdx,
  });

  useEffect(() => {
    if (speechError) toast.error(`Mic: ${speechError}`);
  }, [speechError]);

  useEffect(() => {
    if (settings.followMode && !speechSupported) {
      toast.error("Speech recognition not supported in this browser. Try Chrome or Edge.");
    }
  }, [settings.followMode, speechSupported]);

  // Voice commands
  const handleVoiceCommand = useCallback((action: string) => {
    switch (action) {
      case "play":
        setPlaying(true);
        break;
      case "pause":
        setPlaying(false);
        break;
      case "restart":
        setPlaying(false);
        setFollowIdx(null);
        window.dispatchEvent(new Event("prompter:reset"));
        toast.success("Restarted");
        break;
      case "seek-forward":
        seekPrompter("forward");
        break;
      case "seek-backward":
        seekPrompter("backward");
        break;
      case "toggle-follow":
        setSettings((s) => ({ ...s, followMode: !s.followMode }));
        break;
    }
  }, [seekPrompter]);

  useVoiceCommands({
    enabled: settings.voiceCommandsEnabled && speechSupported,
    onCommand: handleVoiceCommand,
  });

  // Fullscreen API
  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = useCallback(() => {
    if (!document.fullscreenElement) {
      stageWrapRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const seekPrompter = useCallback((direction: "backward" | "forward") => {
    setFollowIdx(null);
    window.dispatchEvent(new CustomEvent("prompter:seek", { detail: { direction } }));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === "ArrowLeft") { e.preventDefault(); seekPrompter("backward"); }
      if (e.key === "ArrowRight") { e.preventDefault(); seekPrompter("forward"); }
      if (e.key === "ArrowUp") setSettings((s) => ({ ...s, speed: Math.min(240, s.speed + 5) }));
      if (e.key === "ArrowDown") setSettings((s) => ({ ...s, speed: Math.max(20, s.speed - 5) }));
      if (e.key.toLowerCase() === "f") toggleFs();
      if (e.key.toLowerCase() === "m") setSettings((s) => ({ ...s, mirrorH: !s.mirrorH }));
      if (e.key.toLowerCase() === "r") { setPlaying(false); setFollowIdx(null); window.dispatchEvent(new Event("prompter:reset")); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seekPrompter, toggleFs]);

  // Reset trigger via remount key
  const [resetTick, setResetTick] = useState(0);
  useEffect(() => {
    const h = () => setResetTick((t) => t + 1);
    window.addEventListener("prompter:reset", h);
    return () => window.removeEventListener("prompter:reset", h);
  }, []);

  const updateBody = (body: string) => {
    if (!active) return;
    setScripts((arr) =>
      arr.map((s) => (s.id === active.id ? { ...s, body, updatedAt: Date.now() } : s))
    );
  };
  const renameActive = (id: string, title: string) => {
    setScripts((arr) => arr.map((s) => (s.id === id ? { ...s, title } : s)));
  };
  const createScript = () => {
    const s: Script = { id: crypto.randomUUID(), title: "Untitled", body: "", updatedAt: Date.now() };
    setScripts((arr) => [s, ...arr]);
    setActiveId(s.id);
  };
  const deleteScript = (id: string) => {
    setScripts((arr) => {
      const next = arr.filter((s) => s.id !== id);
      if (id === activeId && next[0]) setActiveId(next[0].id);
      return next.length ? next : [{ id: crypto.randomUUID(), title: "Untitled", body: "", updatedAt: Date.now() }];
    });
  };
  const importFile = async (file: File) => {
    const text = await file.text();
    const s: Script = {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.(txt|md)$/i, ""),
      body: text,
      updatedAt: Date.now(),
    };
    setScripts((arr) => [s, ...arr]);
    setActiveId(s.id);
    toast.success(`Imported "${s.title}"`);
  };
  const exportActive = () => {
    if (!active) return;
    const blob = new Blob([active.body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.title || "script"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!active) return null;

  const wordCount = active.body.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / 140));
  const renderListeningBox = (className: string) =>
    settings.followMode ? (
      <div className={className}>
        <span className={listening ? "text-primary" : "text-amber-500"}>
          {listening ? "● LISTENING" : "○ MIC IDLE"}
        </span>
        <span className="ml-3 italic opacity-70">{interim || "Say a word from the script to advance…"}</span>
      </div>
    ) : null;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="border-b border-border/40 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile library button */}
          <Sheet open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="lg:hidden"
                title="Scripts"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <div className="flex h-full flex-col gap-3 overflow-hidden p-6 pt-4">
                <ScriptLibrary
                  scripts={scripts}
                  activeId={active.id}
                  onSelect={(id) => {
                    setActiveId(id);
                    setIsLibraryOpen(false);
                  }}
                  onCreate={createScript}
                  onDelete={deleteScript}
                  onRename={renameActive}
                  onImport={importFile}
                  onExport={exportActive}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-xl sm:text-2xl tracking-tight">
            Pro<span className="text-primary">ompter</span>
          </h1>
          <span className="hidden sm:inline ml-2 sm:ml-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {speechSupported ? "Speech-aware teleprompter" : "Teleprompter"}
          </span>
          <div className="ml-auto flex items-center gap-2 sm:gap-4 font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="hidden xs:inline"><span className="text-primary tabular-nums">{wordCount}</span> words</span>
            <span className="hidden xs:inline">~<span className="text-primary tabular-nums">{minutes}</span> min</span>
            <span className="hidden md:inline">SPACE play · ←→ seek · ↑↓ speed · F fullscreen · M mirror · R reset</span>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:p-6">

        {/* Desktop Sidebar */}
        <aside className="hidden min-h-0 w-72 flex-col gap-3 overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-4 lg:flex">
          <ScriptLibrary
            scripts={scripts}
            activeId={active.id}
            onSelect={setActiveId}
            onCreate={createScript}
            onDelete={deleteScript}
            onRename={renameActive}
            onImport={importFile}
            onExport={exportActive}
          />
        </aside>

        {/* Workspace */}
        <section className="flex min-h-0 w-full min-w-0 flex-col gap-4 overflow-y-auto xl:overflow-hidden">
          <ControlBar
            settings={settings}
            playing={playing}
            onPlay={() => setPlaying((p) => !p)}
            onReset={() => { setPlaying(false); setFollowIdx(null); setResetTick((t) => t + 1); }}
            onRewind={() => seekPrompter("backward")}
            onAdvance={() => seekPrompter("forward")}
            onFullscreen={toggleFs}
            isFullscreen={isFs}
            onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            speechSupported={speechSupported}
            listening={listening}
            onVoiceSettings={() => setIsVoiceSettingsOpen(true)}
          />
          {renderListeningBox("rounded-lg border border-primary/20 bg-card/40 px-3 py-2 font-mono text-[11px] text-muted-foreground")}
          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)] xl:overflow-hidden">
            {/* Stage */}
            <div
              ref={stageWrapRef}
              className={
                "relative bg-background " +
                (isFs ? "h-dvh w-screen" : "min-h-[320px] overflow-hidden rounded-2xl xl:h-full xl:min-h-0")
              }
            >
              {settings.lightbox ? (
                <LightboxStage
                  key={resetTick + ":lb"}
                  text={active.body}
                  settings={settings}
                  playing={playing}
                  followWordIndex={settings.followMode ? followIdx : null}
                />
              ) : (
                <PrompterStage
                  key={resetTick + ":v"}
                  text={active.body}
                  settings={settings}
                  playing={playing}
                  followWordIndex={settings.followMode ? followIdx : null}
                />
              )}
              {isFs && (
                <>
                  {renderListeningBox(
                    "pointer-events-none absolute left-4 right-4 top-4 z-20 rounded-lg border border-primary/20 bg-card/70 px-3 py-2 font-mono text-[11px] text-muted-foreground backdrop-blur"
                  )}
                  <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-center">
                    <div className="pointer-events-auto max-w-full">
                      <ControlBar
                        settings={settings}
                        playing={playing}
                        onPlay={() => setPlaying((p) => !p)}
                        onReset={() => { setPlaying(false); setFollowIdx(null); setResetTick((t) => t + 1); }}
                        onRewind={() => seekPrompter("backward")}
                        onAdvance={() => seekPrompter("forward")}
                        onFullscreen={toggleFs}
                        isFullscreen={isFs}
                        onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                        speechSupported={speechSupported}
                        listening={listening}
                        onVoiceSettings={() => setIsVoiceSettingsOpen(true)}
                        singleRow
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Editor */}
            <div className="flex min-h-[320px] min-w-0 flex-col gap-2 rounded-2xl border border-border/40 bg-card/60 p-3 xl:h-full xl:min-h-0">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Script</span>
                <span className="font-mono text-[10px] text-muted-foreground">{active.body.length} ch</span>
              </div>
              <Textarea
                value={active.body}
                onChange={(e) => updateBody(e.target.value)}
                placeholder="Write or paste your script…"
                className="min-h-0 flex-1 resize-none border-border/30 bg-background/40 font-mono text-sm leading-relaxed focus-visible:ring-primary/50"
              />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPlaying(true)}>Play</Button>
                <Button variant="ghost" size="sm" onClick={() => { setPlaying(false); setFollowIdx(null); setResetTick((t) => t + 1); }}>Reset</Button>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={toggleFs}>Fullscreen</Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Voice Commands Dialog */}
      <Dialog open={isVoiceSettingsOpen} onOpenChange={setIsVoiceSettingsOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Voice Commands</DialogTitle>
          </DialogHeader>
          <VoiceCommandSettings />
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Index;
