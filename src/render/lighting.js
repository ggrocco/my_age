import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createSkyLighting(renderer) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d'), sky = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [at, color] of [[0, '#769fc0'], [0.35, '#c0d4dc'], [0.5, '#f1e4c2'], [0.54, '#78845b'], [1, '#393426']]) sky.addColorStop(at, color);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
  const glow = ctx.createRadialGradient(130, 90, 0, 130, 90, 36);
  glow.addColorStop(0, '#fff8df'); glow.addColorStop(0.25, '#fff4d9b0'); glow.addColorStop(1, '#fff4d900');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 256);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer), target = generator.fromEquirectangular(texture);
  generator.dispose(); texture.dispose();
  return target;
}

// Render only solid world geometry into AO. UI rings, fog, water and ground-cover
// overlays must not become opaque occluders in the normal/depth pass.
class WorldAO extends SSAOPass {
  render(renderer, writeBuffer, readBuffer, ...rest) {
    const hidden = [], autoShadow = renderer.shadowMap.autoUpdate;
    this.scene.traverse(o => {
      if (o.isMesh && o.visible && (o.userData.skipAO || o.material.transparent || o.material.depthTest === false)) {
        hidden.push(o); o.visible = false;
      }
    });
    renderer.shadowMap.autoUpdate = false;
    this.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
    this.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
    try { super.render(renderer, writeBuffer, readBuffer, ...rest); }
    finally { hidden.forEach(o => { o.visible = true; }); renderer.shadowMap.autoUpdate = autoShadow; }
  }
  dispose() {
    super.dispose(); this.ssaoMaterial.dispose(); this.noiseTexture.dispose();
  }
}

export function createLightingEffects(renderer, scene, camera, preset) {
  // Float render targets are required by SSAOPass; direct rendering is the fallback.
  if (!preset.ao || !renderer.extensions.has('EXT_color_buffer_float')) return {
    enabled: false, resize() {}, render() { renderer.render(scene, camera); }, dispose() {},
  };
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: preset.samples > 12 ? 4 : 2 });
  const composer = new EffectComposer(renderer, target), beauty = new RenderPass(scene, camera);
  const ao = new WorldAO(scene, camera, 1, 1, preset.samples), output = new OutputPass();
  ao.ssaoMaterial.defines.PERSPECTIVE_CAMERA = 0;
  ao.depthRenderMaterial.defines.PERSPECTIVE_CAMERA = 0;
  ao.kernelRadius = 0.65; ao.minDistance = 0.00015; ao.maxDistance = 0.018;
  composer.addPass(beauty); composer.addPass(ao); composer.addPass(output);
  return {
    enabled: true,
    resize(width, height) {
      const ratio = renderer.getPixelRatio();
      composer.setPixelRatio(ratio); composer.setSize(width, height);
      ao.setSize(Math.max(1, Math.round(width * ratio * preset.ao)), Math.max(1, Math.round(height * ratio * preset.ao)));
    },
    render() { composer.render(); },
    dispose() { ao.dispose(); output.dispose(); beauty.dispose(); composer.dispose(); },
  };
}
