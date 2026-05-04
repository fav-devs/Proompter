export type Script = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
};

const KEY = "teleprompter.scripts.v1";
const SETTINGS_KEY = "teleprompter.settings.v1";

export type Settings = {
  fontSize: number;
  lineHeight: number;
  speed: number; // px per second baseline
  mirrorH: boolean;
  mirrorV: boolean;
  followMode: boolean;
  lightbox: boolean; // horizontal scrolling mode
};

export const defaultSettings: Settings = {
  fontSize: 56,
  lineHeight: 1.45,
  speed: 80,
  mirrorH: false,
  mirrorV: false,
  followMode: false,
  lightbox: false,
};

export function loadScripts(): Script[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as Script[];
    return parsed.length ? parsed : seed();
  } catch {
    return seed();
  }
}

export function saveScripts(scripts: Script[]) {
  localStorage.setItem(KEY, JSON.stringify(scripts));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function seed(): Script[] {
  const sample: Script = {
    id: crypto.randomUUID(),
    title: "Welcome address",
    body:
`Welcome, everyone. The stage is set, the lights are warm.

This is your moment to deliver your message with clarity and conviction. Breathe. Engage your audience. Let your words flow as smoothly as ink on fine parchment.

Tap Play to start. Toggle Follow Mode and the prompter will listen and match your pace word by word. Switch on Lightbox for a full-screen left-to-right ribbon — perfect for landscape mobile.

When you are ready — begin.`,
    updatedAt: Date.now(),
  };
  saveScripts([sample]);
  return [sample];
}
