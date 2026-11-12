import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { ALBUMS } from './musicAlbum.mjs';
import { EYE_HEIGHT } from './layout.mjs';

function canvasPanel(name, width, height, pixels, x, y, transparent) {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = pixels;
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new MeshBasicMaterial({
    map: texture, transparent, depthWrite: !transparent, toneMapped: false,
  });
  const mesh = new Mesh(new PlaneGeometry(width, height), material);
  mesh.name = name;
  mesh.position.set(x, y - EYE_HEIGHT, .004);
  return { mesh, texture, ctx, canvas };
}

export function createNowPlaying() {
  const { mesh, texture, ctx } = canvasPanel('MusicMonolithNowPlaying',
    .49, .068, [490, 68], .13, 2.421, false);
  let last;
  return {
    mesh,
    setState({ album, track, playing }) {
      const signature = album + ':' + track + ':' + playing;
      if (signature === last) return;
      last = signature;
      const glyphs = ALBUMS.find(item => item.id === album)?.tracks.find(item => item.code === track)?.title ?? '';
      ctx.fillStyle = '#030303';
      ctx.fillRect(0, 0, 490, 68);
      ctx.strokeStyle = '#56534d';
      ctx.strokeRect(.5, .5, 489, 67);
      ctx.fillStyle = playing ? '#73ffab' : '#a4a4a4';
      ctx.beginPath();
      ctx.arc(23, 34, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 21px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(playing ? 'PLAY' : 'PAUSA', 38, 34);
      ctx.fillStyle = '#f0f2ed';
      ctx.font = 'bold 27px monospace';
      ctx.fillText(track, 119, 34);
      ctx.font = '31px "Segoe UI Historic", "Noto Sans Egyptian Hieroglyphs", sans-serif';
      ctx.fillText(glyphs, 234, 35, 235);
      texture.needsUpdate = true;
    },
  };
}

const LETTERS = [
  [[[56, 10], [44, 5], [21, 13], [9, 33], [7, 57], [21, 74], [46, 72], [56, 64]]],
  [[[4, 77], [28, 6], [42, 1], [63, 74]], [[12, 49], [51, 45]]],
  [[[5, 77], [11, 5], [34, 50], [55, 4], [62, 73]]],
  [[[9, 75], [11, 8], [34, 5], [49, 12], [51, 29], [33, 38], [13, 42],
    [37, 36], [56, 45], [56, 62], [42, 73], [9, 75]]],
  [[[14, 5], [47, 4]], [[31, 5], [28, 74]], [[12, 76], [48, 72]]],
  [[[4, 77], [27, 10], [40, 2], [63, 74]], [[12, 49], [50, 46]]],
];

export function createChangeTag() {
  const { mesh, ctx, texture } = canvasPanel('MusicMonolithChangeAlbum',
    .34, .18, [272, 144], .27, 1.109, true);
  let seed = 2621;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const scratches = [
    [88, 18, 129, 66, 6],
    [99, 6, 146, 68, 9],
    [125, 9, 158, 60, 7],
    [146, 5, 171, 54, 5],
  ];
  ctx.save();
  ctx.translate(-52.8, 0);
  ctx.scale(1.4, 1.4);
  ctx.lineJoin = 'round';
  for (const [x, y, endX, endY, width] of scratches) {
    const left = [];
    const right = [];
    for (let step = 0; step <= 16; step++) {
      const t = step / 16;
      const taper = Math.sin(Math.PI * t);
      const centerX = x + (endX - x) * t + 5 * taper;
      const centerY = y + (endY - y) * t;
      left.push([centerX - width * taper * (.3 + random() * .55), centerY + 2 * taper]);
      right.push([centerX + width * taper * (.4 + random() * .6), centerY - 2 * taper]);
    }
    const cut = ctx.createLinearGradient(x, endY, endX, y);
    cut.addColorStop(0, '#7d7a75');
    cut.addColorStop(.45, '#322f2c');
    cut.addColorStop(.72, '#0b0a0a');
    cut.addColorStop(1, '#4c4844');
    ctx.fillStyle = cut;
    ctx.beginPath();
    ctx.moveTo(...left[0]);
    for (const point of left.slice(1)) ctx.lineTo(...point);
    for (const point of right.reverse()) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(223,216,202,.35)';
    ctx.lineWidth = .85;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(...left[0]);
    for (const point of left.slice(1)) ctx.lineTo(...point);
    ctx.strokeStyle = '#d4cfc4';
    ctx.lineWidth = 1.15;
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.save();
  ctx.translate(60, 105);
  ctx.scale(.36, .36);
  ctx.rotate(-.085);
  for (const [letter, strokes] of LETTERS.entries()) {
    ctx.save();
    ctx.translate(letter * 70, [4, -5, 4, 0, 3, 1][letter]);
    ctx.rotate([-.12, .06, -.04, .08, -.08, .07][letter]);
    for (const path of strokes) {
      ctx.strokeStyle = '#c9222d';
      ctx.lineWidth = 9 + random() * 3;
      ctx.beginPath();
      path.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
      for (let i = 1; i < path.length; i++) {
        const [a, b] = [path[i - 1], path[i]];
        for (let speck = 0; speck < 36; speck++) {
          const f = random();
          const x = a[0] + (b[0] - a[0]) * f + (random() - .5) * 21;
          const y = a[1] + (b[1] - a[1]) * f + (random() - .5) * 21;
          ctx.fillStyle = random() > .4 ? 'rgba(242,51,63,.66)' : 'rgba(143,20,33,.40)';
          ctx.fillRect(x, y, .7 + random() * 2.7, .7 + random() * 2.7);
        }
      }
    }
    ctx.restore();
  }
  ctx.restore();
  texture.needsUpdate = true;
  return mesh;
}
