import { Box3, Matrix4, Sphere, Vector3 } from 'three';

const textNames = new Set(['Colpisci forte', 'Score label', 'Score numerals']);
const hideBelowPixels = 1.5;
const showAbovePixels = 2;

function authoredVisibility(node, root) {
  for (let parent = node; parent; parent = parent.parent) {
    if (!parent.visible) return false;
    if (parent === root) break;
  }
  return true;
}

function initializeBounds(anchor) {
  const { node } = anchor;
  node.updateWorldMatrix(true, true);
  const inverse = node.matrixWorld.clone().invert();
  const localBounds = new Box3(), partBounds = new Box3(), matrix = new Matrix4();
  // GLTFLoader can represent a multi-material text as a group of primitives.
  // Their union is measured in the named text's original local coordinates.
  node.traverse(part => {
    if (!part.isMesh || !part.geometry?.attributes.position) return;
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    matrix.multiplyMatrices(inverse, part.matrixWorld);
    localBounds.union(partBounds.copy(part.geometry.boundingBox).applyMatrix4(matrix));
  });
  localBounds.getBoundingSphere(anchor.sphere);
  anchor.sphere.applyMatrix4(node.matrixWorld);
  // The three authored labels lie in local X/Z; local Y is their extrusion.
  const world = node.matrixWorld.elements;
  anchor.glyphHeight = (localBounds.max.z - localBounds.min.z)
    * Math.hypot(world[8], world[9], world[10]);
  anchor.valid = !localBounds.isEmpty() && Number.isFinite(anchor.glyphHeight)
    && anchor.glyphHeight > 0 && Number.isFinite(anchor.sphere.radius)
    && anchor.sphere.center.toArray().every(Number.isFinite);
  anchor.initialized = true;
}

// Register before render batching, but update only after collision capture and
// final placement in the world. These props are static after that placement.
export function registerStaticTextDetails(root) {
  const anchors = [], selected = new Set();
  const cameraPosition = new Vector3(), cameraForward = new Vector3();
  root.traverse(node => {
    if (!textNames.has(node.name.replaceAll('_', ' '))) return;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (selected.has(parent)) return;
      if (parent === root) break;
    }
    selected.add(node);
    node.traverse(part => { part.userData.staticDetail = true; });
    anchors.push({ node, authoredVisible: authoredVisibility(node, root),
      sphere: new Sphere(), glyphHeight: 0, initialized: false, valid: false });
  });

  const showEligible = () => {
    for (const anchor of anchors) if (anchor.authoredVisible) anchor.node.visible = true;
  };

  return {
    anchors,
    update(camera, viewportHeight) {
      const focalPixels = viewportHeight * camera?.projectionMatrix?.elements[5] * .5;
      if (!camera?.isPerspectiveCamera || !Number.isFinite(viewportHeight)
        || viewportHeight <= 0 || !Number.isFinite(focalPixels) || focalPixels <= 0) {
        showEligible();
        return;
      }
      camera.updateWorldMatrix(true, false);
      cameraPosition.setFromMatrixPosition(camera.matrixWorld);
      cameraForward.setFromMatrixColumn(camera.matrixWorld, 2).negate().normalize();
      if (!Number.isFinite(cameraPosition.x) || !Number.isFinite(cameraPosition.y)
        || !Number.isFinite(cameraPosition.z) || !Number.isFinite(cameraForward.x)
        || !Number.isFinite(cameraForward.y) || !Number.isFinite(cameraForward.z)) {
        showEligible();
        return;
      }
      for (const anchor of anchors) {
        if (!anchor.authoredVisible) continue;
        if (!anchor.initialized) initializeBounds(anchor);
        const center = anchor.sphere.center;
        const depth = (center.x - cameraPosition.x) * cameraForward.x
          + (center.y - cameraPosition.y) * cameraForward.y
          + (center.z - cameraPosition.z) * cameraForward.z - anchor.sphere.radius;
        if (!anchor.valid || depth <= 0) {
          anchor.node.visible = true;
          continue;
        }
        // Perspective size depends on camera-space depth, not radial distance:
        // labels at the viewport edges must retain the same detail as central
        // labels at the same depth. The sphere's near surface is conservative.
        const pixels = focalPixels * anchor.glyphHeight / depth;
        if (pixels < hideBelowPixels) anchor.node.visible = false;
        else if (pixels > showAbovePixels) anchor.node.visible = true;
      }
    },
  };
}
