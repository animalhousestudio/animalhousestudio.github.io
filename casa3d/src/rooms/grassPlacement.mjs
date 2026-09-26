import { noise, terrainHeight, allowsGrass } from './terrainDetail.mjs';
import { lawnDensity, reservedGround, borderDistance, ellipseDistance, GARDEN } from './landscapeLayout.mjs';
export function grassSites(count, isClearArea) {
  const sites = [];
  for (let i = 0; i < count * 80 && sites.length < count; i++) {
    const x = (noise(i, 201) - .5) * 80, z = (noise(i, 202) - .5) * 80;
    if (noise(i, 203) > lawnDensity(x, z) || !isClearArea(x, z) || !allowsGrass(x, z)) continue;
    // Include the full tuft width, so leaves cannot cover the stepping stones.
    if (reservedGround(x, z, .17) || borderDistance(x, z) < .27) continue;
    const lush = ellipseDistance(x, z, GARDEN) < .95;
    sites.push({ x, z, y: terrainHeight(x, z) + .003, yaw: noise(i, 204) * Math.PI * 2,
      width: .7 + noise(i, 205) * .5, height: (lush ? .8 : .55) + noise(i, 206) * .45 });
  }
  return sites;
}

