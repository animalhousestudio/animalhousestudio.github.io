// The monitor has its own viewpoint. Restore only authored decoration roots
// for this pass; first-person culling must not erase the garden behind us.
export function renderIntercomSurroundings({ renderer, camera, scene, sky, entries, hidden }) {
  const previous = new Map();
  const setVisible = (object, visible) => {
    if (!object) return;
    if (!previous.has(object)) previous.set(object, object.visible);
    object.visible = visible;
  };
  try {
    for (const entry of entries) if (entry.decorative) setVisible(entry.root, entry.authoredVisible);
    // Avoid a second headless body and any feedback from the monitor itself.
    for (const object of hidden) setVisible(object, false);
    sky.render(renderer, camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
  } finally {
    for (const [object, visible] of previous) object.visible = visible;
  }
}
