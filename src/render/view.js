import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings.js';
import { RES_KIND } from '../sim/util.js';
import { buildModel, animate } from './models.js';

export const OWNER_COLOR = [0x3b82f6, 0xef4444];
const geo = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), cone: new THREE.ConeGeometry(0.5, 1, 4), cone8: new THREE.ConeGeometry(0.5, 1, 8), sph: new THREE.SphereGeometry(0.5, 12, 8), rock: new THREE.DodecahedronGeometry(0.5), ring: new THREE.RingGeometry(0.55, 0.7, 24), circle: new THREE.CircleGeometry(1, 20), plane: new THREE.PlaneGeometry(1, 1) };
const matCache = new Map();
const mat = (c, opts = {}) => { const k = c + JSON.stringify(opts); if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color: c, ...opts })); return matCache.get(k); };
function part(g, color, sx, sy, sz, x = 0, y = 0, z = 0, rx = 0) { const m = new THREE.Mesh(geo[g], mat(color)); m.scale.set(sx, sy, sz); m.position.set(x, y + sy / 2, z); m.rotation.x = rx; return m; }

export function createView(container, game) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x10140f);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7a55, 0.95));
  const sun = new THREE.DirectionalLight(0xfff2d0, 0.9); sun.position.set(-30, 60, 20); scene.add(sun);
  const N = game.map.size;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
  const view = { renderer, scene, camera, zoom: 14, focus: new THREE.Vector3(N / 2, 0, N / 2), groups: new Map(), pickables: [], dom: renderer.domElement };
  const DIR = new THREE.Vector3(1, 1.05, 1).normalize();
  function placeCamera() {
    const w = renderer.domElement.clientWidth || 1, h = renderer.domElement.clientHeight || 1, a = w / h;
    const hh = a < 1 ? view.zoom * 1.2 / a : view.zoom; camera.left = -hh * a; camera.right = hh * a; camera.top = hh; camera.bottom = -hh; camera.updateProjectionMatrix();
    camera.position.copy(view.focus).addScaledVector(DIR, 120); camera.lookAt(view.focus); camera.updateMatrixWorld(true);
  }
  view.refreshCamera = placeCamera; view.halfExtents = () => [camera.right, camera.top];
  view.resize = () => { renderer.setSize(container.clientWidth, container.clientHeight, false); placeCamera(); };
  view.pan = (dx, dz) => { view.focus.x = Math.max(0, Math.min(N, view.focus.x + dx)); view.focus.z = Math.max(0, Math.min(N, view.focus.z + dz)); };
  view.setZoom = z => { view.zoom = Math.max(6, Math.min(34, z)); };
  view.centerOn = (x, y) => { view.focus.set(x, 0, y); };

  // terrain
  const tex = document.createElement('canvas'); tex.width = tex.height = N * 8; const tc = tex.getContext('2d');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const water = game.map.tiles[y * N + x] === 1, h = ((x * 73856093) ^ (y * 19349663)) >>> 0, v = (h % 100) / 100;
    tc.fillStyle = water ? `hsl(205 ${55 + v * 10}% ${34 + v * 6}%)` : `hsl(${92 + v * 12} ${38 + v * 8}% ${34 + v * 7}%)`; tc.fillRect(x * 8, y * 8, 8, 8);
  }
  const ground = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(tex) }));
  ground.rotation.x = -Math.PI / 2; ground.scale.set(N, N, 1); ground.position.set(N / 2, 0, N / 2); scene.add(ground);
  const outer = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ color: 0x1c2618 })); outer.rotation.x = -Math.PI / 2; outer.scale.set(N * 3, N * 3, 1); outer.position.set(N / 2, -0.05, N / 2); scene.add(outer);
  view.ground = ground;

  // fog of war overlay
  const fogCanvas = document.createElement('canvas'); fogCanvas.width = fogCanvas.height = N; const fctx = fogCanvas.getContext('2d'), fogImg = fctx.createImageData(N, N);
  const fogTex = new THREE.CanvasTexture(fogCanvas); fogTex.magFilter = THREE.LinearFilter;
  const fog = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false }));
  fog.rotation.x = -Math.PI / 2; fog.scale.set(N, N, 1); fog.position.set(N / 2, 0.08, N / 2); fog.renderOrder = 1; scene.add(fog);
  let fogStamp = -1;
  function updateFog() {
    if (game.time === fogStamp || game.time % 4 !== 0 && fogStamp >= 0) return; fogStamp = game.time;
    const p = game.players[0], d = fogImg.data;
    for (let i = 0; i < N * N; i++) { d[i * 4] = 4; d[i * 4 + 1] = 6; d[i * 4 + 2] = 4; d[i * 4 + 3] = p.visible[i] ? 0 : p.explored[i] ? 110 : 235; }
    fctx.putImageData(fogImg, 0, 0); fogTex.needsUpdate = true;
  }
  view.fogEnabled = true;

  // entity meshes
  const _wq = new THREE.Quaternion();
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false });
  function makeMesh(e) {
    const g = new THREE.Group(); g.userData = { id: e.id, kind: e.kind, owner: e.owner, hp: e.hp };
    const m = buildModel(e); g.add(m.root); g.userData.anim = m.anim;
    const sh = new THREE.Mesh(geo.circle, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.scale.set(m.shadow * 1.2, m.shadow * 1.2, 1); sh.raycast = () => {}; g.add(sh);
    if (e.kind === 'unit' || e.kind === 'building') {
      const ring = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, depthTest: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
      const r = e.kind === 'building' ? e.size * 0.75 : 1; ring.scale.set(r * 1.4, r * 1.4, 1); ring.visible = false; ring.renderOrder = 3; g.add(ring); g.userData.ring = ring;
      const bg = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false })), fg = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false }));
      bg.renderOrder = fg.renderOrder = 4; bg.scale.set(1, 0.14, 1); const bar = new THREE.Group(); bar.add(bg, fg); bar.visible = false; bar.position.y = e.kind === 'building' ? (e.gatherType ? 0.8 : e.type === 'house' ? 1.8 : 2.6) : 1.5; g.add(bar); g.userData.bar = { bar, fg };
    }
    g.traverse(o => { if (!o.isMesh) return; if (o === g.userData.ring || o === sh || o.parent === g.userData.bar?.bar || o.material?.blending === THREE.AdditiveBlending) { o.raycast = () => {}; return; } o.userData.gid = e.id; });
    return g;
  }
  const seen = new Set();
  view.selection = new Set();
  view.sync = () => {
    updateFog();
    seen.clear();
    const list = [...game.visibleEntities(0), ...game.knownResources(0)];
    for (const e of list) {
      seen.add(e.id);
      let g = view.groups.get(e.id);
      if (!g) { g = makeMesh(e); view.groups.set(e.id, g); scene.add(g); view.pickables.push(g); g.position.set(...worldPos(e)); }
      g.userData.entity = e;
    }
    for (const [id, g] of view.groups) if (!seen.has(id) || !game.entities.has(id)) { scene.remove(g); view.groups.delete(id); const i = view.pickables.indexOf(g); if (i >= 0) view.pickables.splice(i, 1); }
  };
  const worldPos = e => e.kind === 'building' ? [e.x + e.size / 2, 0, e.y + e.size / 2] : [e.x, e.kind === 'relic' ? (e.holder !== null ? 1.35 : 0.2) : 0, e.y];
  view.frame = (dt, t) => {
    placeCamera();
    const k = Math.min(1, dt * 16);
    for (const g of view.groups.values()) {
      const e = g.userData.entity; if (!e) continue;
      const [x, y, z] = worldPos(e);
      const ud = g.userData; let moving = false;
      if (e.kind === 'unit') {
        g.position.x += (x - g.position.x) * k; g.position.z += (z - g.position.z) * k;
        const dx = x - g.position.x, dz = z - g.position.z; moving = Math.hypot(dx, dz) > 0.03;
        let face = null;
        if (moving) face = Math.atan2(dx, dz);
        else { const o = e.order, tgt = o.target !== undefined ? game.entities.get(o.target) : o.res !== undefined ? game.entities.get(o.res) : null; if (tgt) { const c = tgt.kind === 'building' ? { x: tgt.x + tgt.size / 2, y: tgt.y + tgt.size / 2 } : tgt; face = Math.atan2(c.x - e.x, c.y - e.y); } }
        if (face !== null) { let d = face - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 12); }
        g.position.y = e.relic !== null ? 0.25 : 0;
      } else g.position.set(x, y, z);
      if (e.kind === 'unit' || e.kind === 'building') { if (e.hp < ud.hp - 0.01) ud.pop = 0.12; ud.hp = e.hp; if (ud.pop > 0) { ud.pop -= dt; g.scale.setScalar(1 + Math.max(0, ud.pop) * (e.kind === 'unit' ? 1.6 : 0.25)); } else g.scale.setScalar(1); }
      animate(g, e, t, moving);
      if (ud.ring) ud.ring.visible = view.selection.has(e.id);
      if (ud.bar) { const show = view.selection.has(e.id) || e.hp < e.maxHp; ud.bar.bar.visible = show; if (show) { const f = Math.max(0.001, e.hp / e.maxHp); ud.bar.bar.parent.getWorldQuaternion(_wq).invert(); ud.bar.bar.quaternion.copy(_wq).multiply(camera.quaternion); ud.bar.fg.scale.set(f, 0.14, 1); ud.bar.fg.position.x = (f - 1) / 2; ud.bar.fg.position.z = 0.001; ud.bar.fg.material.color.setHex(f > 0.5 ? 0x22c55e : f > 0.25 ? 0xeab308 : 0xef4444); } }
    }
    fog.visible = view.fogEnabled;
    renderer.render(scene, camera);
  };
  // placement ghost
  const ghost = new THREE.Mesh(geo.box, new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.5, depthTest: false })); ghost.visible = false; ghost.renderOrder = 5; scene.add(ghost);
  view.showGhost = (type, tx, ty, ok) => { if (!type) { ghost.visible = false; return; } const s = BUILDINGS[type].size; ghost.visible = true; ghost.scale.set(s, 1.2, s); ghost.position.set(tx + s / 2, 0.6, ty + s / 2); ghost.material.color.setHex(ok ? 0x22c55e : 0xef4444); };
  // picking helpers
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const setRay = (cx, cy) => { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
  view.pickEntity = (cx, cy) => { setRay(cx, cy); const hits = ray.intersectObjects(view.pickables, true); for (const h of hits) { const id = h.object.userData.gid; if (id !== undefined && view.groups.get(id)) return view.groups.get(id).userData.entity; } return null; };
  view.pickGround = (cx, cy) => { setRay(cx, cy); const h = ray.intersectObject(ground)[0]; return h ? { x: h.point.x, y: h.point.z } : null; };
  view.project = (x, y) => { const v = new THREE.Vector3(x, 0.4, y).project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; };
  view.dispose = () => { renderer.dispose(); renderer.domElement.remove(); };
  const markers = [];
  view.marker = (x, y) => { const m = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, side: THREE.DoubleSide, depthTest: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.12, y); m.renderOrder = 6; m.userData.age = 0; scene.add(m); markers.push(m); };
  const baseFrame = view.frame;
  view.frame = (dt, t) => { for (let i = markers.length - 1; i >= 0; i--) { const m = markers[i]; m.userData.age += dt; m.scale.setScalar(0.6 + m.userData.age * 2); m.material.opacity = Math.max(0, 1 - m.userData.age * 2.2); if (m.userData.age > 0.45) { scene.remove(m); markers.splice(i, 1); } } baseFrame(dt, t); };
  view.resize();
  return view;
}
