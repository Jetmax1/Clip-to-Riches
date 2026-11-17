// Zustand store. Owns the live GameState plus UI state, and exposes actions that
// delegate to the pure reducers in src/sim. No game formulas live here.

import { produce } from 'immer';
import { create } from 'zustand';
import { BALANCE } from '../data/balance';
import * as engine from '../sim/engine';
import { createNewGame } from '../sim/initialState';
import { offlineMinutes, saveSystem, type SlotId } from '../save/saveSystem';
import type { ActionResult, GameState, Notice, ObjectiveId, PlatformId } from '../types/game';
import { sfx } from '../audio/sfx';

export type PanelId = 'streams' | 'studio' | 'publish' | 'analytics';
export type ModalId = 'menu' | 'sleep' | 'fridge' | 'trends' | 'saves' | 'confirm-new' | 'offline' | 'help' | 'gameover';
export type Speed = 0 | 1 | 3;

/** Modals that freeze the game clock while open. */
export const PAUSING_MODALS: ReadonlySet<ModalId> = new Set<ModalId>(['menu', 'saves', 'help', 'confirm-new', 'offline', 'gameover']);

export interface Toast extends Notice {
  id: number;
}

export interface OfflineSummary {
  minutes: number;
  views: number;
  followers: number;
  cash: number;
  highlights: string[];
}

export interface UiState {
  screen: 'title' | 'game';
  panel: PanelId | null;
  modal: ModalId | null;
  saveMode: 'save' | 'load';
  selectedStreamerId: string | null;
  activeDraftId: string | null;
  publishDraftId: string | null;
  lastPublishedClipId: string | null;
  speed: Speed;
  /** Speed to return to when un-pausing. */
  resumeSpeed: 1 | 3;
  toasts: Toast[];
  offline: OfflineSummary | null;
  lastSavedAt: number | null;
  saveError: string | null;
}

export interface Store {
  game: GameState | null;
  ui: UiState;

  // lifecycle
  newGame: (seed?: number) => void;
  loadSlot: (slot: SlotId) => Promise<boolean>;
  saveSlot: (slot: SlotId, silent?: boolean) => Promise<boolean>;
  /** Saves first; only leaves the game if the save succeeded (or force is set). */
  quitToTitle: (force?: boolean) => Promise<boolean>;
  /** Synchronous best-effort snapshot for page unload. */
  emergencySave: () => void;

  // world
  tick: (realMs: number) => void;
  setSpeed: (speed: Speed) => void;
  togglePause: () => void;

  // gameplay
  scan: (streamerId: string, segIndex: number) => boolean;
  selectMoment: (streamerId: string, day: number, momentId: string) => boolean;
  updateDraft: (draftId: string, patch: engine.DraftPatch) => void;
  finishDraft: (draftId: string) => boolean;
  reopenDraft: (draftId: string) => boolean;
  discardDraft: (draftId: string) => boolean;
  publish: (draftId: string, platform: PlatformId) => boolean;
  sleep: () => boolean;
  buyDrink: () => boolean;
  petCat: () => boolean;
  completeObjective: (id: ObjectiveId) => void;

  // ui
  openPanel: (panel: PanelId | null) => void;
  openModal: (modal: ModalId | null, saveMode?: UiState['saveMode']) => void;
  selectStreamer: (id: string | null) => void;
  setActiveDraft: (id: string | null) => void;
  setPublishDraft: (id: string | null) => void;
  toast: (n: Notice) => void;
  dismissToast: (id: number) => void;
}

let toastId = 1;
let idCounter = 0;
const uid = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

const initialUi = (): UiState => ({
  screen: 'title',
  panel: null,
  modal: null,
  saveMode: 'save',
  selectedStreamerId: null,
  activeDraftId: null,
  publishDraftId: null,
  lastPublishedClipId: null,
  speed: 1,
  resumeSpeed: 1,
  toasts: [],
  offline: null,
  lastSavedAt: null,
  saveError: null,
});

