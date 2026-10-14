# Proompter

**A speech-aware teleprompter that runs in your browser.**

Write or import a script, then read it from a smooth auto-scrolling stage. Or let Proompter listen and follow your voice instead. No account, no install, and your scripts stay on your device.

**[Try it live → proompter.favdevs.me](https://proompter.favdevs.me)**

<!-- Add screenshots to /screenshots and uncomment:
![Desktop view](./screenshots/desktop.png)
![Mobile view](./screenshots/mobile.png)
-->

## Why Proompter

Most teleprompter apps either scroll at a fixed speed and leave you chasing the text, or lock features behind an account. Proompter is built for people who move between desktop prep and phone-based delivery — speakers, creators, educators, worship leaders — and need the script to stay readable and the controls to stay out of the way.

## Features

**Teleprompter stage**
- Auto-scroll with adjustable speed, font size, and line height
- Draggable focus line to set where the reading position sits
- Structured mode that preserves your line breaks and formatting
- Lightbox mode: a horizontal layout for physical teleprompter rigs

**Speech Follow**
- Listens as you speak and scrolls to your current position
- Word-level cursor shows exactly where you are
- Runs independently of auto-scroll, so you set the pace

**Voice commands**
- Say the wake word (default: "prompter") followed by `play`, `pause`, `restart`, `forward`, or `back`
- Fuzzy matching tolerates mispronunciations
- Wake word and commands are configurable in settings

**Display**
- Horizontal and vertical mirroring for beam-splitter glass
- True fullscreen on desktop, immersive overlay on mobile
- Screen Wake Lock keeps the display on while you read

**Script library**
- Multiple scripts with create, rename, and delete
- Import `.txt` / `.md` files, export as `.txt`
- Saved to `localStorage`

**Remote sync**
- One device hosts, another joins with a 6-character room code
- The host pushes the current script and the client pulls it on demand

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / pause |
| `←` / `→` | Seek backward / forward |
| `↑` / `↓` | Increase / decrease speed |
| `F` | Toggle fullscreen |
| `M` | Toggle horizontal mirror |
| `R` | Reset to top |

### Browser support

Speech Follow and voice commands need the Web Speech API, which is available in Chrome and Edge. Everything else works in any modern browser.

## Getting started

Requires Node.js 18+.

```bash
git clone https://github.com/fav-devs/Proompter.git
cd Proompter
npm install
npm run dev
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm test` | Run tests |
| `npm run lint` | Lint the codebase |

## Self-hosting

Proompter is a static Vite app plus one serverless function, and is set up for Vercel (`vercel.json` is included). Deploy it there as-is, or serve the `dist/` folder from any static host.

If you don't host `api/sync.ts`, everything works except remote sync.

**About remote sync:** the endpoint is a minimal relay. Rooms are kept in memory, expire after two hours, and aren't authenticated — anyone with a room code can read that room's script. It's meant for casual device-to-device use, not for sensitive content. Because storage is per-instance memory, it may also drop rooms between serverless invocations.

## Tech stack

React 18, TypeScript, Vite (SWC), Tailwind CSS, shadcn/ui (Radix UI), Web Speech API, Vitest.

## Project structure

```
api/
  sync.ts                      Serverless relay for remote sync
src/
  pages/Index.tsx              Root page: layout, state, keyboard bindings
  components/
    prompter/                  ControlBar, PrompterStage, LightboxStage,
                               ScriptLibrary, RemoteModal
    VoiceCommandSettings.tsx   Voice command configuration
  hooks/
    use-unified-speech.ts      Single SpeechRecognition instance for follow + commands
  lib/
    teleprompter-store.ts      localStorage persistence
    speech-follow.ts           Word matching for follow mode
    voice-commands.ts          Wake word detection and fuzzy command matching
    remote-sync.ts             useRemoteHost / useRemoteClient hooks
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## License

[MIT](./LICENSE) © fav-devs
