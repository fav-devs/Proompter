export type VoiceCommand = {
  id: string;
  wakeWord: string;
  command: string;
  action: "play" | "pause" | "restart" | "seek-forward" | "seek-backward" | "toggle-follow";
};

export type VoiceCommandsConfig = {
  enabled: boolean;
  wakeWord: string; // e.g., "prompter"
  commands: VoiceCommand[];
};

const defaultWakeWord = "prompter";

export const defaultCommands: VoiceCommand[] = [
  {
    id: "cmd-restart",
    wakeWord: defaultWakeWord,
    command: "restart",
    action: "restart",
  },
  {
    id: "cmd-play",
    wakeWord: defaultWakeWord,
    command: "play",
    action: "play",
  },
  {
    id: "cmd-pause",
    wakeWord: defaultWakeWord,
    command: "pause",
    action: "pause",
  },
  {
    id: "cmd-forward",
    wakeWord: defaultWakeWord,
    command: "forward",
    action: "seek-forward",
  },
  {
    id: "cmd-back",
    wakeWord: defaultWakeWord,
    command: "back",
    action: "seek-backward",
  },
];

export const defaultVoiceConfig: VoiceCommandsConfig = {
  enabled: false,
  wakeWord: defaultWakeWord,
  commands: defaultCommands,
};

const VOICE_CONFIG_KEY = "teleprompter.voice-commands.v1";

export function loadVoiceConfig(): VoiceCommandsConfig {
  try {
    const raw = localStorage.getItem(VOICE_CONFIG_KEY);
    if (!raw) return defaultVoiceConfig;
    return { ...defaultVoiceConfig, ...JSON.parse(raw) };
  } catch {
    return defaultVoiceConfig;
  }
}

export function saveVoiceConfig(config: VoiceCommandsConfig) {
  localStorage.setItem(VOICE_CONFIG_KEY, JSON.stringify(config));
}

// Fuzzy match — check if heard text starts with or contains phrase
export const fuzzyMatchCommand = (
  heardText: string,
  wakeWord: string,
  command: string,
  threshold = 0.7,
): boolean => {
  const heard = heardText.toLowerCase().trim();
  const wake = wakeWord.toLowerCase().trim();
  const cmd = command.toLowerCase().trim();
  const fullPhrase = `${wake} ${cmd}`;

  // Exact match
  if (heard === fullPhrase || heard.endsWith(fullPhrase)) return true;

  // Levenshtein distance check for typos
  const distance = levenshteinDistance(heard, fullPhrase);
  const maxDistance = Math.ceil(fullPhrase.length * (1 - threshold));
  return distance <= maxDistance;
};

// Simple levenshtein distance
const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  const prev = new Array<number>(b.length + 1);
  const next = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    next[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = next[j];
  }

  return prev[b.length];
};

export const findMatchingCommand = (
  heardText: string,
  config: VoiceCommandsConfig,
): VoiceCommand | null => {
  for (const cmd of config.commands) {
    if (fuzzyMatchCommand(heardText, config.wakeWord, cmd.command)) {
      return cmd;
    }
  }
  return null;
};