let tickRemainder = 0;
let tickFailed = false;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTOSAVE_DEBOUNCE_MS = 1500;

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const useGame = create<Store>((set, get) => {
  const scheduleAutosave = (): void => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void get().saveSlot('autosave', true);
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const commit = (next: GameState): void => {
    try {
      set({ game: next });
    } catch (e) {
      // A faulty subscriber must not abort the action (e.g. skip the autosave that follows).
      console.error('[store] subscriber error', e);
    }
    if (next.gameOver && get().ui.modal !== 'gameover') set((s) => ({ ui: { ...s.ui, modal: 'gameover', panel: null } }));
  };

  /** Run a reducer against an immer draft. Commits only when the action succeeds. */
  const run = (fn: (s: GameState) => ActionResult, opts: { sound?: Parameters<typeof sfx.play>[0] } = {}): boolean => {
    const game = get().game;
    if (!game) return false;
    let result: ActionResult = { ok: false, reason: 'No game loaded.' };
    let next: GameState;
    try {
      next = produce(game, (d) => {
        result = fn(d);
      });
    } catch (e) {
      console.error('[store] action failed', e);
      sfx.play('error');
      get().toast({ tone: 'bad', text: `Something went wrong: ${errMsg(e)}` });
      return false;
    }
    const r = result as ActionResult;
    if (!r.ok) {
      sfx.play('error');
      get().toast({ tone: 'bad', text: r.reason });
      return false;
    }
    commit(next);
    if (opts.sound) sfx.play(opts.sound);
    r.notices.forEach((n) => get().toast(n));
    scheduleAutosave();
    return true;
  };

  return {
    game: null,
    ui: initialUi(),

    newGame: (seed) => {
      tickRemainder = 0;
      tickFailed = false;
      set({ game: createNewGame(seed), ui: { ...initialUi(), screen: 'game' } });
      sfx.play('open');
      void get().saveSlot('autosave', true);
    },

    loadSlot: async (slot) => {
      try {
        const res = await saveSystem.load(slot);
        if (!res.ok) {
          get().toast({ tone: 'bad', text: res.empty ? 'That slot is empty.' : `Could not load: ${res.error}` });
          sfx.play('error');
          return false;
        }
        tickRemainder = 0;
        tickFailed = false;
        let game = res.state;
        let offline: OfflineSummary | null = null;
        // Offline progress only for the autosave (Continue), and never for a paused game.
        // Manual slots are snapshots.
        const mins = slot === 'autosave' && !res.paused ? offlineMinutes(res.savedAt) : 0;
        if (mins >= BALANCE.offlineMinMinutes && !game.gameOver) {
          const before = { views: engine.totalViews(game), followers: engine.totalFollowers(game), cash: game.cash };
          let notices: Notice[] = [];
          game = produce(game, (d) => {
            notices = engine.advanceTime(d, mins);
          });
          const summary: OfflineSummary = {
            minutes: mins,
            views: engine.totalViews(game) - before.views,
            followers: engine.totalFollowers(game) - before.followers,
            cash: game.cash - before.cash,
            highlights: notices.filter((n) => n.tone !== 'info').map((n) => n.text).slice(0, 4),
          };
          if (summary.views > 0 || summary.followers > 0 || summary.cash !== 0 || summary.highlights.length) offline = summary;
        }
        const speed: Speed = res.paused ? 0 : 1;
        set({
          game,
          ui: { ...initialUi(), screen: 'game', speed, offline, modal: game.gameOver ? 'gameover' : offline ? 'offline' : null, lastSavedAt: res.savedAt },
        });
        if (res.repaired.length) get().toast({ tone: 'info', text: `Save repaired: ${res.repaired.slice(0, 3).join(', ')}${res.repaired.length > 3 ? '…' : ''}` });
        get().toast({ tone: 'good', text: slot === 'autosave' ? 'Autosave loaded.' : `Loaded ${slot.replace('slot', 'Slot ')}.` });
        sfx.play('open');
        return true;
      } catch (e) {
        console.error('[store] load failed', e);
        get().toast({ tone: 'bad', text: `That save could not be loaded: ${errMsg(e)}` });
        sfx.play('error');
        return false;
      }
    },

    saveSlot: async (slot, silent = false) => {
      if (!get().game) return false;
      const wasDone = get().game!.objectives['save-game'];
      if (slot !== 'autosave') get().completeObjective('save-game');
      try {
        const game = get().game!;
        await saveSystem.save(slot, game, get().ui.speed === 0);
        set((s) => ({ ui: { ...s.ui, lastSavedAt: Date.now(), saveError: null } }));
        if (!silent) {
          get().toast({ tone: 'good', text: slot === 'autosave' ? 'Saved.' : `Saved to ${slot.replace('slot', 'Slot ')}.` });
          sfx.play('coin');
        }
        return true;
      } catch (e) {
        const msg = errMsg(e);
        // Don't claim the "save your game" goal if the save failed.
        if (!wasDone && slot !== 'autosave') {
          const g = get().game;
          if (g) set({ game: produce(g, (d) => void (d.objectives['save-game'] = false)) });
        }
        set((s) => ({ ui: { ...s.ui, saveError: msg } }));
        get().toast({ tone: 'bad', text: `Save failed: ${msg}` });
        return false;
      }
    },

    quitToTitle: async (force = false) => {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      const saved = get().game ? await get().saveSlot('autosave', true) : true;
      if (!saved && !force) return false;
      set({ game: null, ui: { ...initialUi(), screen: 'title' } });
      return true;
    },

    emergencySave: () => {
      const g = get().game;
      if (g) saveSystem.saveEmergency(g, get().ui.speed === 0);
    },

    tick: (realMs) => {
      const { game, ui } = get();
      if (!game || ui.speed === 0 || game.gameOver || tickFailed) return;
      if (ui.modal && PAUSING_MODALS.has(ui.modal)) return;
      tickRemainder += (Math.max(0, realMs) * ui.speed) / BALANCE.realMsPerGameMinute;
      const whole = Math.floor(tickRemainder);
      if (whole < 1) return;
      tickRemainder -= whole;
      let notices: Notice[] = [];
      let next: GameState;
      try {
        next = produce(game, (d) => {
          notices = engine.advanceTime(d, whole);
        });
      } catch (e) {
        // Pause instead of throwing every frame.
        console.error('[store] tick failed', e);
        tickFailed = true;
        set((s) => ({ ui: { ...s.ui, speed: 0 } }));
        get().toast({ tone: 'bad', text: `The simulation hit an error and was paused: ${errMsg(e)}. Try loading another save.` });
        return;
      }
      commit(next);
      notices.forEach((n) => get().toast(n));
    },

    setSpeed: (speed) => {
      const s: Speed = speed === 3 ? 3 : speed === 1 ? 1 : 0;
      tickFailed = false;
      set((st) => ({ ui: { ...st.ui, speed: s, resumeSpeed: s === 0 ? st.ui.resumeSpeed : s } }));
      sfx.play('click');
    },
    togglePause: () => {
      const { speed, resumeSpeed } = get().ui;
      get().setSpeed(speed === 0 ? resumeSpeed : 0);
    },

    scan: (streamerId, segIndex) => run((s) => engine.scanSegment(s, streamerId, segIndex), { sound: 'scan' }),

    selectMoment: (streamerId, day, momentId) => {
      const id = uid('draft');
      const okd = run((s) => engine.startDraft(s, streamerId, day, momentId, id), { sound: 'open' });
      if (okd) set((s) => ({ ui: { ...s.ui, activeDraftId: id, panel: 'studio' } }));
      return okd;
    },

    updateDraft: (draftId, patch) => {
      const game = get().game;
      if (!game) return;
      try {
        commit(
          produce(game, (d) => {
            engine.updateDraft(d, draftId, patch);
          }),
        );
        scheduleAutosave();
      } catch (e) {
        console.error('[store] edit failed', e);
        get().toast({ tone: 'bad', text: `Could not apply that edit: ${errMsg(e)}` });
      }
    },

    finishDraft: (draftId) => {
      const okd = run((s) => engine.finishDraft(s, draftId), { sound: 'render' });
      if (okd) set((s) => ({ ui: { ...s.ui, publishDraftId: draftId } }));
      return okd;
    },
    reopenDraft: (draftId) => {
      const okd = run((s) => engine.reopenDraft(s, draftId), { sound: 'click' });
      if (okd) set((s) => ({ ui: { ...s.ui, activeDraftId: draftId, panel: 'studio' } }));
      return okd;
    },
    discardDraft: (draftId) => {
      const okd = run((s) => engine.discardDraft(s, draftId), { sound: 'click' });
      if (okd)
        set((s) => ({
          ui: {
            ...s.ui,
            activeDraftId: s.ui.activeDraftId === draftId ? null : s.ui.activeDraftId,
            publishDraftId: s.ui.publishDraftId === draftId ? null : s.ui.publishDraftId,
          },
        }));
      return okd;
    },

    publish: (draftId, platform) => {
      const clipId = uid('clip');
      const okd = run((s) => engine.publishClip(s, draftId, platform, clipId), { sound: 'publish' });
      if (okd) {
        const clip = get().game?.published.find((c) => c.id === clipId);
        if (clip?.factors.viral) sfx.play('viral');
        // Don't auto-advance to another clip: a double click must not publish a second one.
        set((s) => ({ ui: { ...s.ui, publishDraftId: null, lastPublishedClipId: clipId } }));
      }
      return okd;
    },

    sleep: () => {
      const okd = run((s) => engine.sleep(s), { sound: 'sleep' });
      if (okd) set((s) => ({ ui: { ...s.ui, modal: s.ui.modal === 'gameover' ? 'gameover' : null } }));
      return okd;
    },
    buyDrink: () => run((s) => engine.buyDrink(s), { sound: 'coin' }),
    petCat: () => run((s) => engine.petCat(s), { sound: 'purr' }),

    completeObjective: (id) => {
      const game = get().game;
      if (!game || game.objectives[id]) return;
      set({ game: produce(game, (d) => void engine.completeObjective(d, id)) });
    },

    openPanel: (panel) => {
      if (panel && get().game?.gameOver) return;
      set((s) => ({ ui: { ...s.ui, panel, modal: null } }));
      if (panel) {
        get().completeObjective('open-computer');
        if (panel === 'analytics') get().completeObjective('check-analytics');
      }
      sfx.play(panel ? 'open' : 'close');
    },
    openModal: (modal, saveMode) => {
      // After a game over only Load / New game are reachable; closing them returns to the game-over screen.
      if (get().game?.gameOver && modal !== 'saves' && modal !== 'confirm-new') modal = 'gameover';
      set((s) => ({ ui: { ...s.ui, modal, saveMode: saveMode ?? s.ui.saveMode } }));
      sfx.play(modal ? 'open' : 'close');
    },
    selectStreamer: (id) => {
      set((s) => ({ ui: { ...s.ui, selectedStreamerId: id } }));
      if (id) get().completeObjective('pick-streamer');
      sfx.play('click');
    },
    setActiveDraft: (id) => set((s) => ({ ui: { ...s.ui, activeDraftId: id } })),
    setPublishDraft: (id) => set((s) => ({ ui: { ...s.ui, publishDraftId: id, lastPublishedClipId: id ? null : s.ui.lastPublishedClipId } })),

    toast: (n) => {
      const t: Toast = { ...n, id: toastId++ };
      set((s) => ({ ui: { ...s.ui, toasts: [...s.ui.toasts.slice(-3), t] } }));
      setTimeout(() => get().dismissToast(t.id), n.tone === 'viral' ? 7000 : 4500);
      if (n.tone === 'level') sfx.play('level');
    },
    dismissToast: (id) => set((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } })),
  };
});
