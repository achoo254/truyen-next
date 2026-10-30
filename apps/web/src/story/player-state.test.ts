import { describe, expect, it } from 'vitest';
import { type PlayerAction, type PlayerState, initialPlayerState, playerReducer } from './player-state';

const run = (state: PlayerState, ...actions: PlayerAction['type'][]): PlayerState =>
  actions.reduce((s, type) => playerReducer(s, { type } as PlayerAction), state);

describe('story player state', () => {
  it('waits on the first scene, unmuted, until started', () => {
    expect(initialPlayerState(3)).toEqual({ index: 0, sceneCount: 3, status: 'idle', muted: false, run: 0 });
    expect(() => initialPlayerState(0)).toThrow(/at least one scene/);
  });

  it('plays the scenes in order and ends after the last', () => {
    let state = run(initialPlayerState(3), 'toggle');
    expect(state.status).toBe('playing');
    state = run(state, 'sceneEnded');
    expect([state.index, state.status, state.run]).toEqual([1, 'playing', 1]);
    state = run(state, 'sceneEnded', 'sceneEnded');
    expect([state.index, state.status]).toEqual([2, 'ended']);
    expect(run(state, 'sceneEnded')).toBe(state);
  });

  it('pauses and resumes on the same scene without restarting it', () => {
    const playing = run(initialPlayerState(3), 'toggle', 'sceneEnded');
    const paused = run(playing, 'toggle');
    expect([paused.index, paused.status, paused.run]).toEqual([1, 'paused', playing.run]);
    expect(run(paused, 'sceneEnded')).toBe(paused);
    expect(run(paused, 'pause')).toBe(paused);
    const resumed = run(paused, 'toggle');
    expect([resumed.index, resumed.status, resumed.run]).toEqual([1, 'playing', playing.run]);
  });

  it('steps to the next and previous scene, keeping play or pause', () => {
    const paused = run(initialPlayerState(3), 'toggle', 'pause', 'next');
    expect([paused.index, paused.status, paused.run]).toEqual([1, 'paused', 1]);
    const back = run(paused, 'prev', 'prev');
    expect([back.index, back.status, back.run]).toEqual([0, 'paused', 3]);
    expect(run(initialPlayerState(3), 'next').status).toBe('idle');
  });

  it('ends on next from the last scene; prev from the end goes back to the last scene, paused', () => {
    const ended = run(initialPlayerState(2), 'toggle', 'next', 'next');
    expect(ended.status).toBe('ended');
    expect(run(ended, 'next')).toBe(ended);
    expect(run(ended, 'prev')).toMatchObject({ index: 1, status: 'paused' });
  });

  it('starts again from the first scene when played after the end', () => {
    const again = run(initialPlayerState(2), 'toggle', 'sceneEnded', 'sceneEnded', 'toggle');
    expect(again).toMatchObject({ index: 0, status: 'playing' });
  });

  it('mutes and unmutes without touching playback', () => {
    const state = run(initialPlayerState(2), 'toggle', 'toggleMute');
    expect(state).toMatchObject({ muted: true, status: 'playing', index: 0, run: 0 });
    expect(run(state, 'toggleMute').muted).toBe(false);
  });
});
