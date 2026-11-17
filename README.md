# CLIP TO RICHES — AI Agent Handoff Pack

This package contains the project brief, master coding-agent prompt, specialist-agent prompts,
pixel-art asset prompts, architecture notes, and Phase 1 acceptance checklist.

## How to use

1. Create a new Git repository for the game.
2. Open the repository in Cursor, Claude Code, GitHub Copilot Agent, Windsurf, or another coding agent.
3. Give the agent `prompts/MASTER_DEVELOPMENT_PROMPT.md` first.
4. Ask it to inspect the repository and implement Phase 1 only.
5. Use the specialist prompts in `prompts/agents/` for isolated tasks.
6. Give the asset prompts in `prompts/assets/` to an image-generation tool.
7. Review every change and commit working milestones.

## Recommended stack

- TypeScript
- React
- Phaser 3
- Vite
- Zustand
- IndexedDB (for durable local saves)

## Important

This is a planning and prompt pack, not a finished game or a prebuilt source-code project.
Generated artwork must be checked for licensing and consistency before commercial release.

---

# Playable build — Phase 1

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + first-day loop tests (Vitest)
npm run typecheck  # strict TypeScript
npm run build      # production bundle in dist/
```

## Controls

Click objects in the room, or walk with ←/→ (A/D) and press E. Keys 1–4 open the
computer apps, P pauses, Esc closes a window / opens the menu.

## Architecture (file ownership)

| Area | Path | Notes |
| --- | --- | --- |
| Shared types | `src/types/game.ts` | GameState, Streamer, StreamMoment, ClipDraft, PublishedClip, … |
| Config / data | `src/data/` | Balance numbers, streamers, platforms, editor options, moment text — all tunable |
| Simulation | `src/sim/` | Pure, seeded, testable: streams & moments, clip quality, publishing, time/economy reducers |
| State | `src/state/store.ts` | Zustand store; actions only call `src/sim` reducers |
| Saves | `src/save/` | IndexedDB slots (autosave + 3), versioned envelopes, validation/repair, migrations, offline cap |
| Game world | `src/game/` | Phaser 3 bedroom scene; all pixel art is original and generated in code (`src/game/art`) |
| UI | `src/ui/` | HUD, dock, computer window (Streams, Clip Studio, Publish, Analytics), modals, title |
| Audio | `src/audio/sfx.ts` | Synthesized chiptune SFX (WebAudio), mutable from the menu |

All streamers, platforms and clips are fictional.
