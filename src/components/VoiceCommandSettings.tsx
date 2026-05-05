import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import {
  loadVoiceConfig,
  saveVoiceConfig,
  defaultCommands,
  type VoiceCommandsConfig,
  type VoiceCommand,
} from "@/lib/voice-commands";

interface Props {
  onConfigChange?: (config: VoiceCommandsConfig) => void;
}

export function VoiceCommandSettings({ onConfigChange }: Props) {
  const [config, setConfig] = useState<VoiceCommandsConfig>(() => loadVoiceConfig());

  useEffect(() => {
    saveVoiceConfig(config);
    onConfigChange?.(config);
  }, [config, onConfigChange]);

  const updateWakeWord = (newWakeWord: string) => {
    setConfig((c) => ({
      ...c,
      wakeWord: newWakeWord,
      commands: c.commands.map((cmd) => ({ ...cmd, wakeWord: newWakeWord })),
    }));
  };

  const updateCommand = (id: string, command: string) => {
    setConfig((c) => ({
      ...c,
      commands: c.commands.map((cmd) => (cmd.id === id ? { ...cmd, command } : cmd)),
    }));
  };

  const deleteCommand = (id: string) => {
    setConfig((c) => ({
      ...c,
      commands: c.commands.filter((cmd) => cmd.id !== id),
    }));
  };

  const addCommand = () => {
    const newCmd: VoiceCommand = {
      id: `cmd-${Date.now()}`,
      wakeWord: config.wakeWord,
      command: "new-command",
      action: "play",
    };
    setConfig((c) => ({
      ...c,
      commands: [...c.commands, newCmd],
    }));
  };

  const resetToDefaults = () => {
    setConfig((c) => ({
      ...c,
      commands: defaultCommands,
    }));
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Wake Word
        </label>
        <Input
          value={config.wakeWord}
          onChange={(e) => updateWakeWord(e.target.value)}
          placeholder="e.g., prompter"
          className="h-11 font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Say this word before a command, e.g., "{config.wakeWord} play"
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Commands
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={resetToDefaults}
            className="w-full text-xs sm:w-auto"
          >
            Reset defaults
          </Button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {config.commands.map((cmd) => (
            <div key={cmd.id} className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/20 p-3 sm:flex-row sm:items-center">
              <span className="min-w-fit font-mono text-xs text-muted-foreground">
                {config.wakeWord}
              </span>
              <Input
                value={cmd.command}
                onChange={(e) => updateCommand(cmd.id, e.target.value)}
                placeholder="command"
                className="h-10 flex-1 font-mono text-sm sm:h-7 sm:text-xs"
              />
              <span className="min-w-fit rounded border border-primary/20 px-2 py-1 font-mono text-xs text-primary sm:border-0 sm:px-0 sm:py-0">
                {cmd.action}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 self-end sm:h-7 sm:w-7 sm:self-auto"
                onClick={() => deleteCommand(cmd.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={addCommand}
          className="h-10 w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add command
        </Button>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <p className="font-mono text-xs text-muted-foreground">
          <strong>Example:</strong> Say "{config.wakeWord} restart" to restart the prompter
        </p>
      </div>
    </div>
  );
}
