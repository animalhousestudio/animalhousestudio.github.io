import { Box3, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

// Subtract a real rectangular passage from the basin triangles. Splitting at
// all six planes preserves the surrounding slope and interpolated soil colors.
export function cutBasinPortal(source, opening) {
  const positions = [], colors = [], position = source.attributes.position, color = source.attributes.color;
  const index = source.index, bounds = new Box3();
  const planes = [['x',1,opening.max.x], ['x',-1,-opening.min.x], ['y',1,opening.max.y],
    ['y',-1,-opening.min.y], ['z',1,opening.max.z], ['z',-1,-opening.min.z]];
  const emit = polygon => {
    for (let i = 1; i + 1 < polygon.length; i++) for (const vertex of [polygon[0], polygon[i], polygon[i+1]]) {
      positions.push(...vertex.p.toArray()); colors.push(...vertex.c.toArray());
    }
  };
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    let polygon = [0,1,2].map(j => {
      const n = index ? index.getX(i+j) : i+j;
      return { p: new Vector3().fromBufferAttribute(position, n),
        c: color ? new Vector3().fromBufferAttribute(color, n) : new Vector3(1,1,1) };
    });
    bounds.setFromPoints(polygon.map(vertex => vertex.p));
    if (!bounds.intersectsBox(opening)) { emit(polygon); continue; }
    for (const [axis, sign, limit] of planes) {
      if (!polygon.length) break;
      const inside = [], outside = [];
      for (let j = 0; j < polygon.length; j++) {
        const a = polygon[j], b = polygon[(j+1)%polygon.length];
        const da = a.p[axis]*sign-limit, db = b.p[axis]*sign-limit;
        (da <= 0 ? inside : outside).push(a);
        if ((da <= 0) !== (db <= 0)) {
          const fraction = da / (da-db), vertex = { p:a.p.clone().lerp(b.p,fraction), c:a.c.clone().lerp(b.c,fraction) };
          inside.push(vertex); outside.push(vertex);
        }
      }
      emit(outside); polygon = inside;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
