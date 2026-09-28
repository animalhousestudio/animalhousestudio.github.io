import * as THREE from 'three';

const BOARD_WIDTH = 0.18;
const BOARD_ASPECT = 5;
const TILE_REPEATS = 2;
const COLOR_SIZE = 1024;
const BUMP_SIZE = 512;

// A 90-degree herringbone lattice, turned 45 degrees. Each square texture
// repeats 40 individually grained 18 x 90 cm boards without cutting a seam.
export const PARQUET_TILE_WORLD_SIZE = BOARD_WIDTH * BOARD_ASPECT * Math.SQRT2 * TILE_REPEATS;

let sharedMaps;

function randomSequence(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function canvas2d(width, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, context: canvas.getContext('2d') };
}

function woodBoard(seed, width, height) {
  const { canvas, context: ctx } = canvas2d(width, height);
  const random = randomSequence(seed);
  const hue = 31 + random() * 6;
  const saturation = 41 + random() * 10;
  const lightness = 48 + random() * 13;
  ctx.fillStyle = `hsl(${hue} ${saturation}% ${lightness}%)`;
  ctx.fillRect(0, 0, width, height);

  // Long, gently wandering grain follows the length of each board. Shared
  // phases keep adjacent growth lines coherent instead of looking like noise.
  const phase = random() * Math.PI * 2;
  const bend = (random() - 0.5) * height * 0.15;
  const knotX = (0.2 + random() * 0.6) * width;
  const knotY = (0.25 + random() * 0.5) * height;
  const knotStrength = random() < 0.28 ? height * 0.18 : 0;
  for (let row = -5; row < height + 5; row += 0.8 + random() * 1.7) {
    const tone = random() < 0.25 ? '255,226,170' : '88,47,20';
    ctx.strokeStyle = `rgba(${tone},${0.04 + random() * 0.11})`;
    ctx.lineWidth = 0.25 + random() * 0.7;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const wave = Math.sin(x / width * 6.1 + phase) * bend;
      const growth = Math.sin(x / width * 18 + phase + row * 0.023) * height * 0.013;
      const knot = Math.exp(-(((x - knotX) / (width * 0.16)) ** 2))
        * Math.exp(-(((row - knotY) / (height * 0.4)) ** 2))
        * Math.sign(row - knotY) * knotStrength;
      const y = row + wave + growth + knot;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Open wood pores remain low contrast and longitudinal, including at close
  // range; there is no painted-in directional room lighting.
  for (let i = 0; i < 280; i++) {
    ctx.fillStyle = `rgba(77,43,22,${0.025 + random() * 0.055})`;
    ctx.fillRect(random() * width, random() * height, 1 + random() * 6, 0.35 + random() * 0.35);
  }

  // Roughly 1 mm dark joints, with a small lighter bevel inside each plank.
  const joint = Math.max(0.65, height * 0.006);
  ctx.strokeStyle = 'rgba(69,45,26,0.48)';
  ctx.lineWidth = joint;
  ctx.strokeRect(joint / 2, joint / 2, width - joint, height - joint);
  ctx.strokeStyle = 'rgba(244,213,169,0.17)';
  ctx.lineWidth = 0.45;
  ctx.strokeRect(joint + 0.25, joint + 0.25, width - joint * 2 - 0.5, height - joint * 2 - 0.5);
  return canvas;
}

function positiveMod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function makeMaps() {
  const color = canvas2d(COLOR_SIZE);
  const bump = canvas2d(BUMP_SIZE);
  const tileUnits = BOARD_ASPECT * Math.SQRT2 * TILE_REPEATS;
  const pixelsPerWidth = COLOR_SIZE / tileUnits;
  const boards = new Map();

  color.context.fillStyle = '#735232';
  color.context.fillRect(0, 0, COLOR_SIZE, COLOR_SIZE);
  bump.context.fillStyle = '#808080';
  bump.context.fillRect(0, 0, BUMP_SIZE, BUMP_SIZE);

  for (const target of [color, bump]) {
    const size = target.canvas.width;
    target.context.scale(size / tileUnits, size / tileUnits);
    target.context.rotate(Math.PI / 4);
  }

  // In the unturned lattice the translation vectors are (n,n) and (1,-1).
  // After the turn these are perpendicular. Periodic board keys make both
  // colour and growth lines continue exactly across all four texture edges.
  for (let i = -2; i <= TILE_REPEATS + 1; i++) {
    for (let j = -BOARD_ASPECT; j <= BOARD_ASPECT * TILE_REPEATS + BOARD_ASPECT; j++) {
      const x = i * BOARD_ASPECT + j;
      const y = i * BOARD_ASPECT - j;
      for (let vertical = 0; vertical < 2; vertical++) {
        const key = (positiveMod(i, TILE_REPEATS) * BOARD_ASPECT * TILE_REPEATS
          + positiveMod(j, BOARD_ASPECT * TILE_REPEATS)) * 2 + vertical;
        if (!boards.has(key)) {
          boards.set(key, woodBoard(739391 + key * 104729,
            Math.ceil(pixelsPerWidth * BOARD_ASPECT), Math.ceil(pixelsPerWidth)));
        }
        for (const target of [color, bump]) {
          const ctx = target.context;
          ctx.save();
          ctx.translate(x + (vertical ? BOARD_ASPECT + 1 : 0), y);
          if (vertical) ctx.rotate(Math.PI / 2);
          if (target === color) {
            ctx.drawImage(boards.get(key), 0, 0, BOARD_ASPECT, 1);
          } else {
            ctx.fillStyle = '#b0b0b0';
            ctx.fillRect(0, 0, BOARD_ASPECT, 1);
            ctx.strokeStyle = '#707070';
            ctx.lineWidth = 0.016;
            ctx.strokeRect(0.008, 0.008, BOARD_ASPECT - 0.016, 0.984);
          }
          ctx.restore();
        }
      }
    }
  }

  const map = new THREE.CanvasTexture(color.canvas);
  map.name = 'Parquet_HoneyOak_Herringbone_Color';
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bump.canvas);
  bumpMap.name = 'Parquet_HoneyOak_Herringbone_Joints';
  for (const texture of [map, bumpMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
  }
  return { map, bumpMap };
}

/** Shared seamless maps; UVs are horizontal world metres / tile size. */
export function createParquetMaterial({ anisotropy = 4 } = {}) {
  sharedMaps ??= makeMaps();
  const requestedAnisotropy = Number.isFinite(anisotropy) ? Math.max(1, anisotropy) : 4;
  for (const texture of Object.values(sharedMaps)) {
    if (texture.anisotropy !== requestedAnisotropy) {
      texture.anisotropy = requestedAnisotropy;
      texture.needsUpdate = true;
    }
  }
  const material = new THREE.MeshStandardMaterial({
    ...sharedMaps,
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0,
    bumpScale: 0.0015,
  });
  material.name = 'Parquet_HoneyOak_Herringbone';
  return material;
}
