import {
  BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry,
  SRGBColorSpace, TextureLoader,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STATIC_ASSETS } from '../world/assetCatalog.mjs';
import screenUrl from '../assets/models/props/music-monolith-screen.jpg?url';
import firstScreenUrl from '../assets/models/props/music-monolith-screen-01.jpg?url';
import { MUSIC_MONOLITH_PLACEMENT } from './arrivalLayout.mjs';
import { ALBUMS } from './musicAlbum.mjs';
import { createChangeTag, createNowPlaying } from './musicMonolithDisplay.mjs';
import { EYE_HEIGHT, WORLD_SCALE } from './layout.mjs';
import { terrainHeight } from './terrainDetail.mjs';

const ACTIONS = ['toggleShuffle', 'previous', 'toggle', 'next', 'cycleRepeat'];
const POSITIONS = [-.115, .030, -.355, .175, .320];
const CONTROL_WIDTH = .90;
const PIXELS_PER_METRE = 800;

function createPlaybackControls() {
  const canvas = document.createElement('canvas');
  canvas.width = CONTROL_WIDTH * PIXELS_PER_METRE;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const mesh = new Mesh(new PlaneGeometry(CONTROL_WIDTH, .15),
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.name = 'MusicMonolithTransport';
  mesh.position.set(0, 2.313 - EYE_HEIGHT, .002);
  let last;

  function line(points, close = false) {
    ctx.beginPath();
    for (const [index, [x, y]] of points.entries()) {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (close) ctx.closePath();
  }
  function triangle(x, direction = 1) {
    line([[x - 13 * direction, -20], [x + 23 * direction, 0], [x - 13 * direction, 20]], true);
    ctx.fill();
  }
  function dot(y, radius) {
    ctx.beginPath();
    ctx.arc(0, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawIcon(index, { playing, shuffle, repeat }) {
    const active = index === 0 ? shuffle : index === 4 && repeat !== 'off';
    ctx.save();
    ctx.translate((POSITIONS[index] + CONTROL_WIDTH / 2) * PIXELS_PER_METRE, 60);
    ctx.strokeStyle = ctx.fillStyle = active ? '#1ed760' : '#b3b3b3';
    ctx.lineWidth = 4.8;
    ctx.lineCap = ctx.lineJoin = 'round';
    switch (index) {
      case 0:
        line([[-21, 13], [-14, 13], [12, -13], [20, -13]]); ctx.stroke();
        line([[-21, -13], [-14, -13], [-8, -7]]); ctx.stroke();
        line([[6, 7], [12, 13], [20, 13]]); ctx.stroke();
        line([[14, -19], [20, -13], [14, -7]]); ctx.stroke();
        line([[14, 7], [20, 13], [14, 19]]); ctx.stroke();
        break;
      case 1:
        triangle(5, -1);
        ctx.fillRect(-22, -20, 7, 40);
        break;
      case 2:
        ctx.fillStyle = '#1ed760'; dot(0, .064 * PIXELS_PER_METRE);
        ctx.fillStyle = '#121212';
        if (playing) {
          ctx.fillRect(-15.2, -18.4, 9.6, 36.8);
          ctx.fillRect(5.6, -18.4, 9.6, 36.8);
        } else {
          line([[-11.2, -20], [20, 0], [-11.2, 20]], true);
          ctx.fill();
        }
        break;
      case 3:
        triangle(-5);
        ctx.fillRect(15, -20, 7, 40);
        break;
      case 4:
        ctx.beginPath();
        ctx.roundRect(-20, -14, 40, 28, 7);
        ctx.stroke();
        ctx.fillStyle = '#141414';
        ctx.fillRect(-10, 9, 13, 10);
        ctx.strokeStyle = ctx.fillStyle = active ? '#1ed760' : '#b3b3b3';
        line([[2, 8], [-4, 14], [2, 20]]); ctx.stroke();
        if (repeat === 'one') {
          ctx.font = 'bold 18px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('1', 0, 6);
        }
        break;
    }
    if (active) dot(49, 3.8);
    ctx.restore();
  }

  return {
    mesh,
    actionAt(u) {
      const x = (u - .5) * CONTROL_WIDTH;
      return ACTIONS[POSITIONS.findIndex(position => Math.abs(x - position) <= .064)];
    },
    setState(state) {
      const signature = [state.playing, state.shuffle, state.repeat].join(':');
      if (signature === last) return;
      last = signature;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#b3b3b3';
      for (const x of [-.278, -.264, -.250]) {
        ctx.beginPath();
        ctx.arc((x + CONTROL_WIDTH / 2) * PIXELS_PER_METRE, 60, 2.72, 0, Math.PI * 2);
        ctx.fill();
      }
      ACTIONS.forEach((_, index) => drawIcon(index, state));
      texture.needsUpdate = true;
    },
  };
}

export async function addMusicMonolith(garden) {
  const textureLoader = new TextureLoader();
  const [{ scene: model }, firstTexture, previousTexture] = await Promise.all([
    new GLTFLoader().loadAsync(STATIC_ASSETS['music-monolith'].url),
    textureLoader.loadAsync(firstScreenUrl),
    textureLoader.loadAsync(screenUrl),
  ]);
  const textures = new Map([['animaleartificale01', firstTexture], ['animale-artificiale', previousTexture]]);
  for (const texture of textures.values()) {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
  }

  const root = new Group();
  root.name = 'MusicMonolith';
  root.userData.streamingBoundary = true;
  const { x, z, yaw } = MUSIC_MONOLITH_PLACEMENT;
  root.position.set(x, terrainHeight(x, z), z);
  root.rotation.y = yaw;
  root.scale.setScalar(1 / WORLD_SCALE);

  model.userData.collisionDisabled = true;
  model.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  const screen = new Mesh(new PlaneGeometry(.93, 1.46),
    new MeshBasicMaterial({ map: textures.get(ALBUMS[0].id), toneMapped: false }));
  screen.name = 'MusicMonolithScreen';
  screen.position.set(0, EYE_HEIGHT, .232);
  screen.userData.collisionDisabled = true;
  const controls = createPlaybackControls();
  const nowPlaying = createNowPlaying();
  const change = createChangeTag();
  screen.add(controls.mesh, nowPlaying.mesh, change);

  const hull = new Mesh(new BoxGeometry(1.12, 2.84, .45),
    new MeshBasicMaterial({ visible: false }));
  hull.name = 'MusicMonolithPhysics';
  hull.position.y = 1.419;
  hull.userData.collidable = true;
  root.add(model, screen, hull);
  garden.add(root);
  garden.userData.musicMonolith = root;
  garden.userData.musicMonolithScreen = screen;
  garden.userData.musicMonolithControls = {
    mesh: controls.mesh, actionAt: controls.actionAt, change,
    setState(state) {
      screen.material.map = textures.get(state.album);
      nowPlaying.setState(state);
      controls.setState(state);
    },
  };
  return root;
}
