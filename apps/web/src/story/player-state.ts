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
}

export type PlayerAction =
  | { type: 'toggle' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'sceneEnded' }
  | { type: 'toggleMute' };

export function initialPlayerState(sceneCount: number): PlayerState {
  if (!Number.isInteger(sceneCount) || sceneCount < 1) throw new Error(`a story needs at least one scene, got ${sceneCount}`);
  return { index: 0, sceneCount, status: 'idle', muted: false, run: 0 };
}

function goTo(state: PlayerState, index: number, status: PlayStatus = state.status): PlayerState {
  return { ...state, index, status, run: state.run + 1 };
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  const last = state.sceneCount - 1;
  switch (action.type) {
    case 'toggle':
      if (state.status === 'playing') return { ...state, status: 'paused' };
      // Over: start again from the first scene.
      if (state.status === 'ended') return goTo(state, 0, 'playing');
      return { ...state, status: 'playing' };
    case 'pause':
      return state.status === 'playing' ? { ...state, status: 'paused' } : state;
    case 'next':
      if (state.status === 'ended') return state;
      return state.index < last ? goTo(state, state.index + 1) : { ...state, status: 'ended' };
    case 'prev':
      if (state.status === 'ended') return goTo(state, last, 'paused');
      // On the first scene: start it again.
      return goTo(state, Math.max(0, state.index - 1));
    case 'sceneEnded':
      // A late end event of a scene the reader already left or paused changes nothing.
      if (state.status !== 'playing') return state;
      return state.index < last ? goTo(state, state.index + 1) : { ...state, status: 'ended' };
    case 'toggleMute':
      return { ...state, muted: !state.muted };
  }
}
