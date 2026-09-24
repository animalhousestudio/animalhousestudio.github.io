import * as THREE from 'three';

const hash = (x, y, seed) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed * 1013;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy, seed), hash(ix + 1, iy, seed), u),
    THREE.MathUtils.lerp(hash(ix, iy + 1, seed), hash(ix + 1, iy + 1, seed), u), v);
}
function cloud(x, y, seed) {
  let value = 0, amplitude = .55;
  for (let i = 0; i < 5; i++) { value += noise(x, y, seed + i) * amplitude; x *= 2.05; y *= 2.05; amplitude *= .48; }
  return value;
}
function nebulaTexture(seed, cold, warm) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d'), data = ctx.createImageData(512, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const u = (x / 511 - .5) * 2, v = (y / 255 - .5) * 2;
    const envelope = Math.max(0, 1 - u * u - v * v) ** 1.6;
    const warp = noise(x / 95, y / 90, seed) * 2;
    const f = cloud(x / 90 + warp, y / 75 - warp, seed);
    const dust = cloud(x / 55 + 4, y / 60, seed + 31);
    const density = Math.max(0, f - .29) * envelope * (1 - THREE.MathUtils.smoothstep(dust, .48, .7) * .85);
    const mix = THREE.MathUtils.smoothstep(f, .38, .72), i = (y * 512 + x) * 4;
    for (let c = 0; c < 3; c++) data.data[i + c] = THREE.MathUtils.lerp(cold[c], warm[c], mix);
    data.data[i + 3] = Math.min(190, density * 650);
  }
  ctx.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSpaceSky() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1, .1, 2000);
  const starCanvas = document.createElement('canvas'); starCanvas.width = starCanvas.height = 32;
  const ctx = starCanvas.getContext('2d'), gradient = ctx.createRadialGradient(16,16,0,16,16,16);
  gradient.addColorStop(0, '#fff'); gradient.addColorStop(.16, '#e0edff');
  gradient.addColorStop(.45, '#a9caff70'); gradient.addColorStop(1, '#a9caff00');
  ctx.fillStyle = gradient; ctx.fillRect(0,0,32,32);
  const starMap = new THREE.CanvasTexture(starCanvas);
  for (const [count, size, opacity] of [[1400, 1.8, .72], [130, 4, .8]]) {
    const positions = [];
    for (let i = 0; i < count; i++) {
      const theta = hash(i, 7, count) * Math.PI * 2, y = hash(i, 9, count) * 2 - 1, ring = Math.sqrt(1 - y * y);
      positions.push(1000 * ring * Math.cos(theta), 1000 * y, 1000 * ring * Math.sin(theta));
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color:0xe1eaff, map:starMap, size,
      sizeAttenuation:false, transparent:true, opacity, depthWrite:false, depthTest:false, fog:false }));
    scene.add(stars);
  }
  const textures = [nebulaTexture(11, [35,80,155], [148,103,180]),
    nebulaTexture(39, [24,79,118], [96,170,178]), nebulaTexture(71, [65,35,106], [190,95,115])];
  [[-700,250,-850,1050,460,-.28,0], [760,410,-600,950,440,.35,1],
    [-800,-280,550,880,420,.25,2], [500,540,700,1000,450,-.3,0],
    [150,-550,-900,850,380,.5,2]].forEach(([x,y,z,w,h,angle,index]) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:textures[index],transparent:true,
        opacity:.64,depthTest:false,depthWrite:false,fog:false,rotation:angle}));
      sprite.position.set(x,y,z); sprite.scale.set(w,h,1); sprite.renderOrder=-1; scene.add(sprite);
    });
  return {
    scene, camera,
    update() {},
    render(renderer, viewCamera) {
      camera.quaternion.copy(viewCamera.quaternion);
      if (camera.aspect !== viewCamera.aspect || camera.fov !== viewCamera.fov) {
        camera.aspect = viewCamera.aspect; camera.fov = viewCamera.fov; camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    },
  };
}
