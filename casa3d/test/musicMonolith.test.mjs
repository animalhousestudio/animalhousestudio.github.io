import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANDING_Z } from '../src/arrival.mjs';
import { MUG_PLACEMENT, MUSIC_MONOLITH_PLACEMENT } from '../src/rooms/arrivalLayout.mjs';
import { ALBUMS, ALBUM_TRACKS } from '../src/rooms/musicAlbum.mjs';
import { pathDistance, PATH_WIDTH } from '../src/rooms/landscapeLayout.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';
import { WORLD_CONTENT } from '../src/world/content.mjs';

const casa = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('art/animale-artificiale-v01/runtime-export.json', casa)));

test('monolith runtime export contains only the bevelled body and bezel, with a separate screen image', async () => {
  const [model, screen] = await Promise.all([manifest.model, manifest.screen].map(async entry => {
    const bytes = await readFile(new URL(entry.path, casa));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.equal(bytes.length, entry.bytes);
    return bytes;
  }));
  assert.ok(model.length + screen.length < 160_000);
  const data = model.buffer.slice(model.byteOffset, model.byteOffset + model.byteLength);
  const { scene, scenes } = await new GLTFLoader().parseAsync(data, '');
  const meshNames = [];
  let triangles = 0;
  scene.traverse(object => {
    assert.ok(!object.isCamera && !object.isLight);
    if (!object.isMesh) return;
    meshNames.push(object.name);
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });
  assert.equal(scenes.length, 1);
  assert.deepEqual(meshNames.sort(), ['Cornice_a_filo', 'Monolite_nero']);
  assert.equal(triangles, manifest.model.triangles);
  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  assert.ok(Math.abs(size.x - 1.12) < .001 && Math.abs(size.y - 2.84) < .001);
  assert.ok(Math.abs(bounds.min.y + .001) < .0001);
});

test('monolith faces the landing approach from the left, clear of the path', () => {
  const { x, z, yaw } = MUSIC_MONOLITH_PLACEMENT;
  assert.ok(x < 0 && z < LANDING_Z);
  assert.ok(Math.abs(yaw - Math.atan2(-x, LANDING_Z - z)) < 1e-6);
  const footprintRadius = Math.hypot(1.12, .45) / 2 / WORLD_SCALE;
  assert.ok(pathDistance(x, z) > PATH_WIDTH / 2 + footprintRadius);
  const content = WORLD_CONTENT.find(entry => entry.id === 'music-monolith');
  assert.equal(content.root, 'MusicMonolith');
  assert.equal(content.zone, 'outdoor:arrival');
  assert.equal(content.kind, 'structure');
  assert.ok(Math.hypot(x - MUG_PLACEMENT.x, z - MUG_PLACEMENT.z) * WORLD_SCALE > 6.25);
});

test('all soundtrack entries address their verified MP3 and there are no duplicate album files', async () => {
  const audio = new URL('audio/animale-artificiale/', casa);
  const encoding = JSON.parse(await readFile(new URL('art/animale-artificiale-v01/audio-encoding.json', casa)));
  assert.equal(ALBUM_TRACKS.length, 13);
  assert.deepEqual((await readdir(audio)).sort(), ALBUM_TRACKS.map(track => track.code + '.mp3'));
  for (const [index, track] of ALBUM_TRACKS.entries()) {
    const asset = encoding.tracks[index];
    const bytes = await readFile(new URL(track.code + '.mp3', audio));
    assert.equal(asset.source, track.source);
    assert.equal(asset.track, track.code);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.ok(Math.abs(bytes.length / 24000 - asset.durationSeconds) < .1);
  }
});

test('the second album has nine original MP3s and its own baked cover and glyph sequences', async () => {
  const [old, album] = ALBUMS;
  const exported = JSON.parse(await readFile(new URL('art/animale-artificiale-v01/album-01-export.json', casa)));
  assert.equal(album.id, exported.album);
  assert.equal(album.tracks.length, 9);
  const glyphs = [album.title, ...album.tracks.map(track => track.title)];
  assert.equal(new Set(glyphs).size, 10);
  const oldGlyphs = new Set([old.title, ...old.tracks.map(track => track.title)]);
  assert.ok(glyphs.every(glyph => !oldGlyphs.has(glyph)));
  for (const entry of [exported.cover, exported.screen, ...exported.tracks]) {
    const bytes = await readFile(new URL(entry.path, casa));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
});
