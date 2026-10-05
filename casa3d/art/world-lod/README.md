# Existing prop LODs

This package derives two lighter versions of the existing Triton chocolate fountain and dreamy beehive. It changes neither their approved design nor their placement. The original `.blend` authoring files and near `.glb` files remain untouched. No generation service, new model, paid tool or deployment is involved.

| Asset | Near triangles | Medium triangles | Far triangles | Near bytes | Medium bytes | Far bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fountain | 207,706 | 40,999 | 10,229 | 4,967,136 | 1,079,860 | 342,388 |
| Beehive | 112,756 | 24,746 | 10,444 | 5,419,764 | 1,673,696 | 544,296 |

The combined geometry falls from 320,462 to 65,745 triangles in medium, or 20,673 in far. These are asset counts, not whole-scene render counts or measured FPS improvements.

## Reproduce

From the repository root, with Blender **5.2.0 LTS** available as `blender`:

```powershell
blender --background --factory-startup --python-exit-code 1 --python casa3d/art/world-lod/generate_lods.py
blender --background --factory-startup --python-exit-code 1 --python casa3d/art/world-lod/render_review.py
python casa3d/art/world-lod/compose_review.py
python casa3d/art/world-lod/verify_assets.py
```

On Windows, replace `blender` with `& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'` if it is not on PATH. The generator and renderer use Blender's bundled Python/NumPy. The contact-sheet compositor needs Pillow and NumPy; the read-only verifier uses only the Python standard library.

`generate_lods.py` resolves paths from its own location, starts each tier from the source GLB, and writes only derived models and metadata. Its output paths are:

- `../../src/assets/models/lod/triton-chocolate-fountain-{medium,far}.glb`
- `../../src/assets/models/lod/beehive-dreamy-{medium,far}.glb`
- `../../src/assets/models/lod/metadata.json`
- `manifest.json`

The source GLBs are `../../src/assets/models/props/triton-chocolate-fountain.glb` and `../../src/assets/models/props/beehive-dreamy.glb`. Their previous authoring provenance is documented in `../triton-fountain-v01/README.md` and `../beehive-v01/README.md`.

## Geometry and resource contract

The generator imports each original, welds coincident vertices within **0.000001 source world units**, dissolves degenerate edges within **0.00000001 units**, and runs Blender's COLLAPSE decimator at **0.20** for medium and **0.05** for far. Decimation is measured in world units before restoring original local mesh coordinates, so nonuniformly scaled parts receive consistent treatment. It validates the resulting mesh and triangulates the output.

The final GLB copies the original node tree, scenes, authored transforms, material definitions, material names, texture slots and samplers verbatim. It replaces mesh buffers/accessors and retains UV and normal attributes. This avoids a material change or a second model normalization during a LOD switch. Medium keeps the original image payloads; far reduces the beehive's six wood maps from **512 × 256** to **128 × 64**. The fountain has no embedded image maps to reduce.

The far beehive deliberately retains **9.26%** of the original triangles instead of forcing a 5% total. Its disconnected honeycomb cells reach the decimator's minimum while preserving their shape. Deleting cells solely to hit the nominal ratio would change the front detail. This exception is recorded in the manifest.

`manifest.json` records source/output SHA-256 hashes, byte sizes, node/material/vertex/triangle counts, per-mesh reduction, texture sizes and reproducible settings. It has an `assets` object with `fountain` and `beehive`, each containing `source` and `tiers.medium/far`. `metadata.json` exposes those two asset names directly for runtime use. Its `bounds` always describe the **original** model, using the union of transformed local mesh AABBs to match `THREE.Box3.setFromObject` default behavior. `tightBounds` in the full manifest is separate geometry QA data; it must not replace the stable normalization bounds.

## Review evidence

The 12 files in `renders/` are fixed front/reverse orthographic views for near, medium and far, rendered with identical studio camera and lighting. The fountain review applies the same stone/chocolate colour overrides as the game. The contact sheets compare the original 384-pixel frames and 96-pixel downsampled frames; they do not claim to be in-game screenshots.

- [Fountain comparison](renders/fountain-comparison.png)
- [Beehive comparison](renders/beehive-comparison.png)
- `silhouette-metrics.json`: alpha-mask comparisons, with frame dimensions and mask pixel counts.
- `verification.json`: recorded result of `verify_assets.py`.
- `review-record.json`: visual observations and limitations.
- `final-report.json`: focused delivery record for this asset change.
- [Runtime review](runtime/README.md): in-game views and functional LOD samples,
  separate from the studio render review and performance measurements.

All 12 source renders were visually inspected. Medium retains the two props' silhouette, material separation and distinctive features. The far fountain visibly facets its basin and raised arms when enlarged to roughly 290 pixels tall; it belongs at small projected sizes. The far beehive softens wood grain and honeycomb highlights while retaining its roof, doors, frames and both bee badges. At a 96-pixel frame (approximately 75-pixel object height), both remain recognisable with no displaced parts or broken texture mapping observed.

At a 384-pixel frame, medium/near silhouette intersection-over-union is **99.38–99.42%** for the fountain and **99.90–99.91%** for the beehive. Far/near is **97.58–97.66%** and **99.70–99.73%**, respectively. These are silhouette overlap measurements, not a claim of perceptual equivalence.

## Scope and limitations

This is an existing-asset export and review package, not a new room layout. The focused record preserves the approved design and existing provenance; it does not invent new Function/Form approvals or run unrelated room-layout gates. No human visual approval or deployment authorization is inferred from successful generation, hashes or renders.

The studio review does not measure GPU time, frame rate, peak memory, production-camera transitions, interaction behavior or collision. Runtime LOD thresholds must keep the far fountain small and use the stable original bounds for every tier. The scene integration and production-camera review are owned by the runtime change. The originals remain the near tier for close inspection.
