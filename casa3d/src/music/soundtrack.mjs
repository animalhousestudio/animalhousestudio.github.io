import { ALBUMS } from '../rooms/musicAlbum.mjs';

const HANDOFF_KEY = 'animal-house:soundtrack-handoff:v1';
const REPEAT = ['all', 'one', 'off'];

export function createSoundtrack({ audio, baseUrl, storage, input }) {
  audio.preload = 'none';
  let album = ALBUMS[0];
  const sequence = () => album.tracks.map((_, index) => index);
  let track = album.tracks.findIndex(({ code }) => code === '03.112');
  let intent = false;
  let attempt = 0;
  let retry;
  let shuffle = false;
  let repeat = 'all';
  let order = sequence();
  const listeners = new Set();
  const isPlaying = () => !audio.paused && !audio.ended;
  const snapshot = () => ({
    album: album.id, track: album.tracks[track].code, time: audio.currentTime,
    playing: isPlaying(), shuffle, repeat,
  });
  const notify = () => listeners.forEach(listener => listener(snapshot()));

  function load(index) {
    track = index;
    const { code, file = code + '.mp3' } = album.tracks[track];
    audio.src = new URL('audio/' + album.id + '/' + encodeURIComponent(file), baseUrl).href;
  }
  function clearRetry() {
    retry?.abort();
    retry = undefined;
  }
  function play(resuming = false) {
    clearRetry();
    intent = true;
    const current = ++attempt;
    if (!audio.getAttribute('src')) load(track);
    return audio.play().catch(error => {
      if (attempt !== current) return;
      if (resuming && error.name === 'NotAllowedError') {
        retry = new AbortController();
        const resume = event => { if (event.isTrusted) play(); };
        for (const type of ['pointerup', 'keydown']) {
          input.addEventListener(type, resume, { signal: retry.signal });
        }
      } else {
        intent = false;
      }
    });
  }
  function toggle() {
    if (!intent || retry) return play();
    ++attempt;
    clearRetry();
    intent = false;
    audio.pause();
  }
  function skip(direction) {
    const index = order.indexOf(track) + direction;
    const wrapped = (index + order.length) % order.length;
    if (index !== wrapped && repeat !== 'all') {
      if (direction < 0 && audio.getAttribute('src')) audio.currentTime = 0;
      return false;
    }
    load(order[wrapped]);
    if (intent) play();
    notify();
    return true;
  }
  function updateOrder() {
    const tracks = sequence();
    if (shuffle) {
      const remaining = tracks.filter(index => index !== track);
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      order = [track, ...remaining];
    } else {
      order = tracks;
    }
  }
  function toggleShuffle() {
    shuffle = !shuffle;
    updateOrder();
    notify();
  }
  function advanceAlbum(wrap) {
    const next = ALBUMS.indexOf(album) + 1;
    if (!wrap && next === ALBUMS.length) return false;
    album = ALBUMS[next % ALBUMS.length];
    load(0);
    updateOrder();
    play();
    notify();
    return true;
  }
  function cycleRepeat() {
    repeat = REPEAT[(REPEAT.indexOf(repeat) + 1) % REPEAT.length];
    notify();
  }
  for (const event of ['play', 'pause', 'error']) audio.addEventListener(event, notify);
  audio.addEventListener('ended', () => {
    if (!intent) return;
    if (repeat === 'one') {
      audio.currentTime = 0;
      play();
    } else if (order.indexOf(track) < order.length-1) {
      skip(1);
    } else if (!advanceAlbum(repeat === 'all')) {
      intent = false;
      notify();
    }
  });

  return {
    play,
    toggle,
    previous: () => skip(-1),
    next: () => skip(1),
    toggleShuffle,
    cycleRepeat,
    switchAlbum: () => advanceAlbum(true),
    get playing() { return isPlaying(); },
    get state() { return snapshot(); },
    observe(listener) {
      listeners.add(listener);
      listener(snapshot());
    },
    handoff() {
      try {
        if (audio.getAttribute('src')) {
          storage.setItem(HANDOFF_KEY, JSON.stringify({
            album: album.id, track, time: audio.currentTime, playing: intent, repeat, shuffle, order,
          }));
        }
      } catch { /* Gameplay also works with storage disabled. */ }
    },
    restore() {
      let saved;
      try {
        saved = JSON.parse(storage.getItem(HANDOFF_KEY));
        storage.removeItem(HANDOFF_KEY);
      } catch { return; }
      const selected = ALBUMS.find(item => item.id === saved?.album) ?? ALBUMS[0];
      if (!Number.isInteger(saved?.track) || !selected.tracks[saved.track]
          || !Number.isFinite(saved.time) || saved.time < 0) return;
      album = selected;
      if (REPEAT.includes(saved.repeat)) repeat = saved.repeat;
      const tracks = sequence();
      order = tracks;
      if (saved.shuffle === true && Array.isArray(saved.order) && saved.order.length === tracks.length
          && tracks.every(index => saved.order.includes(index))) {
        shuffle = true;
        order = saved.order;
      }
      load(saved.track);
      audio.currentTime = saved.time;
      if (saved.playing) play(true);
      notify();
    },
  };
}

let shared;
export function gameSoundtrack() {
  if (!shared) {
    let storage;
    try { storage = window.sessionStorage; } catch { /* Optional handoff. */ }
    shared = createSoundtrack({
      audio: new Audio(), baseUrl: document.baseURI, storage, input: document,
    });
  }
  return shared;
}
