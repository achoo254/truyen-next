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
}

export type TurnDirection = 'forward' | 'back';

export type PlayerAction =
  | { type: 'toggle' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'sceneEnded' }
  | { type: 'toggleMute' }
  /** Opens the story at a scene (the scene list, "continue where I left off"), keeping play or pause. */
  | { type: 'goTo'; index: number };

export function initialPlayerState(sceneCount: number): PlayerState {
  if (!Number.isInteger(sceneCount) || sceneCount < 1) throw new Error(`a story needs at least one scene, got ${sceneCount}`);
  return { index: 0, sceneCount, status: 'idle', muted: false, run: 0, direction: 'forward' };
}

function goTo(state: PlayerState, index: number, status: PlayStatus = state.status): PlayerState {
  return { ...state, index, status, run: state.run + 1, direction: index < state.index || state.status === 'ended' ? 'back' : 'forward' };
}

const ended = (state: PlayerState): PlayerState => ({ ...state, status: 'ended', direction: 'forward' });

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  const last = state.sceneCount - 1;
  switch (action.type) {
    case 'toggle':
      if (state.status === 'playing') return { ...state, status: 'paused' };
      // Over: start again from the first scene.
      if (state.status === 'ended') return { ...goTo(state, 0, 'playing'), direction: 'forward' };
      return { ...state, status: 'playing' };
    case 'pause':
      return state.status === 'playing' ? { ...state, status: 'paused' } : state;
    case 'next':
      if (state.status === 'ended') return state;
      return state.index < last ? goTo(state, state.index + 1) : ended(state);
    case 'prev':
      if (state.status === 'ended') return goTo(state, last, 'paused');
      // On the first scene: start it again.
      return goTo(state, Math.max(0, state.index - 1));
    case 'sceneEnded':
      // A late end event of a scene the reader already left or paused changes nothing.
      if (state.status !== 'playing') return state;
      return state.index < last ? goTo(state, state.index + 1) : ended(state);
    case 'toggleMute':
      return { ...state, muted: !state.muted };
    case 'goTo': {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index > last) return state;
      const status = state.status === 'ended' ? 'paused' : state.status;
      return goTo(state, action.index, status);
    }
  }
}
