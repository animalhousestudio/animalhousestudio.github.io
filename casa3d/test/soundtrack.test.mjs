import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundtrack } from '../src/music/soundtrack.mjs';

class AudioFixture extends EventTarget {
  paused = true;
  ended = false;
  currentTime = 0;
  #src = '';

  set src(value) {
    this.#src = value;
    this.currentTime = 0;
    this.ended = false;
  }
  getAttribute(name) { return name === 'src' ? this.#src : null; }
  async play() {
    this.paused = false;
    this.ended = false;
    this.dispatchEvent(new Event('play'));
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
}

function fixture(saved = new Map()) {
  const audio = new AudioFixture();
  const soundtrack = createSoundtrack({
    audio, baseUrl: 'http://localhost/casa3d/', input: new EventTarget(),
    storage: {
      setItem: (key, value) => saved.set(key, value),
      getItem: key => saved.get(key),
      removeItem: key => saved.delete(key),
    },
  });
  return { soundtrack, audio, saved };
}

test('soundtrack starts on 03.112, pauses in place and automatically alternates the two albums', async () => {
  const { soundtrack, audio } = fixture();
  assert.equal(audio.getAttribute('src'), '');
  await soundtrack.play();
  assert.equal(soundtrack.state.track, '03.112');
  assert.match(audio.getAttribute('src'), /animale-artificiale\/03\.112\.mp3$/);
  audio.currentTime = 4;
  soundtrack.toggle();
  assert.deepEqual(soundtrack.state, { album: 'animale-artificiale', track: '03.112', time: 4, playing: false, shuffle: false, repeat: 'all' });
  await soundtrack.toggle();
  assert.deepEqual(soundtrack.state, { album: 'animale-artificiale', track: '03.112', time: 4, playing: true, shuffle: false, repeat: 'all' });
  audio.dispatchEvent(new Event('ended'));
  assert.equal(soundtrack.state.track,'03.113');
  audio.dispatchEvent(new Event('ended'));
  assert.equal(soundtrack.state.track,'01.101');
  for (let i = 0; i < 9; i++) audio.dispatchEvent(new Event('ended'));
  assert.equal(soundtrack.state.track, '03.101');
});

test('same-origin room handoff restores track, time and both play and pause states', async () => {
  const source = fixture();
  await source.soundtrack.play();
  source.audio.dispatchEvent(new Event('ended'));
  source.audio.currentTime = 6;
  source.soundtrack.handoff();
  const room = fixture(source.saved);
  room.soundtrack.restore();
  assert.deepEqual(room.soundtrack.state, { album: 'animale-artificiale', track: '03.113', time: 6, playing: true, shuffle: false, repeat: 'all' });
  room.soundtrack.toggle();
  room.soundtrack.handoff();
  const returned = fixture(source.saved);
  returned.soundtrack.restore();
  assert.deepEqual(returned.soundtrack.state, { album: 'animale-artificiale', track: '03.113', time: 6, playing: false, shuffle: false, repeat: 'all' });
});

test('manual transport preserves pause, repeat-one restarts the track and repeat-off stops after both albums', async () => {
  const { soundtrack, audio } = fixture();
  soundtrack.next();
  assert.equal(soundtrack.state.track, '03.113');
  assert.equal(audio.paused, true);
  soundtrack.previous();
  assert.equal(soundtrack.state.track, '03.112');
  await soundtrack.play();
  soundtrack.cycleRepeat();
  audio.currentTime = 30;
  audio.dispatchEvent(new Event('ended'));
  assert.equal(soundtrack.state.track, '03.112');
  assert.equal(audio.currentTime, 0);
  soundtrack.next();
  assert.equal(soundtrack.state.track, '03.113');
  soundtrack.cycleRepeat();
  audio.dispatchEvent(new Event('ended'));
  assert.equal(soundtrack.state.track,'01.101');
  for (let i = 0; i < 8; i++) soundtrack.next();
  audio.ended = true;
  audio.dispatchEvent(new Event('ended'));
  assert.equal(soundtrack.state.track, '01.109');
  assert.equal(soundtrack.playing, false);
});

test('shuffle visits every track once and preserves its order across room handoffs', () => {
  const source = fixture();
  source.soundtrack.toggleShuffle();
  source.soundtrack.next();
  const second = source.soundtrack.state.track;
  source.soundtrack.handoff();
  const room = fixture(source.saved);
  room.soundtrack.restore();
  assert.equal(room.soundtrack.state.shuffle, true);
  room.soundtrack.previous();
  assert.equal(room.soundtrack.state.track, '03.112');
  room.soundtrack.next();
  assert.equal(room.soundtrack.state.track, second);
  const visited = new Set(['03.112', second]);
  for (let i = 0; i < 11; i++) {
    room.soundtrack.next();
    visited.add(room.soundtrack.state.track);
  }
  assert.equal(visited.size, 13);
  room.soundtrack.next();
  assert.equal(room.soundtrack.state.track, '03.112');
});

test('CAMBIA starts the other album and its selection survives the room handoff', async () => {
  const source = fixture();
  await source.soundtrack.play();
  assert.match(source.audio.getAttribute('src'), /animale-artificiale\/03\.112\.mp3$/);
  source.soundtrack.switchAlbum();
  assert.equal(source.soundtrack.state.track, '01.101');
  assert.equal(source.soundtrack.playing, true);
  assert.match(source.audio.getAttribute('src'), /animaleartificale01\/ANIMALOUD%201\.mp3$/);
  source.soundtrack.handoff();
  const room = fixture(source.saved);
  room.soundtrack.restore();
  assert.equal(room.soundtrack.state.album, 'animaleartificale01');
  room.soundtrack.switchAlbum();
  assert.equal(room.soundtrack.state.track, '03.101');
});
