# Water reference

Starting point: https://github.com/jeantimex/threejs-water (Yong Su's Three.js port of Evan Wallace's WebGL Water).
Inspected on 2026-10-01: `src/Water.ts`, `src/shaders/WaveSimulation.frag`, `src/shaders/WaterAbove.frag` and the rendering passes.

`rooms/pondWater.mjs` adapts the two-buffer height/velocity wave equation, cosine disturbance kernel and Fresnel/refraction concepts. It is a smaller implementation for the existing Three.js 0.158 runtime, with a fixed simulation cadence, elliptical absorbing boundary, half-float framebuffer validation and an analytical mobile fallback. The complete MIT notice is included in LICENSE and in the runtime pond metadata.

Differences: no imported demo application, BVH dependency, scene reflection/refraction captures, object texture passes or caustic pass. Only one opaque surface is rendered. Reflection uses a sky gradient; optical attenuation approximates the water column with Beer–Lambert absorption. This is not a raytraced reflection of the surrounding garden. Low/mobile tiers allocate no simulation textures; supported near desktop tiers use two 64² or 128² buffers. The underwater exploration controls are a later stage.
