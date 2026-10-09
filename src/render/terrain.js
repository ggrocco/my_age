import * as THREE from 'three';
import { createGrass } from './grass.js';

// Visual noise has its own seed; it never consumes the simulation's RNG.
function hash(x, y, seed) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let u = x - ix, v = y - iy;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

export function createTerrain(game, renderer, preset) {
  const { size: n, tiles, starts } = game.map, scale = 24;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = n * scale;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(canvas.width, canvas.height);
  const waterAt = (x, y) => x >= 0 && y >= 0 && x < n && y < n && tiles[y * n + x] === 1;
  // Distance to the opposite terrain type gives shores a sand / shallow-water fringe.
  const shore = new Float32Array(n * n).fill(4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (waterAt(x, y) !== waterAt(x + dx, y + dy)) shore[y * n + x] = Math.min(shore[y * n + x], Math.hypot(dx, dy));
    }
  }
  const shoreAt = (x, y) => {
    const ix = Math.floor(x - 0.5), iy = Math.floor(y - 0.5), u = x - 0.5 - ix, v = y - 0.5 - iy;
    const at = (xx, yy) => shore[Math.max(0, Math.min(n - 1, yy)) * n + Math.max(0, Math.min(n - 1, xx))];
    return (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v)
      + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
  };
  for (let py = 0; py < canvas.height; py++) for (let px = 0; px < canvas.width; px++) {
    const x = px / scale, y = py / scale, tile = Math.floor(y) * n + Math.floor(x);
    const broad = noise(x * 0.22, y * 0.22, game.seed), detail = noise(x * 2.7, y * 2.7, game.seed + 9);
    const grain = hash(px, py, game.seed + 31) - 0.5;
    const i = (py * canvas.width + px) * 4;
    let color;
    if (tiles[tile] === 1) {
      const shallow = Math.max(0, 1 - shoreAt(x, y) / 4);
      color = [28 + shallow * 28, 68 + shallow * 38, 74 + shallow * 34];
    } else {
      let earth = Math.max(0, (broad - 0.52) * 2.2);
      for (const start of starts) {
        const distance = Math.hypot(x - start.x - 0.5, y - start.y - 0.5);
        earth = Math.max(earth, Math.max(0, 1 - distance / 5) * 0.85);
      }
      const sand = Math.max(0, 1 - shoreAt(x, y) / 2) * 0.7;
      const grass = [83 + broad * 30, 94 + broad * 30, 47 + broad * 16];
      color = grass.map((v, c) => v * (1 - earth) + [141, 119, 80][c] * earth);
      color = color.map((v, c) => v * (1 - sand) + [166, 150, 106][c] * sand);
    }
    for (let c = 0; c < 3; c++) pixels.data[i + c] = color[c] + (detail - 0.5) * 17 + grain * 13;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const geometry = new THREE.PlaneGeometry(n, n);
  const micro = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < 128 * 128; i++) {
    const value = 115 + hash(i % 128, i / 128 | 0, game.seed) * 110;
    micro.set([value, value, value, 255], i * 4);
  }
  const bumpTexture = new THREE.DataTexture(micro, 128, 128);
  bumpTexture.wrapS = bumpTexture.wrapT = THREE.RepeatWrapping;
  bumpTexture.magFilter = THREE.LinearFilter; bumpTexture.minFilter = THREE.LinearMipmapLinearFilter;
  bumpTexture.generateMipmaps = true; bumpTexture.repeat.set(n / 4, n / 4); bumpTexture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture, bumpMap: bumpTexture, bumpScale: 0.045, roughness: 0.96 });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2; ground.position.set(n / 2, 0, n / 2); ground.receiveShadow = true;

  // Water remains clipped to the simulation grid; its normal map animates without
  // altering the ground used for picking or pathfinding.
  const positions = [], uvs = [], shores = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (waterAt(x, y)) {
    for (const [px, py] of [[x,y], [x,y+1], [x+1,y], [x+1,y], [x,y+1], [x+1,y+1]]) {
      positions.push(px, 0.025, py); uvs.push(px / 4, py / 4); shores.push(shoreAt(px, py));
    }
  }
  const waterGeometry = new THREE.BufferGeometry();
  waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  waterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  waterGeometry.setAttribute('shore', new THREE.Float32BufferAttribute(shores, 1)); waterGeometry.computeVertexNormals();
  const normalData = new Uint8Array(128 * 128 * 4), tau = Math.PI * 2;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = x / 128 * tau, v = y / 128 * tau;
    const dx = Math.cos(u * 4 + v * 3) * 0.4 + Math.cos(u * 9 - v * 5) * 0.25 + Math.cos(u * 16 + v * 13) * 0.12;
    const dy = Math.cos(u * 4 + v * 3) * 0.3 - Math.cos(u * 9 - v * 5) * 0.15 + Math.cos(u * 16 + v * 13) * 0.10;
    const normal = new THREE.Vector3(-dx, -dy, 1).normalize();
    normalData.set([(normal.x * 0.5 + 0.5) * 255, (normal.y * 0.5 + 0.5) * 255, (normal.z * 0.5 + 0.5) * 255, 255], (y * 128 + x) * 4);
  }
  const normalTexture = new THREE.DataTexture(normalData, 128, 128);
  normalTexture.wrapS = normalTexture.wrapT = THREE.RepeatWrapping;
  normalTexture.magFilter = THREE.LinearFilter; normalTexture.minFilter = THREE.LinearMipmapLinearFilter;
  normalTexture.generateMipmaps = true; normalTexture.needsUpdate = true;
  const waterTime = { value: 0 };
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x3c7776, normalMap: normalTexture, normalScale: new THREE.Vector2(0.32, 0.32),
    roughness: 0.22, metalness: 0.18, clearcoat: 0.65, clearcoatRoughness: 0.22,
    envMapIntensity: 1.1, transparent: true, opacity: 0.78, depthWrite: false,
  });
  waterMaterial.onBeforeCompile = shader => {
    shader.uniforms.waterTime = waterTime;
    shader.vertexShader = `attribute float shore; varying float waterShore; varying vec2 waterWorld;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nwaterShore = shore; waterWorld = position.xz;');
    shader.fragmentShader = `uniform float waterTime; varying float waterShore; varying vec2 waterWorld;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        float shallows = 1.0 - smoothstep(0.8, 2.7, waterShore);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.31, 0.25), shallows * 0.5);
        float foam = pow(0.5 + 0.5 * sin(waterWorld.x * 3.0 + waterWorld.y * 4.0 - waterTime * 0.8), 8.0);
        diffuseColor.rgb += (1.0 - smoothstep(0.85, 1.25, waterShore)) * foam * 0.16;
      `);
  };
  waterMaterial.customProgramCacheKey = () => 'water-shore-v1';
  const water = new THREE.Mesh(waterGeometry, waterMaterial); water.raycast = () => {};

  // Red = knowledge/visibility, green = occupancy. Decorative grass never reveals
  // unseen terrain or pokes through completed or newly placed buildings.
  const maskData = new Uint8Array(n * n * 4), mask = new THREE.DataTexture(maskData, n, n);
  mask.magFilter = mask.minFilter = THREE.NearestFilter;
  const grass = createGrass(game, mask); grass.setCount(preset.grass);
  let maskStamp = -1;
  return { ground, water, grass: grass.mesh, setQuality(next) { grass.setCount(next.grass); },
    update(t, fogEnabled = true) {
      waterTime.value = t; normalTexture.offset.set(t * 0.008 % 1, t * 0.005 % 1); grass.update(t, fogEnabled);
      if (maskStamp !== game.time && (game.time % 4 === 0 || maskStamp < 0)) {
        maskStamp = game.time;
        for (let i = 0; i < n * n; i++) {
          maskData[i * 4] = game.players[0].visible[i] ? 255 : game.players[0].explored[i] ? 100 : 0;
          maskData[i * 4 + 1] = game.occAt(i % n, i / n | 0) ? 255 : 0; maskData[i * 4 + 3] = 255;
        }
        mask.needsUpdate = true;
      }
    },
    dispose() { texture.dispose(); bumpTexture.dispose(); normalTexture.dispose(); mask.dispose(); },
  };
}
