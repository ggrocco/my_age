import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings.js';
import { RES_KIND } from '../sim/util.js';

export const OWNER_COLOR = [0x3b82f6, 0xef4444];
const geo = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), cone: new THREE.ConeGeometry(0.5, 1, 4), cone8: new THREE.ConeGeometry(0.5, 1, 8), sph: new THREE.SphereGeometry(0.5, 12, 8), rock: new THREE.DodecahedronGeometry(0.5), ring: new THREE.RingGeometry(0.55, 0.7, 24), plane: new THREE.PlaneGeometry(1, 1) };
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
    camera.left = -view.zoom * a; camera.right = view.zoom * a; camera.top = view.zoom; camera.bottom = -view.zoom; camera.updateProjectionMatrix();
    camera.position.copy(view.focus).addScaledVector(DIR, 120); camera.lookAt(view.focus);
  }
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
  function makeMesh(e) {
    const g = new THREE.Group(), col = e.kind === 'unit' || e.kind === 'building' ? OWNER_COLOR[e.owner] : 0xffffff; g.userData = { id: e.id, kind: e.kind, owner: e.owner };
    if (e.kind === 'unit') {
      const s = e.cls === 'siege' ? 1.4 : e.cls === 'cav' ? 1.25 : e.type === 'king' ? 1.25 : 1;
      if (e.cls === 'siege') { g.add(part('box', 0x6b4a2b, 1.0, 0.35, 0.7, 0, 0.2)); g.add(part('box', 0x8a6238, 0.15, 0.9, 0.15, 0.2, 0.3, 0, -0.5)); g.add(part('cyl', 0x333333, 0.3, 0.12, 0.3, 0.35, 0.05, 0.4, Math.PI / 2)); g.add(part('cyl', 0x333333, 0.3, 0.12, 0.3, -0.35, 0.05, 0.4, Math.PI / 2)); g.add(part('sph', col, 0.3, 0.3, 0.3, 0, 0.55)); }
      else if (e.cls === 'cav') { g.add(part('box', 0x7a5230, 0.4, 0.4, 0.9, 0, 0.3)); g.add(part('box', 0x7a5230, 0.2, 0.4, 0.2, 0, 0.55, 0.4)); g.add(part('cyl', col, 0.28, 0.5, 0.28, 0, 0.55)); g.add(part('sph', 0xe8c9a0, 0.26, 0.26, 0.26, 0, 1.0)); }
      else {
        g.add(part('cyl', col, 0.34 * s, 0.55 * s, 0.34 * s)); g.add(part('sph', 0xe8c9a0, 0.26 * s, 0.26 * s, 0.26 * s, 0, 0.55 * s));
        if (e.type === 'king') { g.add(part('cyl', 0xfacc15, 0.3, 0.14, 0.3, 0, 0.98)); g.add(part('cyl', col, 0.42, 0.3, 0.42, 0, 0.3)); }
        if (e.cls === 'inf') { g.add(part('box', 0x9ca3af, 0.06, 0.7, 0.06, 0.28, 0.1)); g.add(part('cyl', 0x92400e, 0.32, 0.05, 0.32, -0.28, 0.25, 0, Math.PI / 2)); }
        if (e.cls === 'archer') g.add(part('box', 0x78350f, 0.05, 0.6, 0.05, 0.3, 0.1));
        if (e.type === 'villager') g.add(part('box', 0xd6b370, 0.34, 0.08, 0.34, 0, 0.62));
      }
    } else if (e.kind === 'building') {
      const sz = e.size - 0.25, t = e.type;
      if (t === 'farm') { g.add(part('box', 0x8b6b3a, sz, 0.06, sz)); for (let i = -2; i <= 2; i++) g.add(part('box', 0x65a30d, sz * 0.9, 0.09, 0.12, 0, 0, i * 0.3)); }
      else if (t === 'house') { g.add(part('box', 0xd6c7a1, sz, 0.7, sz)); g.add(part('cone', col, sz * 1.5, 0.6, sz * 1.5, 0, 0.7)); g.children[1].rotation.y = Math.PI / 4; }
      else if (t === 'town_center') { g.add(part('box', 0xc9b98f, sz, 1.2, sz)); g.add(part('cone', col, sz * 1.5, 0.9, sz * 1.5, 0, 1.2)); g.children[1].rotation.y = Math.PI / 4; g.add(part('cyl', 0xb8a87d, 0.7, 2.0, 0.7, 0, 0, 0)); g.add(part('cone8', col, 0.9, 0.6, 0.9, 0, 2.0)); }
      else if (t === 'granary') { g.add(part('cyl', 0xd9b86c, sz, 0.9, sz)); g.add(part('cone8', col, sz * 1.15, 0.5, sz * 1.15, 0, 0.9)); }
      else if (t === 'storage_pit') { g.add(part('box', 0x8b6b3a, sz, 0.35, sz)); g.add(part('box', 0x5b4326, sz * 0.7, 0.4, sz * 0.7)); g.add(part('box', col, 0.15, 0.7, 0.15, sz / 2 - 0.1, 0, sz / 2 - 0.1)); }
      else if (t === 'wonder') { for (let i = 0; i < 4; i++) g.add(part('box', i % 2 ? 0xe5d6a8 : 0xd6c58f, sz * (1 - i * 0.2), 0.9, sz * (1 - i * 0.2), 0, i * 0.9)); g.add(part('cone', 0xfacc15, 1.0, 1.4, 1.0, 0, 3.6)); g.add(part('box', col, 0.2, 1.2, 0.2, 0, 3.6)); }
      else if (t === 'government_center') { g.add(part('box', 0xd2c4a0, sz, 1.1, sz)); g.add(part('box', col, sz * 1.05, 0.2, sz * 1.05, 0, 1.1)); for (const dx of [-1, 1]) g.add(part('cyl', 0xf2ead2, 0.25, 1.1, 0.25, dx * sz / 2.2, 0, sz / 2)); g.add(part('cone', col, sz * 0.9, 0.7, sz * 0.9, 0, 1.3)); g.children.at(-1).rotation.y = Math.PI / 4; }
      else { g.add(part('box', 0xb59a6b, sz, t === 'market' ? 0.7 : 1.0, sz)); g.add(part('box', col, sz * 1.08, 0.18, sz * 1.08, 0, t === 'market' ? 0.7 : 1.0)); g.add(part('box', col, 0.12, 0.9, 0.12, sz / 2 - 0.1, 1.1, sz / 2 - 0.1)); }
      g.userData.rest = g.children.slice();
    } else if (e.kind === 'resource') {
      if (e.type === 'tree') { g.add(part('cyl', 0x6b4423, 0.16, 0.5, 0.16)); g.add(part('cone8', 0x2f6b2f, 0.7, 1.1, 0.7, 0, 0.4)); g.add(part('cone8', 0x3a7d3a, 0.5, 0.8, 0.5, 0, 0.95)); }
      else if (e.type === 'berry') { g.add(part('sph', 0x3f7f3a, 0.6, 0.4, 0.6, 0, 0)); for (let i = 0; i < 5; i++) g.add(part('sph', 0xc026d3, 0.12, 0.12, 0.12, Math.cos(i * 1.3) * 0.22, 0.28, Math.sin(i * 1.3) * 0.22)); }
      else if (e.type === 'gold') { g.add(part('rock', 0xfacc15, 0.8, 0.6, 0.7, 0, 0)); g.add(part('rock', 0xeab308, 0.4, 0.4, 0.4, 0.25, 0, 0.2)); }
      else { g.add(part('rock', 0x9ca3af, 0.85, 0.6, 0.75, 0, 0)); g.add(part('rock', 0x6b7280, 0.4, 0.4, 0.4, -0.25, 0, 0.2)); }
    } else if (e.kind === 'relic') { g.add(part('box', 0xfde047, 0.3, 0.4, 0.3, 0, 0.25)); g.add(part('sph', 0xfff7ae, 0.25, 0.25, 0.25, 0, 0.65)); }
    if (e.kind === 'unit' || e.kind === 'building') {
      const ring = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, depthTest: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
      const r = e.kind === 'building' ? e.size * 0.75 : 1; ring.scale.set(r * 1.4, r * 1.4, 1); ring.visible = false; ring.renderOrder = 3; g.add(ring); g.userData.ring = ring;
      const bg = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false })), fg = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false }));
      bg.renderOrder = fg.renderOrder = 4; bg.scale.set(1, 0.14, 1); const bar = new THREE.Group(); bar.add(bg, fg); bar.visible = false; bar.position.y = e.kind === 'building' ? (e.gatherType ? 0.8 : e.type === 'house' ? 1.8 : 2.6) : 1.5; g.add(bar); g.userData.bar = { bar, fg };
    }
    g.traverse(o => { if (o.isMesh && o !== g.userData.ring) o.userData.gid = e.id; });
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
  const worldPos = e => e.kind === 'building' ? [e.x + e.size / 2, 0, e.y + e.size / 2] : [e.x, e.kind === 'relic' ? 0.2 : 0, e.y];
  view.frame = (dt, t) => {
    placeCamera();
    const k = Math.min(1, dt * 16);
    for (const g of view.groups.values()) {
      const e = g.userData.entity; if (!e) continue;
      const [x, y, z] = worldPos(e);
      if (e.kind === 'unit') {
        g.position.x += (x - g.position.x) * k; g.position.z += (z - g.position.z) * k;
        const moving = Math.hypot(x - g.position.x, z - g.position.z) > 0.02;
        g.position.y = moving ? Math.abs(Math.sin(t * 12 + e.id)) * 0.08 : 0;
        if (moving) g.rotation.y = Math.atan2(x - g.position.x, z - g.position.z);
        else if (e.order.type === 'attack' && e.cd > e.cooldown - 6) g.position.y = 0.12;
        else if (e.order.type === 'gather' && e.order.phase === 'work') g.rotation.z = Math.sin(t * 14 + e.id) * 0.12;
        else g.rotation.z = 0;
        if (e.relic !== null) g.position.y += 0.4;
      } else g.position.set(x, y, z);
      if (e.kind === 'building') { const p = e.constructed ? 1 : 0.2 + 0.8 * e.progress; g.scale.y = p; if (e.gatherType) g.scale.y = 1; }
      if (e.kind === 'resource' && e.type === 'tree') { const s = 0.5 + 0.5 * Math.min(1, e.amount / 100); g.scale.setScalar(s * 1.0 + 0.0); g.scale.y = s; }
      else if (e.kind === 'resource') g.scale.setScalar(0.6 + 0.4 * Math.min(1, e.amount / (e.type === 'berry' ? 200 : 600)));
      const ud = g.userData;
      if (ud.ring) ud.ring.visible = view.selection.has(e.id);
      if (ud.bar) { const show = view.selection.has(e.id) || e.hp < e.maxHp; ud.bar.bar.visible = show; if (show) { const f = Math.max(0.001, e.hp / e.maxHp); ud.bar.bar.quaternion.copy(camera.quaternion); ud.bar.fg.scale.set(f, 0.14, 1); ud.bar.fg.position.x = (f - 1) / 2; ud.bar.fg.position.z = 0.001; ud.bar.fg.material.color.setHex(f > 0.5 ? 0x22c55e : f > 0.25 ? 0xeab308 : 0xef4444); } }
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
