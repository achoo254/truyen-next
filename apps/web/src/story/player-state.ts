/**
 * The story player's state: which scene is on, and whether the story is waiting to start, playing, paused or
 * over. Pure, so every button's effect is pinned by tests; the timing (voice or timer) lives in the component.
 */

export type PlayStatus = 'idle' | 'playing' | 'paused' | 'ended';

export interface PlayerState {
  index: number;
  sceneCount: number;
  status: PlayStatus;
  muted: boolean;
  /** Bumped every time a scene starts from its beginning, so its clock and media restart even on the same index. */
  run: number;
  /** Which way the last page turn went: the book turns its leaf the same way. */
  direction: TurnDirection;
  /** Auto-turn is off and the scene has ended: the book waits on its last line until the reader turns. */
  holding: boolean;
}

export type TurnDirection = 'forward' | 'back';

export type PlayerAction =
  | { type: 'toggle' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'prev' }
  /** The scene's voice or clock reached its end; with `autoTurn` false the book waits instead of turning. */
  | { type: 'sceneEnded'; autoTurn?: boolean }
  | { type: 'toggleMute' }
  /** Opens the story at a scene (the scene list, "continue where I left off"), keeping play or pause. */
  | { type: 'goTo'; index: number }
  /** Play, and nothing if already playing (the lock screen's and the headset's play button). */
  | { type: 'play' }
  /** The story recording reached scene `index` by itself (played on, or sought from the lock screen). */
  | { type: 'trackAt'; index: number }
  /** The story recording played to its end. */
  | { type: 'finished' };

export function initialPlayerState(sceneCount: number): PlayerState {
  if (!Number.isInteger(sceneCount) || sceneCount < 1) throw new Error(`a story needs at least one scene, got ${sceneCount}`);
  return { index: 0, sceneCount, status: 'idle', muted: false, run: 0, direction: 'forward', holding: false };
}

function goTo(state: PlayerState, index: number, status: PlayStatus = state.status): PlayerState {
  return { ...state, index, status, run: state.run + 1, direction: index < state.index || state.status === 'ended' ? 'back' : 'forward', holding: false };
}

const ended = (state: PlayerState): PlayerState => ({ ...state, status: 'ended', direction: 'forward', holding: false });

/** On from the scene the book waits on: the reader turned the page, so the story plays again. */
const onFromHold = (state: PlayerState): PlayerState =>
  state.index < state.sceneCount - 1 ? goTo(state, state.index + 1, 'playing') : ended(state);

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  const last = state.sceneCount - 1;
  switch (action.type) {
    case 'toggle':
      if (state.holding) return onFromHold(state);
      if (state.status === 'playing') return { ...state, status: 'paused' };
      // Over: start again from the first scene.
      if (state.status === 'ended') return { ...goTo(state, 0, 'playing'), direction: 'forward' };
      return { ...state, status: 'playing' };
    case 'pause':
      return state.status === 'playing' ? { ...state, status: 'paused' } : state;
    case 'next':
      if (state.status === 'ended') return state;
      if (state.holding) return onFromHold(state);
      return state.index < last ? goTo(state, state.index + 1) : ended(state);
    case 'prev':
      if (state.status === 'ended') return goTo(state, last, 'paused');
      // On the first scene: start it again.
      return goTo(state, Math.max(0, state.index - 1));
    case 'sceneEnded':
      // A late end event of a scene the reader already left or paused changes nothing.
      if (state.status !== 'playing') return state;
      if (state.index >= last) return ended(state);
      if (action.autoTurn === false) return { ...state, status: 'paused', holding: true };
      return goTo(state, state.index + 1);
    case 'toggleMute':
      return { ...state, muted: !state.muted };
    case 'play':
      return state.status === 'playing' ? state : playerReducer(state, { type: 'toggle' });
    case 'trackAt':
      if (!Number.isInteger(action.index) || action.index < 0 || action.index > last || action.index === state.index) return state;
      return goTo(state, action.index, state.status === 'ended' ? 'paused' : state.status);
    case 'finished':
      return state.status === 'playing' ? ended(state) : state;
    case 'goTo': {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index > last) return state;
      const status = state.status === 'ended' ? 'paused' : state.status;
      return goTo(state, action.index, status);
    }
  }
}
