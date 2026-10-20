import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { createNebulaGeometry, syncSpaceSkyCamera } from '../src/spaceSky.mjs';

test('nebula patches lie on the celestial sphere and face the observer', () => {
  for (const center of [new Vector3(-700,250,-850), new Vector3(500,540,700)]) {
    const geometry = createNebulaGeometry(center, 1050, 460, -.28);
    const positions = geometry.attributes.position, normals = geometry.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      const point = new Vector3().fromBufferAttribute(positions, i);
      assert.ok(Math.abs(point.length() - 1100) < .001);
      assert.ok(point.dot(new Vector3().fromBufferAttribute(normals, i)) < 0,
        'The visible face points inward, so clouds remain visible from the sky camera');
    }
    geometry.dispose();
  }
});

test('travelling arbitrarily far does not change a nebula or star projection', () => {
  const view = new PerspectiveCamera(75, 1.8, .1, 4000);
  const sky = new PerspectiveCamera(75, 1, .1, 2000);
  view.rotation.set(.23, -.4, .18);
  const nebula = createNebulaGeometry(new Vector3(-700,250,-850), 1050, 460, -.28);
  const landmarks = [new Vector3().fromBufferAttribute(nebula.attributes.position, 28), new Vector3(200,100,-950)];
  const project = () => {
    syncSpaceSkyCamera(sky, view); sky.updateMatrixWorld(true);
    return landmarks.map(point => point.clone().project(sky));
  };
  const before = project();
  for (const position of [new Vector3(-310,180,170), new Vector3(100000,-5000,80000)]) {
    view.position.copy(position);
    project().forEach((point, i) => assert.ok(point.distanceTo(before[i]) < 1e-12));
  }
  nebula.dispose();
});

test('banking rotates cloud features with the stars instead of keeping them screen-aligned', () => {
  const view = new PerspectiveCamera(75, 1.8, .1, 4000);
  const sky = new PerspectiveCamera(75, 1, .1, 2000);
  const nebula = createNebulaGeometry(new Vector3(0,0,-1000), 1000, 460, 0);
  const feature = new Vector3().fromBufferAttribute(nebula.attributes.position, 42);
  const nearbyStar = feature.clone().normalize().multiplyScalar(1000);
  syncSpaceSkyCamera(sky, view); sky.updateMatrixWorld(true);
  const before = feature.clone().project(sky);
  view.rotation.z = Math.PI / 2;
  syncSpaceSkyCamera(sky, view); sky.updateMatrixWorld(true);
  const after = feature.clone().project(sky), star = nearbyStar.project(sky);
  assert.ok(Math.abs(after.x - before.y / sky.aspect) < 1e-10);
  assert.ok(Math.abs(after.y + before.x * sky.aspect) < 1e-10);
  assert.ok(after.clone().setZ(0).distanceTo(star.setZ(0)) < 1e-10);
  nebula.dispose();
});

test('sky follows world orientation and lens settings even for a parented camera', () => {
  const parent = new Group(), view = new PerspectiveCamera(60, 2, .1, 4000);
  const sky = new PerspectiveCamera(75, 1, .1, 2000);
  parent.rotation.set(.1, .7, -.2); parent.add(view);
  view.rotation.set(-.3, .2, .4); view.zoom = 1.3;
  syncSpaceSkyCamera(sky, view);
  assert.ok(sky.quaternion.angleTo(view.getWorldQuaternion(view.quaternion.clone())) < 1e-7);
  assert.equal(sky.aspect, 2); assert.equal(sky.fov, 60); assert.equal(sky.zoom, 1.3);
  assert.equal(sky.far, 2000, 'Keep a sky frustum large enough for the celestial sphere');
});
