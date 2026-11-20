import { CustomToneMapping, ShaderChunk } from 'three';

// Three r158 exposes CustomToneMapping in its shared output chunk. This is
// applied in the material's own draw, after lighting and before sRGB encoding.
const original = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
const gouache = `vec3 CustomToneMapping(vec3 color) {
  color = max(vec3(0.), color * toneMappingExposure);
  float value = max(color.r, max(color.g, color.b));
  float light = sqrt(value / (value + .78));
  float plate = light * 7.;
  float stepped = (floor(plate) + smoothstep(.20, .80, fract(plate))) / 7.;
  float tone = mix(light, stepped, .46);
  vec3 pigment = color / max(value, .0001);
  float luma = dot(pigment, vec3(.2126,.7152,.0722));
  pigment = mix(vec3(luma), pigment, .89);
  vec3 paper = vec3(.012,.014,.039) * (1.-light)*(1.-light);
  return clamp(paper + pigment*tone*tone*vec3(1.31,1.25,1.22), 0., 1.);
}`;

export function useIllustratedColor(renderer) {
  if (ShaderChunk.tonemapping_pars_fragment.includes(original)) {
    ShaderChunk.tonemapping_pars_fragment = ShaderChunk.tonemapping_pars_fragment.replace(original,gouache);
    // Add a narrow indigo edge to curved lit forms with the existing view normal.
    ShaderChunk.opaque_fragment = `
      #if defined(STANDARD) && defined(TONE_MAPPING) && defined(OPAQUE)
        float facingInk = abs(dot(normal, geometryViewDir));
        float rimInk = 1. - smoothstep(.035,.22,facingInk);
        outgoingLight = mix(outgoingLight, outgoingLight*vec3(.43,.45,.60), rimInk*.70);
      #endif
    ` + ShaderChunk.opaque_fragment;
  }
  renderer.toneMapping = CustomToneMapping;
  renderer.toneMappingExposure = 1.12;
}

export const NIGHT_INK = 0x161a36;
