import { WORLD_ZONE_IDS as Z } from './catalog.mjs';

// Scene instances, separate from reusable assets and their quality tiers.
// Structural content remains resident. Decorative visibility never removes physics.
export const WORLD_CONTENT = Object.freeze([
  { id: 'asteroid-ground', root: 'asteroid', zone: Z.ASTEROID, kind: 'structure' },
  { id: 'mansion-shell', root: 'ExteriorHome', zone: Z.HOUSE_SHELL, kind: 'structure' },
  { id: 'basement', root: 'Interior_0', zone: Z.BASEMENT, kind: 'structure' },
  { id: 'living-room', root: 'Interior_1', zone: Z.LIVING, kind: 'structure' },
  { id: 'kitchen', root: 'Interior_2', zone: Z.KITCHEN, kind: 'structure' },
  { id: 'upper-gallery', root: 'Interior_3', zone: Z.GALLERY, kind: 'structure' },
  { id: 'observatory', root: 'Interior_4', zone: Z.OBSERVATORY, kind: 'structure' },
  { id: 'elevator', root: 'elevator', zone: Z.HOUSE_SHELL, kind: 'structure' },
  { id: 'landing-beehive', root: 'LandingBeehive', zone: Z.ARRIVAL, kind: 'decoration', asset: 'beehive' },
  { id: 'landing-jetpack', root: 'LandingJetpack', zone: Z.ARRIVAL, kind: 'structure' },
  { id: 'chocolate-fountain', root: 'ChocolateTritonFountain', zone: Z.ARRIVAL, kind: 'decoration', asset: 'fountain' },
  { id: 'crashed-ufo', root: 'CrashedUFO', zone: Z.ASTEROID, kind: 'decoration' },
  { id: 'landing-keyboard', root: 'AsteroidKeyboard', zone: Z.ARRIVAL, kind: 'decoration' },
  { id: 'punchball', root: 'AsteroidPunchball', zone: Z.SPORTS, kind: 'decoration' },
  { id: 'garden-rocks', root: 'NaturalRocks', zone: Z.GARDEN, kind: 'decoration' },
  { id: 'garden-trees', root: 'NaturalTrees', zone: Z.GARDEN, kind: 'decoration' },
  { id: 'meadow', root: 'FluffyMeadow', zone: Z.ASTEROID, kind: 'decoration' },
  { id: 'stone-paths', root: 'RoundStoneLandscape', zone: Z.GARDEN, kind: 'structure' },
  { id: 'soccer-pitch', root: 'BlenderSoccerPitch', zone: Z.SPORTS, kind: 'structure' },
  { id: 'garden-pond', root: 'DeepGardenPond', zone: Z.GARDEN, kind: 'structure' },
  { id: 'garden-stage', root: 'GardenStage', zone: Z.GARDEN, kind: 'structure', asset: 'garden-stage' },
].map(Object.freeze));

/** Register after content is assembled, before the final parent batching pass. */
export function registerWorldContent(zones, world, { asteroid, elevator }) {
  for (const content of WORLD_CONTENT) {
    const root = content.root === 'asteroid' ? asteroid
      : content.root === 'elevator' ? elevator : world.getObjectByName(content.root);
    if (!root) throw new Error(`Missing world content: ${content.id} (${content.root})`);
    zones.register(content.zone, root, {
      contentId: content.id,
      decorative: content.kind === 'decoration',
      // Do not infer wall occlusion from a floor number: windows and shafts stay open.
      margin: 3,
    });
  }
}
