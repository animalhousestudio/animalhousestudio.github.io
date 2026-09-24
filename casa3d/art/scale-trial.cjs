const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const p=path.join(root,'src/main.js');
let s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
s=s.replace("import { createArrival, ARRIVAL_DURATION }", "import { createArrival as createBaseArrival, ARRIVAL_DURATION }");
s=s.replace('FLOOR_Y, FLOOR_NAMES, HOUSE_X, HOUSE_Z, EYE_HEIGHT, ENTRY, nearestFloor','FLOOR_Y, FLOOR_NAMES, HOUSE_X, HOUSE_Z, BASE_HOUSE_X, BASE_HOUSE_Z, WORLD_SCALE, EYE_HEIGHT, ENTRY, nearestFloor');
s=s.replace('// Renderer',`// Scale the environment, leaving the human viewpoint and walking speed unchanged.
function createArrival(aspect, height) {
  const base = createBaseArrival(aspect, height / WORLD_SCALE);
  return { start: base.start.clone().multiplyScalar(WORLD_SCALE), end: base.end.clone().multiplyScalar(WORLD_SCALE),
    sample(t) { const frame=base.sample(t); frame.position.multiplyScalar(WORLD_SCALE); frame.focus.multiplyScalar(WORLD_SCALE); return frame; } };
}
// Renderer`);
s=s.replace('scene.fog = new THREE.FogExp2(0x0b1020, 0.00065);','scene.fog = new THREE.FogExp2(0x0b1020, 0.00065 / WORLD_SCALE);\nconst world = new THREE.Group(); world.name="EnvironmentScaleTrial"; world.scale.setScalar(WORLD_SCALE); scene.add(world);');
s=s.replace('0.1, 1000)','0.1, 4000)');
for(const n of ['garden','basement','kitchen','upperGallery','living','observatory','stairs'])s=s.replace(`scene.add(${n});`,`world.add(${n});`);
s=s.replace('stairs.position.set(HOUSE_X,0,HOUSE_Z)','stairs.position.set(BASE_HOUSE_X,0,BASE_HOUSE_Z)');
s=s.replace('scene.add(asteroidTerrain.model)','world.add(asteroidTerrain.model)');
s=s.replace('function collectColliders(){','function collectColliders(){\n  world.updateMatrixWorld(true);');
s=s.replace('asteroidTerrain?.heightAt(x, z)','asteroidTerrain?.heightAt(x / WORLD_SCALE, z / WORLD_SCALE)');
s=s.replace('EYE_HEIGHT + .8, ENTRY.z + 1.1','EYE_HEIGHT + .8 * WORLD_SCALE, ENTRY.z + 1.1 * WORLD_SCALE');
s=s.replace('ENTRY.z - .6','ENTRY.z - .6 * WORLD_SCALE');
s=s.replace('ENTRY.x) < .85','ENTRY.x) < .85 * WORLD_SCALE').replace('ENTRY.z + .7','ENTRY.z + .7 * WORLD_SCALE').replace('ENTRY.z + 2.5','ENTRY.z + 2.5 * WORLD_SCALE');
s=s.replace('const radius = INTERNAL_STAIR_TRAVEL_RADIUS;','const radius = INTERNAL_STAIR_TRAVEL_RADIUS * WORLD_SCALE;');
s=s.replaceAll('cz + 2.4','cz + 2.4 * WORLD_SCALE');
s=s.replace('hit.distance < 5','hit.distance < 5 * WORLD_SCALE');
s=s.replace('player.camera.position.z-HOUSE_Z)<4','player.camera.position.z-HOUSE_Z)<4 * WORLD_SCALE');
s=s.replace('pos.x-HOUSE_X)<7.4','pos.x-HOUSE_X)<7.4 * WORLD_SCALE').replace('pos.z-HOUSE_Z)<5.4','pos.z-HOUSE_Z)<5.4 * WORLD_SCALE');
s=s.replace('HOUSE_X+.5,FLOOR_Y[i]+EYE_HEIGHT,HOUSE_Z+2.4','HOUSE_X+.5 * WORLD_SCALE,FLOOR_Y[i]+EYE_HEIGHT,HOUSE_Z+2.4 * WORLD_SCALE');
s=s.replace("background:#162329;padding:10px;", "background:#162329;color:#fff;padding:10px;");
s=s.replace("button.textContent=name;", "button.textContent=name;button.style.cssText='background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';");
fs.writeFileSync(p,s);
