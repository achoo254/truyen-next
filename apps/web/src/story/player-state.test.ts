import { describe, expect, it } from 'vitest';
import { type PlayerAction, type PlayerState, initialPlayerState, playerReducer } from './player-state';

const run = (state: PlayerState, ...actions: PlayerAction['type'][]): PlayerState =>
  actions.reduce((s, type) => playerReducer(s, { type } as PlayerAction), state);

describe('story player state', () => {
  it('waits on the first scene, unmuted, until started', () => {
    expect(initialPlayerState(3)).toEqual({ index: 0, sceneCount: 3, status: 'idle', muted: false, run: 0, direction: 'forward', holding: false });
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

  it('remembers which way the page turned', () => {
    const forward = run(initialPlayerState(3), 'next', 'next');
    expect(forward.direction).toBe('forward');
    expect(run(forward, 'prev').direction).toBe('back');
    const over = run(forward, 'next');
    expect(over).toMatchObject({ status: 'ended', direction: 'forward' });
    expect(run(over, 'prev').direction).toBe('back');
    expect(run(over, 'toggle')).toMatchObject({ index: 0, status: 'playing', direction: 'forward' });
  });

  it('jumps to a scene, keeping play or pause, and ignores scenes that do not exist', () => {
    const playing = run(initialPlayerState(5), 'toggle');
    const jumped = playerReducer(playing, { type: 'goTo', index: 3 });
    expect(jumped).toMatchObject({ index: 3, status: 'playing', run: 1, direction: 'forward' });
    expect(playerReducer(jumped, { type: 'goTo', index: 1 })).toMatchObject({ index: 1, direction: 'back' });
    for (const index of [-1, 5, 1.5]) expect(playerReducer(jumped, { type: 'goTo', index })).toBe(jumped);
    const over = run(initialPlayerState(2), 'next', 'next');
    expect(playerReducer(over, { type: 'goTo', index: 0 })).toMatchObject({ index: 0, status: 'paused' });
  });

  it('waits on the last line when auto-turn is off, and plays on when the reader turns', () => {
    const playing = run(initialPlayerState(3), 'toggle');
    const held = playerReducer(playing, { type: 'sceneEnded', autoTurn: false });
    expect(held).toMatchObject({ index: 0, status: 'paused', holding: true });
    expect(playerReducer(held, { type: 'next' })).toMatchObject({ index: 1, status: 'playing', holding: false });
    expect(playerReducer(held, { type: 'toggle' })).toMatchObject({ index: 1, status: 'playing', holding: false });
    expect(playerReducer(held, { type: 'prev' })).toMatchObject({ index: 0, holding: false });
    const last = run(initialPlayerState(1), 'toggle');
    expect(playerReducer(last, { type: 'sceneEnded', autoTurn: false }).status).toBe('ended');
  });

  it('mutes and unmutes without touching playback', () => {
    const state = run(initialPlayerState(2), 'toggle', 'toggleMute');
    expect(state).toMatchObject({ muted: true, status: 'playing', index: 0, run: 0 });
    expect(run(state, 'toggleMute').muted).toBe(false);
  });

  it('follows the story recording: on to the scene it reached, play only when not playing, the end when it finishes', () => {
    const playing = run(initialPlayerState(3), 'toggle');
    const second = playerReducer(playing, { type: 'trackAt', index: 1 });
    expect([second.index, second.status, second.run, second.direction]).toEqual([1, 'playing', playing.run + 1, 'forward']);
    expect(playerReducer(second, { type: 'trackAt', index: 1 })).toBe(second);
    expect(playerReducer(second, { type: 'trackAt', index: 3 })).toBe(second);
    expect(playerReducer(second, { type: 'trackAt', index: 0 }).direction).toBe('back');
    expect(playerReducer(second, { type: 'play' })).toBe(second);
    expect(run(run(second, 'pause'), 'play').status).toBe('playing');
    expect(run(second, 'finished').status).toBe('ended');
    const paused = run(second, 'pause');
    expect(run(paused, 'finished')).toBe(paused);
    const over = run(second, 'finished');
    expect(playerReducer(over, { type: 'trackAt', index: 0 }).status).toBe('paused');
  });
});
