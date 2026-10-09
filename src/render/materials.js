import * as THREE from 'three';

// One material/draw call per merged model, with per-vertex surface categories.
// The procedural detail is anchored in model space so it does not slide as units move.
const WOOD = new Set([0x7a5230, 0x4e3320, 0x685038, 0x6b4423, 0xa8823f, 0xb5854f]);
const STONE = new Set([0x9a9a92, 0x6f6f68, 0xefe9dc, 0xd9cfb0, 0xa6977b, 0xb3a487, 0xc9baa0, 0xa99a7f]);
const WALL = new Set([0xe6d8b4, 0xd7c7a4, 0xbda77f, 0xcbb890]);
const METAL = new Set([0xb9c0c8, 0xb5803a, 0xf2c230, 0x697678, 0x303a3c]);
export function surfaceKind(color) {
  return WOOD.has(color) ? 1 : STONE.has(color) ? 2 : WALL.has(color) ? 3 : METAL.has(color) ? 4 : 0;
}

export function createModelMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  material.userData.shared = true;
  material.onBeforeCompile = shader => {
    shader.vertexShader = `attribute float surface; varying float vSurface; varying vec3 vSurfacePosition;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = surface; vSurfacePosition = position;');
    shader.fragmentShader = `varying float vSurface; varying vec3 vSurfacePosition;
      float surfaceNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        float n = dot(i, vec3(1.0, 57.0, 113.0));
        vec4 a = fract(sin(vec4(n, n+1.0, n+57.0, n+58.0)) * 43758.5453);
        vec4 b = fract(sin(vec4(n+113.0, n+114.0, n+170.0, n+171.0)) * 43758.5453);
        return mix(mix(mix(a.x,a.y,f.x),mix(a.z,a.w,f.x),f.y),
                   mix(mix(b.x,b.y,f.x),mix(b.z,b.w,f.x),f.y),f.z);
      }
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float patina = surfaceNoise(vSurfacePosition * 19.0);
      float relief = 0.0;
      if (vSurface > 0.5 && vSurface < 1.5) {
        float grain = sin(vSurfacePosition.y * 5.0 + surfaceNoise(vSurfacePosition * vec3(18.0, 1.8, 18.0)) * 18.0);
        diffuseColor.rgb *= 0.82 + 0.18 * patina + 0.12 * grain;
        relief = grain * 0.003;
      } else if (vSurface < 3.5 && vSurface > 1.5) {
        diffuseColor.rgb *= 0.87 + 0.22 * patina;
        relief = patina * 0.012;
        if (vSurface < 2.5) {
          float course = abs(fract(vSurfacePosition.y * 6.0) - 0.5);
          float joint = smoothstep(0.455, 0.485, course);
          diffuseColor.rgb *= 1.0 - joint * 0.18;
          relief -= joint * 0.008;
        }
      } else if (vSurface > 3.5) { diffuseColor.rgb *= 0.93 + 0.10 * patina; }
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      if (vSurface > 3.5) roughnessFactor = 0.32 + patina * 0.17;
    `).replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      if (vSurface > 3.5) metalnessFactor = 0.7;
    `).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 qx = dFdx(-vViewPosition), qy = dFdy(-vViewPosition);
      vec3 rx = cross(qy, normal), ry = cross(normal, qx);
      float determinant = dot(qx, rx);
      normal = normalize(abs(determinant) * normal - sign(determinant) * (dFdx(relief) * rx + dFdy(relief) * ry));
    `);
  };
  material.customProgramCacheKey = () => 'ancient-surfaces-v1';
  return material;
}
