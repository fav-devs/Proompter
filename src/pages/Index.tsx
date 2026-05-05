import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { VoiceCommandSettings } from "@/components/VoiceCommandSettings";
import { ControlBar } from "@/components/prompter/ControlBar";
import { LightboxStage } from "@/components/prompter/LightboxStage";
import { PrompterStage } from "@/components/prompter/PrompterStage";
import { ScriptLibrary } from "@/components/prompter/ScriptLibrary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { isSpeechSupported, useSpeechFollow } from "@/hooks/use-speech-follow";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import {
  loadScripts,
  loadSettings,
  saveScripts,
  saveSettings,
  type Script,
  type Settings,
} from "@/lib/teleprompter-store";

const Index = () => {
  const [scripts, setScripts] = useState<Script[]>(() => loadScripts());
  const [activeId, setActiveId] = useState<string>(() => loadScripts()[0]?.id ?? "");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [playing, setPlaying] = useState(false);
  const [followIdx, setFollowIdx] = useState<number | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState("read");
  const [resetTick, setResetTick] = useState(0);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const active = useMemo(
    () => scripts.find((s) => s.id === activeId) ?? scripts[0],
    [scripts, activeId],
  );

  useEffect(() => { saveScripts(scripts); }, [scripts]);
  useEffect(() => { saveSettings(settings); }, [settings]);
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

  const seekPrompter = useCallback((direction: "backward" | "forward") => {
    setFollowIdx(null);
    window.dispatchEvent(new CustomEvent("prompter:seek", { detail: { direction } }));
  }, []);

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
      if (e.key.toLowerCase() === "r") {
        setPlaying(false);
        setFollowIdx(null);
        window.dispatchEvent(new Event("prompter:reset"));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seekPrompter, toggleFs]);

  useEffect(() => {
    const handleReset = () => setResetTick((t) => t + 1);
    window.addEventListener("prompter:reset", handleReset);
    return () => window.removeEventListener("prompter:reset", handleReset);
  }, []);

  const updateBody = (body: string) => {
    if (!active) return;
    setScripts((arr) =>
      arr.map((s) => (s.id === active.id ? { ...s, body, updatedAt: Date.now() } : s)),
    );
  };

  const renameActive = (id: string, title: string) => {
    setScripts((arr) => arr.map((s) => (s.id === id ? { ...s, title } : s)));
  };

  const createScript = () => {
    const script: Script = {
      id: crypto.randomUUID(),
      title: "Untitled",
      body: "",
      updatedAt: Date.now(),
    };
    setScripts((arr) => [script, ...arr]);
    setActiveId(script.id);
    setMobilePanel("script");
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
    const script: Script = {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.(txt|md)$/i, ""),
      body: text,
      updatedAt: Date.now(),
    };
    setScripts((arr) => [script, ...arr]);
    setActiveId(script.id);
    setMobilePanel("script");
    toast.success(`Imported "${script.title}"`);
  };

  const exportActive = () => {
    if (!active) return;
    const blob = new Blob([active.body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${active.title || "script"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!active) return null;

  const wordCount = active.body.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / 140));

  const resetPrompter = () => {
    setPlaying(false);
    setFollowIdx(null);
    setResetTick((t) => t + 1);
  };

  const renderListeningBox = (className: string) =>
    settings.followMode ? (
      <div className={className}>
        <span className={listening ? "text-primary" : "text-amber-500"}>
          {listening ? "● LISTENING" : "○ MIC IDLE"}
        </span>
        <span className="ml-3 italic opacity-70">{interim || "Say a word from the script to advance…"}</span>
      </div>
    ) : null;

  const stagePanel = (
    <div
      ref={stageWrapRef}
      className={
        "relative bg-background " +
        (isFs ? "h-dvh w-screen" : "min-h-[52dvh] overflow-hidden rounded-2xl sm:min-h-[420px] xl:h-full xl:min-h-0")
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
            "pointer-events-none absolute left-4 right-4 top-4 z-20 rounded-lg border border-primary/20 bg-card/70 px-3 py-2 font-mono text-[11px] text-muted-foreground backdrop-blur",
          )}
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-center">
            <div className="pointer-events-auto max-w-full">
              <ControlBar
                settings={settings}
                playing={playing}
                onPlay={() => setPlaying((p) => !p)}
                onReset={resetPrompter}
                onRewind={() => seekPrompter("backward")}
                onAdvance={() => seekPrompter("forward")}
                onFullscreen={toggleFs}
                isFullscreen={isFs}
                onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                speechSupported={speechSupported}
                listening={listening}
                singleRow
              />
            </div>
          </div>
        </>
      )}
    </div>
  );

  const editorPanel = (
    <div className="flex min-h-[38dvh] min-w-0 flex-col gap-3 rounded-2xl border border-border/40 bg-card/60 p-3 sm:min-h-[320px] xl:h-full xl:min-h-0">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Script</span>
        <span className="font-mono text-[10px] text-muted-foreground">{active.body.length} ch</span>
      </div>
      <Textarea
        value={active.body}
        onChange={(e) => updateBody(e.target.value)}
        placeholder="Write or paste your script…"
        className="min-h-[30dvh] flex-1 resize-none border-border/30 bg-background/40 font-mono text-base leading-relaxed focus-visible:ring-primary/50 sm:min-h-0 sm:text-sm"
      />
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button variant="ghost" size="sm" onClick={() => setPlaying(true)}>Play</Button>
        <Button variant="ghost" size="sm" onClick={resetPrompter}>Reset</Button>
        <Button variant="ghost" size="sm" className="col-span-2 sm:ml-auto" onClick={toggleFs}>Fullscreen</Button>
      </div>
    </div>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="border-b border-border/40 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 sm:items-center sm:gap-3">
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
              <SheetContent side="left" className="w-full max-w-[22rem] p-0">
                <div className="flex h-full flex-col gap-3 overflow-hidden p-4 sm:p-6 sm:pt-4">
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

            <Sparkles className="mt-1 h-5 w-5 shrink-0 text-primary sm:mt-0" />
            <div className="min-w-0">
              <h1 className="font-serif text-xl tracking-tight sm:text-2xl">
                Pro<span className="text-primary">ompter</span>
              </h1>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:hidden">
                {speechSupported ? "Speech-aware teleprompter" : "Teleprompter"}
              </p>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:hidden">
              <span><span className="text-primary tabular-nums">{wordCount}</span> words</span>
              <span>~<span className="text-primary tabular-nums">{minutes}</span> min</span>
            </div>
          </div>

          <div className="hidden items-center gap-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:flex">
            <span>{speechSupported ? "Speech-aware teleprompter" : "Teleprompter"}</span>
            <span><span className="text-primary tabular-nums">{wordCount}</span> words</span>
            <span>~<span className="text-primary tabular-nums">{minutes}</span> min</span>
            <span className="hidden md:inline">SPACE play · ←→ seek · ↑↓ speed · F fullscreen · M mirror · R reset</span>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4 lg:p-6">
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

        <section className="flex min-h-0 w-full min-w-0 flex-col gap-3 overflow-y-auto xl:overflow-hidden">
          <div className="sticky top-0 z-10 -mx-1 bg-background/85 px-1 pb-1 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:pb-0">
            <ControlBar
              settings={settings}
              playing={playing}
              onPlay={() => setPlaying((p) => !p)}
              onReset={resetPrompter}
              onRewind={() => seekPrompter("backward")}
              onAdvance={() => seekPrompter("forward")}
              onFullscreen={toggleFs}
              isFullscreen={isFs}
              onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
              speechSupported={speechSupported}
              listening={listening}
              onVoiceSettings={() => setIsVoiceSettingsOpen(true)}
            />
          </div>

          {renderListeningBox("rounded-lg border border-primary/20 bg-card/40 px-3 py-2 font-mono text-[11px] text-muted-foreground")}

          {isMobile ? (
            <Tabs value={mobilePanel} onValueChange={setMobilePanel} className="min-h-0 flex-1">
              <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-card/70 p-1">
                <TabsTrigger value="read" className="font-mono text-[11px] uppercase tracking-wider">Read</TabsTrigger>
                <TabsTrigger value="script" className="font-mono text-[11px] uppercase tracking-wider">Script</TabsTrigger>
              </TabsList>
              <TabsContent value="read" className="mt-3 min-h-0">{stagePanel}</TabsContent>
              <TabsContent value="script" className="mt-3 min-h-0">{editorPanel}</TabsContent>
            </Tabs>
          ) : (
            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)] xl:overflow-hidden">
              {stagePanel}
              {editorPanel}
            </div>
          )}
        </section>
      </div>

      <Dialog open={isVoiceSettingsOpen} onOpenChange={setIsVoiceSettingsOpen}>
        <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
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
