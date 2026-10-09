import * as THREE from 'three';

export function createGrass(game, mask, count = 14000) {
  const positions = [], colors = [];
  // Three bent blades per clump, with dark roots and sunlit tips.
  for (let blade = 0; blade < 3; blade++) {
    const angle = blade * Math.PI / 3, c = Math.cos(angle), s = Math.sin(angle);
    const vertex = (x, y, bend) => { positions.push(x * c + bend * s, y, -x * s + bend * c); colors.push(0.4 + y * 1.5, 0.5 + y * 1.25, 0.23 + y * 0.7); };
    for (let segment = 0; segment < 2; segment++) {
      const y0 = segment * 0.12, y1 = (segment + 1) * 0.12;
      const w0 = 0.025 * (1 - segment / 2), w1 = 0.025 * (1 - (segment + 1) / 2);
      for (const [x, y] of [[-w0, y0], [w0, y0], [-w1, y1], [w0, y0], [w1, y1], [-w1, y1]]) vertex(x, y, y * y * 0.8);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const time = { value: 0 }, fog = { value: 1 };
  const material = new THREE.MeshStandardMaterial({ color: 0x9aa769, vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.grassTime = time; shader.uniforms.groundMask = { value: mask }; shader.uniforms.showFog = fog;
    shader.vertexShader = `uniform float grassTime; varying vec2 grassWorld;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        grassWorld = root.xz;
        transformed.x += sin(grassTime * 1.7 + root.x * 0.8 + root.z * 0.5) * position.y * 0.18;
      `);
    shader.fragmentShader = `uniform sampler2D groundMask; uniform float showFog; varying vec2 grassWorld;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 maskUV = grassWorld / ${game.map.size.toFixed(1)};
        vec4 groundState = texture2D(groundMask, maskUV);
        if (groundState.g > 0.5 || (showFog > 0.5 && groundState.r < 0.1)) discard;
        diffuseColor.rgb *= showFog > 0.5 ? mix(0.28, 1.0, groundState.r) : 1.0;
      `);
  };
  material.customProgramCacheKey = () => `grass-${game.map.size}`;
  const mesh = new THREE.InstancedMesh(geometry, material, count), matrix = new THREE.Matrix4(), transform = new THREE.Object3D();
  mesh.receiveShadow = true; mesh.userData.skipAO = true; mesh.raycast = () => {};
  let seed = game.seed >>> 0, added = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let attempt = 0; added < count && attempt < count * 4; attempt++) {
    const x = random() * game.map.size, z = random() * game.map.size;
    if (game.map.tiles[Math.floor(z) * game.map.size + Math.floor(x)] === 1) continue;
    // Cluster growth into meadows instead of a uniform scatter of identical blades.
    const patch = 0.5 + 0.5 * Math.sin(x * 0.68 + Math.sin(z * 0.23) * 2) * Math.sin(z * 0.57);
    if (random() > 0.18 + patch * 0.8) continue;
    if (game.map.starts.some(start => Math.hypot(x - start.x - 0.5, z - start.y - 0.5) < 2.6)) continue;
    transform.position.set(x, 0.012, z); transform.rotation.y = random() * Math.PI * 2;
    transform.scale.setScalar(0.6 + random() * 0.9); transform.updateMatrix(); matrix.copy(transform.matrix);
    mesh.setMatrixAt(added++, matrix);
  }
  mesh.count = added; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  return { mesh, setCount(value) { mesh.count = Math.min(added, value); }, update(t, fogEnabled) { time.value = t; fog.value = fogEnabled ? 1 : 0; } };
}
