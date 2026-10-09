// Procedural models with merged vertex colors (cached per type, team and architectural style)
// so a whole building or tree costs 1-6 draw calls; only limbs / arms / flags are separate animated meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createModelMaterial, surfaceKind } from './materials.js';

export const TEAM = [0x356bb0, 0xb84532], TEAM_DARK = [0x234779, 0x7c3027];
const C = { skin: 0xe8b98a, hair: 0x4a3222, wood: 0x7a5230, woodD: 0x4e3320, plaster: 0xe6d8b4, stone: 0x9a9a92, stoneD: 0x6f6f68, thatch: 0xc9a24a, thatchD: 0xa8822f, dark: 0x2a2018, gold: 0xf2c230, iron: 0xb9c0c8, bronze: 0xb5803a, leather: 0x8a5a2b, cloth: 0xc9b58a, hay: 0xe0c060, marble: 0xefe9dc, green: 0x3f7f3a, red: 0xc0392b, glass: 0x6fa8c8 };
const VC = createModelMaterial();
const unit = { box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 10, 8), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), rock: new THREE.DodecahedronGeometry(1, 0), foliage: new THREE.IcosahedronGeometry(1, 1), tor: new THREE.TorusGeometry(1, 0.08, 6, 14, Math.PI) };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const prismCache = new Map();
function prismGeo(w, h, d) { const k = [w, h, d].join(); if (!prismCache.has(k)) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); prismCache.set(k, g); } return prismCache.get(k); }

class B {
  constructor() { this.geos = []; }
  add(geo, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    _q.setFromEuler(_e.set(rx, ry, rz)); _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    let g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(_m); g.deleteAttribute('uv');
    const n = g.attributes.position.count, col = new Float32Array(n * 3); _c.set(color);
    for (let i = 0; i < n; i++) {
      // Subtle per-face patina; shared by each triangle's vertices to avoid seams.
      const shade = 0.94 + ((Math.imul((i / 3 | 0) + 1, 16807) >>> 0) % 101) / 1250;
      col[i * 3] = _c.r * shade; col[i * 3 + 1] = _c.g * shade; col[i * 3 + 2] = _c.b * shade;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('surface', new THREE.BufferAttribute(new Float32Array(n).fill(surfaceKind(color)), 1)); this.geos.push(g); return this;
  }
  box(w, h, d, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { return this.add(unit.box, c, x, y + h / 2, z, w, h, d, rx, ry, rz); }
  cyl(r, h, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { return this.add(unit.cyl, c, x, y + h / 2, z, r, h, r, rx, ry, rz); }
  cylT(rt, rb, h, c, x = 0, y = 0, z = 0, seg = 10, rx = 0, ry = 0, rz = 0) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y + h / 2, z, 1, 1, 1, rx, ry, rz); }
  cone(r, h, c, x = 0, y = 0, z = 0, seg = 8, ry = 0) { return this.add(new THREE.ConeGeometry(r, h, seg), c, x, y + h / 2, z, 1, 1, 1, 0, ry, 0); }
  sph(r, c, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { return this.add(unit.sph, c, x, y, z, r * sx, r * sy, r * sz); }
  rock(r, c, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0) { return this.add(unit.rock, c, x, y + r * sy * 0.6, z, r * sx, r * sy, r * sz, 0, ry, 0); }
  foliage(r, c, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) { return this.add(unit.foliage, c, x, y + r * sy * 0.6, z, r * sx, r * sy, r * sz, 0, ry, 0); }
  roof(w, h, d, c, x = 0, y = 0, z = 0, ry = 0) {
    this.add(prismGeo(w, h, d), c, x, y, z, 1, 1, 1, 0, ry, 0);
    if (![C.thatch, 0xa96342, 0x945139].includes(c)) return this;
    const surface = new B(), slope = Math.atan2(h, w / 2), length = Math.hypot(w / 2, h);
    const tiled = c === 0xa96342 || c === 0x945139;
    for (const side of [-1, 1]) {
      if (tiled) {
        for (let row = 0; row < 6; row++) {
          const f = (row + 0.5) / 6;
          surface.box(length / 6 + 0.025, 0.035, d + 0.04, row % 2 ? c : 0xb7714e,
            side * w / 2 * f, h * (1 - f) + 0.018, 0, 0, 0, -side * slope);
          for (let zz = -d / 2 + 0.12; zz < d / 2; zz += 0.24) {
            surface.box(length / 6, 0.052, 0.035, 0x8a4c34, side * w / 2 * f, h * (1 - f) + 0.025, zz, 0, 0, -side * slope);
          }
        }
      } else {
        for (let zz = -d / 2; zz <= d / 2; zz += 0.095) {
          surface.box(length, 0.025, 0.025, Math.round((zz + d) * 100) % 3 ? C.thatchD : C.hay,
            side * w / 4, h / 2 + 0.018, zz, 0, 0, -side * slope);
        }
        for (let row = 1; row <= 3; row++) {
          surface.box(0.035, 0.035, d + 0.08, C.wood, side * w / 2 * row / 4, h * (1 - row / 4) + 0.04, 0);
        }
      }
    }
    const detail = surface.geometry();
    this.add(detail, 0xffffff, x, y, z, 1, 1, 1, 0, ry);
    // Preserve the detail's baked colors after applying its transform.
    this.geos[this.geos.length - 1].setAttribute('color', detail.attributes.color.clone());
    this.geos[this.geos.length - 1].setAttribute('surface', detail.attributes.surface.clone());
    detail.dispose();
    return this;
  }
  geometry() { const m = mergeGeometries(this.geos, false); for (const g of this.geos) g.dispose(); m.userData.shared = true; return m; }

}
const cache = new Map();
const cached = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
const mesh = g => { const m = new THREE.Mesh(g, VC); m.castShadow = m.receiveShadow = true; return m; };
const pivot = (x, y, z, g) => { const p = new THREE.Group(); p.position.set(x, y, z); if (g) p.add(mesh(g)); return p; };
const rng = seed => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------- humanoids ----------
function limbs(o, team) {
  const t = TEAM[team], td = TEAM_DARK[team], H = o.scale || 1;
  const body = new B(), legL = new B(), legR = new B(), armL = new B(), armR = new B();
  const tunic = o.tunic ?? t, pants = o.pants ?? C.leather;
  body.add(unit.cyl, tunic, 0, 0.57, 0, 0.19, 0.34, 0.115)
    .cylT(0.15, 0.21, 0.2, tunic, 0, 0.32, 0, 10)
    .box(0.34, 0.04, 0.24, o.belt ?? C.woodD, 0, 0.47, 0)
    .box(0.045, 0.045, 0.025, C.bronze, 0, 0.47, 0.135);
  if (o.armor) body.box(0.37, 0.32, 0.23, o.armor, 0, 0.4, 0).box(0.4, 0.06, 0.25, C.stoneD, 0, 0.7, 0);
  if (o.sash) body.box(0.06, 0.4, 0.22, t, 0.1, 0.36, 0, 0, 0, -0.5);
  body.sph(0.13, C.skin, 0, 0.87, 0).sph(0.05, C.skin, 0, 0.85, 0.12, 0.7, 0.7, 0.7);
  if (!o.helmet) body.sph(0.135, o.hair ?? C.hair, 0, 0.9, -0.02, 1, 0.75, 1);
  if (o.helmet === 'leather') body.sph(0.145, C.leather, 0, 0.9, 0, 1, 0.8, 1);
  if (o.helmet === 'bronze') { body.sph(0.155, C.bronze, 0, 0.9, 0, 1, 0.9, 1).box(0.05, 0.14, 0.26, td, 0, 0.98, 0).box(0.03, 0.12, 0.03, C.bronze, 0, 0.84, 0.15); }
  if (o.helmet === 'iron') { body.sph(0.155, C.iron, 0, 0.9, 0, 1, 0.9, 1).box(0.03, 0.14, 0.03, C.iron, 0, 0.84, 0.15).cone(0.05, 0.2, t, 0, 1.0, -0.02, 6); }
  if (o.hat === 'straw') body.cylT(0.05, 0.1, 0.07, C.hay, 0, 0.99, 0, 8).cyl(0.22, 0.02, C.hay, 0, 0.98, 0).box(0.02, 0.03, 0.3, t, 0, 1.0, 0, 0, 0, 0);
  if (o.quiver) body.cyl(0.05, 0.3, C.leather, -0.08, 0.42, -0.14, 0.3).box(0.02, 0.1, 0.02, C.hay, -0.08, 0.72, -0.18);
  if (o.cape) body.box(0.3, 0.55, 0.03, o.cape, 0, 0.2, -0.12, 0.08);
  for (const g of [legL, legR]) g.cylT(0.065, 0.045, 0.32, pants, 0, -0.32, 0, 8).box(0.11, 0.08, 0.17, C.dark, 0, -0.38, 0.025);
  const sleeve = o.sleeve ?? tunic;
  for (const g of [armL, armR]) g.cylT(0.065, 0.047, 0.17, sleeve, 0, -0.17, 0, 8).cylT(0.047, 0.035, 0.14, C.skin, 0, -0.3, 0, 8).sph(0.045, C.skin, 0, -0.33, 0);
  // right-hand weapon
  const w = o.weapon;
  if (w === 'club') armR.cylT(0.055, 0.03, 0.42, C.wood, 0, -0.33, 0.1, 8, 1.3).sph(0.075, C.woodD, 0, -0.1, 0.42);
  if (w === 'axe') { armR.cyl(0.02, 0.5, C.wood, 0, -0.42, 0.14, 1.3); armR.box(0.03, 0.18, 0.14, C.iron, 0, -0.16, 0.42, 1.3); }
  if (w === 'spear') { armR.cyl(0.018, 1.25, C.wood, 0, -0.6, 0.06, 0.15); armR.cone(0.045, 0.16, C.iron, 0, 0.56, 0.14, 6, 0); }
  if (w === 'sword') { armR.box(0.04, 0.05, 0.4, C.iron, 0, -0.31, 0.3, 0.2).box(0.14, 0.03, 0.03, C.gold, 0, -0.32, 0.1); }
  if (w === 'sling') { armR.cyl(0.008, 0.36, C.leather, 0, -0.35, 0.04, 0.2).sph(0.04, C.stoneD, 0, -0.72, 0.06); }
  // left-hand equipment
  const sh = o.shield;
  if (sh === 'round') armL.add(unit.cyl, td, -0.09, -0.22, 0.13, 0.19, 0.03, 0.19, Math.PI / 2, 0, 0).add(unit.cyl, C.gold, -0.09, -0.22, 0.155, 0.06, 0.03, 0.06, Math.PI / 2, 0, 0).add(unit.cyl, t, -0.09, -0.22, 0.145, 0.15, 0.02, 0.15, Math.PI / 2, 0, 0);
  if (sh === 'big') armL.add(unit.cyl, C.bronze, -0.09, -0.2, 0.13, 0.24, 0.035, 0.24, Math.PI / 2, 0, 0).add(unit.cyl, t, -0.09, -0.2, 0.15, 0.17, 0.02, 0.17, Math.PI / 2, 0, 0).add(unit.cyl, C.gold, -0.09, -0.2, 0.165, 0.05, 0.02, 0.05, Math.PI / 2, 0, 0);
  if (sh === 'rect') armL.box(0.05, 0.42, 0.3, t, -0.1, -0.44, 0.13).box(0.06, 0.1, 0.1, C.iron, -0.1, -0.3, 0.13);
  if (o.bow) armL.add(unit.tor, C.wood, 0, -0.32, 0.12, 0.36, 0.36, 0.36, 0, 0, -Math.PI / 2).box(0.008, 0.68, 0.008, C.hay, 0, -0.66, 0.12);
  return { body: body.geometry(), legL: legL.geometry(), legR: legR.geometry(), armL: armL.geometry(), armR: armR.geometry(), s: H };
}
const HUMAN = {
  villager: { scale: 0.92, tunic: C.cloth, pants: 0x6b5a3a, hat: 'straw', sash: true },
  clubman: { helmet: null, weapon: 'club' },
  axeman: { helmet: 'leather', weapon: 'axe', shield: 'round' },
  slinger: { tunic: C.leather, weapon: 'sling', sash: true },
  bowman: { helmet: null, tunic: 0x4a6b3a, bow: true, quiver: true, sash: true },
  spearman: { helmet: 'leather', weapon: 'spear', shield: 'round' },
  hoplite: { scale: 1.05, helmet: 'bronze', weapon: 'spear', shield: 'big', armor: C.bronze, cape: null },
  swordsman: { scale: 1.08, helmet: 'iron', weapon: 'sword', shield: 'rect', armor: C.iron, cape: 'team' },
  king: { scale: 1.12, tunic: 0x7a2a8a, sleeve: 0x7a2a8a, pants: 0x4a1a5a, helmet: null, cape: 'team', weapon: null, sash: true },
};
function villagerTools() {
  const mk = f => { const b = new B(); f(b); return b.geometry(); };
  return {
    axe: mk(b => { b.cyl(0.02, 0.5, C.wood, 0, -0.42, 0.14, 1.3).box(0.03, 0.18, 0.14, C.iron, 0, -0.16, 0.42, 1.3); }),
    pick: mk(b => { b.cyl(0.02, 0.5, C.wood, 0, -0.42, 0.14, 1.3).box(0.32, 0.03, 0.03, C.iron, 0, -0.16, 0.42, 1.3); }),
    hammer: mk(b => { b.cyl(0.02, 0.36, C.wood, 0, -0.38, 0.1, 1.2).box(0.1, 0.08, 0.08, C.stoneD, 0, -0.15, 0.32, 1.2); }),
    basket: mk(b => { b.cylT(0.13, 0.09, 0.14, C.leather, 0, -0.5, 0.16, 8).sph(0.09, 0xc026d3, 0, -0.34, 0.16, 1, 0.6, 1); }),
  };
}
function horse(team) {
  const t = TEAM[team], body = new B(), leg = new B();
  const coat = 0x8a5a33, dark = 0x4a2f1a;
  body.sph(0.4, coat, 0, 0.61, 0, 0.56, 0.6, 1.28).box(0.36, 0.05, 0.4, t, 0, 0.78, -0.02).box(0.26, 0.34, 0.16, coat, 0, 0.66, 0.42, -0.6);
  body.box(0.22, 0.24, 0.32, coat, 0, 0.9, 0.62, 0.5).box(0.1, 0.06, 0.1, dark, 0, 0.95, 0.78).box(0.05, 0.16, 0.08, dark, 0, 0.98, 0.5, 0.2).box(0.03, 0.05, 0.03, dark, -0.06, 1.12, 0.6).box(0.03, 0.05, 0.03, dark, 0.06, 1.12, 0.6);
  body.box(0.08, 0.4, 0.08, dark, 0, 0.36, -0.5, 0.5).sph(0.05, dark, 0, 0.22, -0.62);
  leg.box(0.1, 0.44, 0.1, coat, 0, -0.44, 0).box(0.11, 0.08, 0.12, dark, 0, -0.44, 0);
  return { body: body.geometry(), leg: leg.geometry() };
}
function catapult(team) {
  const t = TEAM[team], b = new B(), arm = new B();
  b.box(0.16, 0.14, 1.1, C.wood, -0.3, 0.2, 0).box(0.16, 0.14, 1.1, C.wood, 0.3, 0.2, 0).box(0.7, 0.1, 0.12, C.woodD, 0, 0.3, 0.4).box(0.7, 0.1, 0.12, C.woodD, 0, 0.3, -0.4);
  b.box(0.1, 0.5, 0.1, C.woodD, -0.3, 0.3, -0.05).box(0.1, 0.5, 0.1, C.woodD, 0.3, 0.3, -0.05).box(0.7, 0.08, 0.08, C.woodD, 0, 0.75, -0.05).box(0.5, 0.05, 0.4, t, 0, 0.34, 0.1);
  for (const [x, z] of [[-0.42, 0.4], [0.42, 0.4], [-0.42, -0.4], [0.42, -0.4]]) b.add(unit.cyl, C.woodD, x, 0.2, z, 0.22, 0.06, 0.22, 0, 0, Math.PI / 2).add(unit.cyl, C.iron, x, 0.2, z, 0.06, 0.09, 0.06, 0, 0, Math.PI / 2);
  arm.box(0.08, 0.08, 1.0, C.wood, 0, 0, -0.1).box(0.2, 0.12, 0.2, C.woodD, 0, 0.0, 0.42).sph(0.09, C.stoneD, 0, 0.14, 0.42);
  return { base: b.geometry(), arm: arm.geometry() };
}

function unitModel(e) {
  const root = new THREE.Group(), team = e.owner;
  if (['drone', 'mech', 'railgun'].includes(e.type)) return futureModel(e);
  if (e.cls === 'siege') {
    const p = cached('cat' + team, () => catapult(team)), armP = pivot(0, 0.5, -0.05, p.arm); armP.rotation.x = -0.5;
    root.add(mesh(p.base), armP); root.scale.setScalar(1.15); return { root, anim: { type: 'cat', arm: armP }, shadow: 0.6 };
  }
  const spec = { ...(HUMAN[e.type] || {}) }; if (spec.cape === 'team') spec.cape = TEAM_DARK[team];
  const h = cached(`h:${e.type}:${team}`, () => limbs(spec, team));
  const anim = { type: 'human' };
  if (e.cls === 'cav') {
    const hs = cached('horse' + team, () => horse(team)), hr = new THREE.Group(); hr.add(mesh(hs.body));
    anim.type = 'horse'; anim.legs = [[-0.11, 0.42, 0.3], [0.11, 0.42, 0.3], [-0.11, 0.42, -0.3], [0.11, 0.42, -0.3]].map(([x, y, z]) => { const p = pivot(x, y, z, hs.leg); hr.add(p); return p; });
    const rider = new THREE.Group(); rider.position.y = 0.72; rider.scale.setScalar(0.9);
    const spec2 = { tunic: TEAM[team], bow: e.type === 'horse_archer', weapon: e.type === 'scout' ? 'spear' : null, helmet: 'leather' };
    const r = cached(`rider:${e.type}:${team}`, () => limbs(spec2, team)); rider.add(mesh(r.body)); anim.armR = pivot(0.22, 0.7, 0, r.armR); anim.armL = pivot(-0.22, 0.7, 0, r.armL); rider.add(anim.armR, anim.armL);
    root.add(hr, rider); root.scale.setScalar(1.1); return { root, anim, shadow: 0.55 };
  }
  const inner = new THREE.Group(); inner.scale.setScalar(h.s); root.add(inner);
  inner.add(mesh(h.body)); anim.legL = pivot(-0.09, 0.38, 0, h.legL); anim.legR = pivot(0.09, 0.38, 0, h.legR); anim.armL = pivot(-0.22, 0.7, 0, h.armL); anim.armR = pivot(0.22, 0.7, 0, h.armR);
  inner.add(anim.legL, anim.legR, anim.armL, anim.armR);
  if (e.type === 'villager') {
    const tl = cached('vtools', villagerTools); anim.tools = {}; for (const [k, g] of Object.entries(tl)) { const m = mesh(g); m.visible = false; anim.armR.add(m); anim.tools[k] = m; }
    const sack = new B().box(0.22, 0.26, 0.14, C.cloth, 0, 0.36, -0.2).sph(0.08, C.cloth, 0, 0.66, -0.2); anim.sack = mesh(cached('sack', () => sack.geometry())); anim.sack.visible = false; inner.add(anim.sack);
  }
  if (e.type === 'king') {
    const crown = cached('crown', () => {
      const b = new B().cyl(0.145, 0.07, C.gold, 0, 0.96, 0);
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; b.cone(0.035, 0.1, C.gold, Math.cos(a) * 0.12, 1.03, Math.sin(a) * 0.12, 4); }
      return b.geometry();
    });
    inner.add(mesh(crown));
  }
  return { root, anim, shadow: 0.32 };
}

// The game's fictional fifth age has its own silhouettes, not ancient-unit fallbacks.
function futureModel(e) {
  const root = new THREE.Group(), t = TEAM[e.owner], shell = 0x697678, dark = 0x303a3c;
  const parts = cached(`future:${e.type}:${e.owner}`, () => {
    const b = new B(), moving = new B();
    if (e.type === 'drone') {
      b.sph(0.3, shell, 0, 0, 0, 1, 0.48, 1.2).box(0.22, 0.06, 0.3, t, 0, 0.12, 0)
        .sph(0.075, 0x8ddbe7, 0, -0.025, 0.32);
      for (const x of [-0.4, 0.4]) for (const z of [-0.35, 0.35]) {
        b.box(0.5, 0.045, 0.065, dark, x * 0.55, 0, z).cyl(0.1, 0.12, shell, x, 0, z);
      }
      moving.box(0.48, 0.025, 0.045, dark).box(0.045, 0.025, 0.48, dark);
    } else if (e.type === 'mech') {
      b.box(0.55, 0.5, 0.38, shell, 0, 0.55, 0).box(0.4, 0.22, 0.1, t, 0, 0.72, 0.23)
        .box(0.3, 0.2, 0.25, dark, 0, 1.08, 0).box(0.23, 0.055, 0.04, 0x8ddbe7, 0, 1.17, 0.14);
      for (const x of [-0.38, 0.38]) b.sph(0.15, t, x, 0.98, 0).box(0.14, 0.38, 0.18, shell, x, 0.53, 0)
        .box(0.18, 0.16, 0.22, dark, x, 0.4, 0.03);
      moving.cyl(0.1, 0.36, dark, 0, -0.36, 0).box(0.18, 0.26, 0.18, shell, 0, -0.38, 0)
        .box(0.23, 0.1, 0.34, dark, 0, -0.55, 0.055);
    } else {
      b.box(0.68, 0.3, 1.05, shell, 0, 0.15, 0).box(0.52, 0.1, 0.75, t, 0, 0.45, 0);
      for (const x of [-0.4, 0.4]) {
        b.box(0.2, 0.3, 1.2, dark, x, 0.05, 0);
        for (let z = -0.5; z <= 0.5; z += 0.16) b.box(0.23, 0.04, 0.065, shell, x, 0.35, z);
      }
      b.cyl(0.24, 0.16, dark, 0, 0.55, 0);
      moving.box(0.32, 0.24, 0.5, shell, 0, 0, 0);
      for (const x of [-0.12, 0.12]) moving.box(0.06, 0.08, 1.05, shell, x, 0.09, 0.6)
        .box(0.025, 0.035, 0.9, 0x8ddbe7, x, 0.17, 0.62);
    }
    return { body: b.geometry(), moving: moving.geometry() };
  });
  const body = new THREE.Group(); body.add(mesh(parts.body)); root.add(body);
  const anim = { type: e.type, body };
  if (e.type === 'drone') {
    body.position.y = 1.1; anim.rotors = [];
    for (const x of [-0.4, 0.4]) for (const z of [-0.35, 0.35]) { const rotor = pivot(x, 0.13, z, parts.moving); body.add(rotor); anim.rotors.push(rotor); }
  } else if (e.type === 'mech') {
    anim.legs = [-0.18, 0.18].map(x => { const leg = pivot(x, 0.55, 0, parts.moving); root.add(leg); return leg; });
  } else { anim.barrel = pivot(0, 0.68, 0, parts.moving); body.add(anim.barrel); }
  return { root, anim, shadow: e.type === 'railgun' ? 0.7 : 0.45 };
}

// ---------- buildings ----------
function buildingGeos(type, team, size, age) {
  const t = TEAM[team], td = TEAM_DARK[team], s = size - 0.22, h = s / 2, b = new B(), extra = {};
  const masonry = ['bronze', 'iron', 'future'].includes(age), roofColor = masonry ? 0xa96342 : C.thatch;
  const wallColor = masonry ? 0xd7c7a4 : 0xbda77f;
  const door = (w, hh, z, x = 0) => { b.box(w, hh, 0.06, C.dark, x, 0.16, z).box(w + 0.1, 0.06, 0.08, C.woodD, x, 0.16 + hh, z); };
  const win = (x, y, z, ry = 0) => { b.box(0.22, 0.22, 0.05, C.glass, x, y, z, 0, ry).box(0.28, 0.04, 0.07, C.woodD, x, y + 0.22, z, 0, ry); };
  const found = (w, d) => {
    b.box(w + 0.12, 0.12, d + 0.12, 0x756852, 0, 0, 0);
    for (let x = -w / 2; x < w / 2; x += 0.32) for (const z of [-d / 2, d / 2]) {
      b.box(0.29, 0.09, 0.16, Math.round(x * 100) % 3 ? 0xa6977b : 0xb3a487, x + 0.12, 0.09, z);
    }
  };
  const posts = (w, d, hh, c = C.woodD) => { for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0.1, hh, 0.1, c, x * w / 2, 0.16, z * d / 2); };
  const banner = (x, z, y0, hh) => { b.cyl(0.025, hh, C.woodD, x, y0, z).box(0.02, 0.32, 0.28, t, x, y0 + hh - 0.34, z + 0.15); };
  if (type === 'house') {
    found(s, s); b.box(s - 0.1, 0.72, s - 0.1, wallColor, 0, 0.16, 0); posts(s - 0.1, s - 0.1, 0.72); b.box(s - 0.06, 0.06, s - 0.06, C.woodD, 0, 0.5, 0);
    b.roof(s + 0.35, 0.75, s + 0.3, roofColor, 0, 0.88, 0).box(0.09, 0.07, s + 0.36, td, 0, 1.6, 0).box(0.03, 0.03, s + 0.3, C.thatchD, 0, 0.9, 0);
    door(0.3, 0.5, (s - 0.1) / 2 + 0.02, -0.25); win(0.35, 0.5, (s - 0.1) / 2 + 0.02); b.box(0.18, 0.55, 0.18, C.stoneD, 0.5, 1.0, -0.4);
  } else if (type === 'town_center') {
    // An ancient assembly hall: a broad roof, shaded porch and working courtyard.
    // Team identity lives on cloth and trim rather than an entirely blue/red roof.
    found(s, s);
    b.box(s - 0.3, 1.05, s * 0.66, wallColor, 0, 0.16, -s * 0.12);
    posts(s - 0.3, s * 0.66, 1.05);
    b.box(s - 0.18, 0.1, s * 0.69, C.woodD, 0, 1.12, -s * 0.12);
    b.roof(s + 0.25, 0.95, s * 0.88, roofColor, 0, 1.23, -s * 0.12);
    b.box(0.1, 0.1, s * 0.92, C.woodD, 0, 2.16, -s * 0.12);
    const front = s * 0.22;
    door(0.5, 0.83, front); win(-0.68, 0.58, front); win(0.68, 0.58, front);
    for (const x of [-s * 0.4, -s * 0.18, s * 0.18, s * 0.4]) {
      b.cylT(0.06, 0.09, 1.0, masonry ? C.marble : C.woodD, x, 0.16, s * 0.45, 8);
      b.box(0.2, 0.08, 0.2, C.stone, x, 0.16, s * 0.45);
    }
    b.box(s * 0.92, 0.08, 0.11, C.woodD, 0, 1.16, s * 0.45);
    for (let i = 0; i < 9; i++) {
      b.box(s / 10, 0.035, s * 0.37, i % 3 === 0 ? t : C.cloth,
        -s * 0.4 + i * s / 10, 1.2, s * 0.35, 0.14);
    }
    for (let i = 0; i < 3; i++) b.box(0.9 + i * 0.14, 0.045, 0.17, C.stone, 0, 0.11 - i * 0.03, h + i * 0.13);
    // Terracotta storage jars and stacked timber beside the entrance.
    for (const [x, z] of [[-h + 0.18, h - 0.15], [-h + 0.48, h - 0.16]]) {
      b.sph(0.15, 0xa56843, x, 0.27, z, 1, 1.2, 1).cyl(0.065, 0.05, C.dark, x, 0.43, z);
    }
    for (let i = 0; i < 3; i++) b.cyl(0.055, 0.6, C.wood, h - 0.22, 0.16 + i * 0.08, 0.1, Math.PI / 2);
    if (masonry) {
      for (const x of [-h + 0.12, h - 0.12]) for (let row = 0; row < 5; row++) {
        b.box(0.2, 0.13, s * 0.69, row % 2 ? C.stone : 0xc9baa0, x, 0.18 + row * 0.19, -s * 0.12);
      }
    }
    b.cyl(0.025, 1.0, C.woodD, 0, 2.2, -0.4);
    extra.flag = new B().box(0.025, 0.3, 0.55, t, 0, 0, 0.27).geometry(); extra.flagAt = [0, 2.84, -0.4];
  } else if (type === 'granary') {
    b.cyl(s / 2 + 0.05, 0.16, C.stone).cyl(s / 2 - 0.08, 0.85, C.plaster, 0, 0.16, 0).cone(s / 2 + 0.2, 0.85, C.thatch, 0, 1.0, 0, 12).cyl(s / 2 - 0.06, 0.08, t, 0, 0.72, 0);
    door(0.3, 0.5, s / 2 - 0.08); for (const [x, z] of [[0.6, 0.7], [0.85, 0.5], [0.7, 0.4]]) b.cyl(0.12, 0.22, C.hay, x, 0.16, z).sph(0.09, C.hay, x, 0.4, z, 1, 0.6, 1);
    b.box(0.1, 0.2, 0.1, C.woodD, 0, 1.8, 0).cone(0.06, 0.12, t, 0, 1.85, 0, 6);
  } else if (type === 'storage_pit') {
    b.box(s, 0.1, s, C.woodD, 0, 0, 0).box(s - 0.3, 0.08, s - 0.3, C.dark, 0, 0.08, 0).box(0.1, 0.9, 0.1, C.wood, -0.7, 0.1, -0.7).box(0.1, 0.9, 0.1, C.wood, 0.7, 0.1, -0.7).box(0.1, 0.6, 0.1, C.wood, -0.7, 0.1, 0.7).box(0.1, 0.6, 0.1, C.wood, 0.7, 0.1, 0.7);
    b.box(s + 0.3, 0.07, s + 0.2, t, 0, 0.85, 0, 0.28).box(s + 0.3, 0.03, s + 0.2, C.thatch, 0, 0.9, 0, 0.28);
    for (const [x, z] of [[-0.3, 0.2], [0.1, 0.45], [0.4, -0.1]]) b.box(0.24, 0.22, 0.24, C.wood, x, 0.14, z).box(0.26, 0.03, 0.26, C.woodD, x, 0.36, z);
    b.cylT(0.13, 0.15, 0.3, C.woodD, -0.55, 0.14, 0.3).sph(0.16, C.stoneD, 0.5, 0.2, 0.4, 1, 0.5, 1).sph(0.14, C.gold, 0.15, 0.24, -0.35, 1, 0.5, 1);
  } else if (type === 'farm') {
    b.box(s, 0.05, s, 0x6b4a26, 0, 0, 0); for (let i = -2; i <= 2; i++) b.box(s * 0.9, 0.05, 0.11, 0x4a3018, 0, 0.05, i * 0.32);
    b.box(0.06, 0.6, 0.06, C.wood, s / 2 - 0.1, 0.05, -s / 2 + 0.1).box(0.34, 0.05, 0.05, C.wood, s / 2 - 0.1, 0.5, -s / 2 + 0.1).box(0.16, 0.2, 0.05, t, s / 2 - 0.1, 0.28, -s / 2 + 0.1);
    const cr = new B(); for (let i = -2; i <= 2; i++) for (let j = -3; j <= 3; j++) { cr.cone(0.06, 0.22, i % 2 ? 0x6fae2f : 0x8bc34a, j * 0.24, 0.09, i * 0.32, 5).sph(0.045, C.hay, j * 0.24, 0.32, i * 0.32); }
    extra.crops = cr.geometry();
  } else if (type === 'barracks') {
    found(s, s); b.box(s - 0.2, 0.95, s - 0.3, 0xcbb890, 0, 0.16, 0); posts(s - 0.2, s - 0.3, 0.95); b.box(s - 0.16, 0.08, s - 0.26, C.woodD, 0, 0.66, 0);
    b.roof(s - 0.05, 0.85, s + 0.25, roofColor, 0, 1.06, 0, Math.PI / 2).box(s + 0.28, 0.08, 0.09, td, 0, 1.9, 0);
    door(0.5, 0.7, (s - 0.3) / 2 + 0.02); for (const x of [-0.75, 0.75]) b.add(unit.cyl, C.bronze, x, 0.75, (s - 0.3) / 2 + 0.05, 0.2, 0.03, 0.2, Math.PI / 2, 0, 0).add(unit.cyl, t, x, 0.75, (s - 0.3) / 2 + 0.07, 0.13, 0.03, 0.13, Math.PI / 2, 0, 0);
    b.box(1.0, 0.06, 0.06, C.woodD, 0, 0.55, s / 2 + 0.28); for (let i = -2; i <= 2; i++) b.cyl(0.018, 0.75, C.wood, i * 0.2, 0.16, s / 2 + 0.28).cone(0.035, 0.1, C.iron, i * 0.2, 0.9, s / 2 + 0.28, 5);
    b.box(0.06, 0.06, 0.6, C.woodD, s / 2 - 0.1, 0.5, s / 2 + 0.28); banner(-s / 2 + 0.1, s / 2 + 0.2, 0.16, 1.4);
  } else if (type === 'archery_range') {
    found(s, s); posts(s - 0.3, s - 0.7, 1.05); b.box(s - 0.1, 0.09, s - 0.6, t, 0, 1.21, -0.25, 0.12).box(s - 0.1, 0.03, s - 0.6, C.thatch, 0, 1.3, -0.25, 0.12).box(s - 0.5, 0.7, 0.08, C.woodD, 0, 0.2, -s / 2 + 0.5);
    for (const x of [-0.8, 0, 0.8]) { b.box(0.05, 0.6, 0.05, C.wood, x, 0.16, s / 2 - 0.15); b.add(unit.cyl, C.hay, x, 0.66, s / 2 - 0.15, 0.3, 0.06, 0.3, Math.PI / 2).add(unit.cyl, 0xffffff, x, 0.66, s / 2 - 0.12, 0.22, 0.03, 0.22, Math.PI / 2).add(unit.cyl, C.red, x, 0.66, s / 2 - 0.1, 0.15, 0.03, 0.15, Math.PI / 2).add(unit.cyl, C.gold, x, 0.66, s / 2 - 0.08, 0.06, 0.03, 0.06, Math.PI / 2); }
    b.box(0.4, 0.3, 0.3, C.hay, -1.0, 0.16, 0.0).box(0.4, 0.3, 0.3, C.hay, -1.0, 0.46, 0.05); banner(s / 2 - 0.1, -s / 2 + 0.2, 0.16, 1.3);
  } else if (type === 'stable') {
    found(s, s); b.box(s - 0.2, 0.85, s - 0.4, 0xb5854f, 0, 0.16, -0.2); posts(s - 0.2, s - 0.4, 0.85);
    b.roof(s + 0.15, 1.0, s - 0.1, roofColor, 0, 1.0, -0.2, Math.PI / 2).box(s + 0.2, 0.08, 0.09, td, 0, 2.0, -0.2);
    b.box(0.6, 0.65, 0.06, C.dark, 0, 0.16, s / 2 - 0.4 + 0.02).box(0.7, 0.06, 0.08, C.woodD, 0, 0.8, s / 2 - 0.38);
    for (const x of [-1, 1]) { b.box(0.06, 0.5, 0.06, C.wood, x * 0.9, 0.16, s / 2 - 0.1).box(0.06, 0.06, 0.7, C.wood, x * 0.9, 0.5, s / 2 - 0.45); } b.box(1.9, 0.06, 0.06, C.wood, 0, 0.5, s / 2 - 0.1).box(1.9, 0.06, 0.06, C.wood, 0, 0.3, s / 2 - 0.1);
    b.box(0.45, 0.28, 0.3, C.hay, -1.0, 0.16, s / 2 - 0.4).box(0.3, 0.3, 0.3, C.hay, 1.0, 0.16, s / 2 - 0.5).box(0.3, 0.1, 0.3, C.wood, 0.95, 1.4, s / 2 - 0.65); banner(-s / 2 + 0.1, s / 2 - 0.1, 0.16, 1.4);
  } else if (type === 'market') {
    found(s, s); for (const [x, z, c1] of [[-0.7, -0.5, t], [0.7, -0.5, 0xffffff], [0, 0.6, t]]) {
      b.box(0.9, 0.35, 0.5, C.wood, x, 0.16, z).box(0.06, 0.95, 0.06, C.woodD, x - 0.42, 0.16, z - 0.25).box(0.06, 0.95, 0.06, C.woodD, x + 0.42, 0.16, z - 0.25).box(0.06, 0.75, 0.06, C.woodD, x - 0.42, 0.16, z + 0.25).box(0.06, 0.75, 0.06, C.woodD, x + 0.42, 0.16, z + 0.25);
      for (let i = 0; i < 4; i++) b.box(0.24, 0.04, 0.72, i % 2 ? 0xffffff : c1, x - 0.36 + i * 0.24, 0.95 - 0.02 * 0, z, 0.25);
      for (let i = 0; i < 4; i++) b.sph(0.08, [C.red, C.gold, C.green, 0xc026d3][i], x - 0.27 + i * 0.18, 0.55, z + 0.05, 1, 0.8, 1);
    } b.cylT(0.16, 0.18, 0.36, C.woodD, 1.0, 0.16, 0.9).cylT(0.16, 0.18, 0.36, C.woodD, 0.75, 0.16, 1.05).box(0.3, 0.26, 0.3, C.wood, -1.0, 0.16, 0.9);
  } else if (type === 'government_center') {
    b.box(s + 0.2, 0.14, s + 0.2, C.marble).box(s, 0.14, s, C.stone, 0, 0.14, 0);
    b.box(s - 0.5, 1.0, s - 0.9, C.marble, 0, 0.28, -0.35);
    for (let i = 0; i < 6; i++) b.cyl(0.11, 1.15, C.marble, -s / 2 + 0.3 + i * (s - 0.6) / 5, 0.28, s / 2 - 0.25).cyl(0.14, 0.07, C.stone, -s / 2 + 0.3 + i * (s - 0.6) / 5, 0.28, s / 2 - 0.25).cyl(0.14, 0.07, C.stone, -s / 2 + 0.3 + i * (s - 0.6) / 5, 1.36, s / 2 - 0.25);
    b.box(s - 0.2, 0.2, 0.55, C.marble, 0, 1.43, s / 2 - 0.25).roof(s - 0.1, 0.62, 0.6, C.marble, 0, 1.63, s / 2 - 0.25, 0).roof(s - 0.5, 0.42, 0.62, t, 0, 1.68, s / 2 - 0.25, 0);
    b.cone(0.5, 0.5, t, 0, 1.28, -0.35, 8).cone(0.14, 0.3, C.gold, 0, 1.75, -0.35, 6); banner(s / 2 - 0.05, s / 2 - 0.05, 0.28, 1.6);
  } else if (type === 'wonder') {
    for (let i = 0; i < 3; i++) b.box(s - i * 0.5, 0.22, s - i * 0.5, i % 2 ? C.marble : 0xd9cfb0, 0, i * 0.22, 0);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r = s * 0.36; b.cyl(0.13, 1.1, C.marble, Math.cos(a) * r, 0.66, Math.sin(a) * r).cyl(0.17, 0.08, C.stone, Math.cos(a) * r, 0.66, Math.sin(a) * r).cyl(0.17, 0.08, C.stone, Math.cos(a) * r, 1.76, Math.sin(a) * r); }
    b.cyl(s * 0.4, 0.14, C.marble, 0, 1.84, 0);
    for (let i = 0; i < 4; i++) b.box(s * 0.62 - i * 0.5, 0.42, s * 0.62 - i * 0.5, [C.marble, 0xd9cfb0, C.marble, 0xd9cfb0][i], 0, 1.96 + i * 0.42, 0);
    b.cone(0.55, 0.8, C.gold, 0, 3.64, 0, 4, Math.PI / 4).cone(0.09, 0.5, C.gold, 0, 4.4, 0, 6).sph(0.11, 0xfff3a0, 0, 4.95);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { b.cyl(0.05, 0.6, C.woodD, x * (s / 2 - 0.15), 0.66, z * (s / 2 - 0.15)).cylT(0.13, 0.06, 0.12, C.bronze, x * (s / 2 - 0.15), 1.26, z * (s / 2 - 0.15)).cone(0.1, 0.24, 0xff9a1f, x * (s / 2 - 0.15), 1.36, z * (s / 2 - 0.15), 6); }
    banner(0, s / 2 - 0.05, 0.66, 1.9);
  } else { b.box(s, 0.8, s, C.plaster); }
  if (['house', 'barracks', 'stable'].includes(type)) {
    const front = type === 'house' ? (s - 0.1) / 2 + 0.012 : type === 'stable' ? s / 2 - 0.39 : (s - 0.3) / 2 + 0.012;
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        b.box(0.2, 0.09, 0.07, masonry ? 0xa99a7f : C.wood,
          side * (s / 2 - 0.18), 0.19 + row * 0.18, front);
      }
    }
    b.box(s * 0.55, 0.045, 0.045, td, 0, 0.81, front + 0.04);
  }
  // scaffolding shown while under construction
  const sc = new B(), sh = { house: 1.7, town_center: 3.0, granary: 1.6, storage_pit: 1.1, farm: 0.8, wonder: 5.0 }[type] ?? (type === 'government_center' ? 2.4 : 1.9), w = s / 2 + 0.12;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sc.box(0.06, sh, 0.06, 0xa8823f, x * w, 0, z * w);
  for (let y = 0.5; y < sh; y += 0.6) for (const [x, z, ry] of [[0, -w, 0], [0, w, 0], [-w, 0, Math.PI / 2], [w, 0, Math.PI / 2]]) sc.box(w * 2, 0.05, 0.05, 0xa8823f, x, y, z, 0, ry);
  for (const [x, z, ry] of [[0, w, 0], [w, 0, Math.PI / 2]]) sc.box(w * 2.2, 0.04, 0.04, 0xa8823f, x, sh / 2, z, 0, ry, 0.6);
  extra.scaffold = sc.geometry();
  return { body: b.geometry(), extra };
}
function buildingModel(e, age = 'stone') {
  const style = ['bronze', 'iron', 'future'].includes(age) ? 'masonry' : 'timber';
  const root = new THREE.Group(), g = cached(`b:${e.type}:${e.owner}:${style}`, () => buildingGeos(e.type, e.owner, e.size, age));
  const body = new THREE.Group(); body.add(mesh(g.body)); root.add(body);
  const anim = { type: 'building', body };
  if (g.extra.scaffold) { anim.scaffold = mesh(g.extra.scaffold); root.add(anim.scaffold); }
  if (g.extra.crops) { anim.crops = mesh(g.extra.crops); root.add(anim.crops); }
  if (g.extra.flag) { anim.flag = pivot(...g.extra.flagAt, g.extra.flag); root.add(anim.flag); }
  return { root, anim, shadow: e.size * 0.62, boxShadow: true };
}

// ---------- nature ----------
function tree(variant) {
  const r = rng(variant + 11), b = new B(), pine = variant % 3 === 0, height = 1.5 + r() * 0.7;
  b.cylT(0.065, 0.15, height * 0.75, 0x685038, 0, 0, 0, 8);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 0.4;
    b.cylT(0.035, 0.09, 0.38, C.woodD, Math.sin(angle) * 0.09, 0.02, Math.cos(angle) * 0.09, 6, Math.sin(angle) * 0.7, 0, Math.cos(angle) * 0.7);
  }
  if (pine) {
    for (let tier = 0; tier < 5; tier++) {
      const radius = 0.65 - tier * 0.105, y = height * 0.25 + tier * 0.29;
      b.cone(radius, 0.65, [0x384f2c, 0x455e31, 0x536c36][tier % 3], 0, y, 0, 9, tier * 0.7);
      for (let j = 0; j < 5; j++) {
        const a = j * 1.256 + tier;
        b.foliage(radius * 0.43, 0x496138, Math.cos(a) * radius * 0.56, y + 0.03, Math.sin(a) * radius * 0.56, 1, 0.5, 1, a);
      }
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4, radius = 0.28 + r() * 0.2, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      const y = height * 0.52 + r() * 0.45;
      b.cylT(0.025, 0.075, 0.65, 0x685038, x * 0.5, y - 0.45, z * 0.5, 7, Math.sin(angle) * 0.6, 0, -Math.cos(angle) * 0.6);
      for (let j = 0; j < 3; j++) b.foliage(0.28 + r() * 0.15, [0x526c32, 0x637c3b, 0x465e2c, 0x768448][(i + j) % 4],
        x + (r() - 0.5) * 0.35, y + r() * 0.27, z + (r() - 0.5) * 0.35, 1, 0.8, 1, r() * 6);
    }
    b.foliage(0.42, 0x687d3c, 0, height * 0.86, 0, 1, 0.7, 1);
  }
  return b.geometry();
}
function rockPile(kind, variant) {
  const r = rng(variant + (kind === 'gold' ? 77 : 33)), b = new B(), base = kind === 'gold' ? 0x8a8478 : 0x9ca3af, dk = kind === 'gold' ? 0x6f6a60 : 0x6b7280;
  b.rock(0.42, base, 0, 0, 0, 1.1, 0.75, 0.95, r() * 3).rock(0.28, dk, 0.32, 0, 0.12, 1, 0.8, 1, r() * 3).rock(0.22, base, -0.3, 0, 0.18, 1, 0.9, 1, r() * 3);
  if (kind === 'gold') for (let i = 0; i < 5; i++) b.rock(0.11 + r() * 0.06, [C.gold, 0xffd84a, 0xe0a81a][i % 3], (r() - 0.5) * 0.6, 0.28 + r() * 0.15, (r() - 0.5) * 0.5, 1, 1, 1, r() * 3);
  else b.rock(0.2, 0xb8bec6, 0.05, 0.3, -0.05, 1, 0.8, 1, r() * 3);
  return b.geometry();
}
function berry(variant) {
  const r = rng(variant + 5), b = new B();
  for (let i = 0; i < 8; i++) b.rock(0.21, [0x4c6534, 0x647c3f, 0x3d562e][i % 3], (r() - 0.5) * 0.55, 0.1 + r() * 0.16, (r() - 0.5) * 0.55, 1, 0.85, 1, r() * 6);
  for (let i = 0; i < 12; i++) b.sph(0.035, i % 3 ? 0x8f2630 : 0xb94036, (r() - 0.5) * 0.6, 0.25 + r() * 0.2, (r() - 0.5) * 0.6);
  return b.geometry();
}
function resourceModel(e) {
  const v = e.id % 6, root = new THREE.Group(), rr = rng(e.id);
  const geo = cached(`r:${e.type}:${v}`, () => e.type === 'tree' ? tree(v) : e.type === 'berry' ? berry(v) : rockPile(e.type, v));
  const m = mesh(geo); m.rotation.y = rr() * 6.28; m.userData.baseScale = 0.9 + rr() * 0.25; root.add(m);
  if (e.type === 'tree') m.rotation.z = (rr() - 0.5) * 0.08;
  return { root, anim: { type: 'res', mesh: m }, shadow: e.type === 'tree' ? 0.5 : 0.4 };
}
function relicModel() {
  const root = new THREE.Group(), g = cached('relic', () => { const b = new B(); b.cylT(0.2, 0.26, 0.2, C.stone, 0, 0, 0, 8).cylT(0.05, 0.08, 0.2, C.gold, 0, 0.2, 0, 8).cylT(0.16, 0.06, 0.2, C.gold, 0, 0.4, 0, 10).add(unit.tor, C.gold, 0.16, 0.5, 0, 0.09, 0.09, 0.09, 0, 0, 0).sph(0.06, 0xd6336c, 0, 0.64, 0); return b.geometry(); });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.y = 0.5; glow.raycast = () => {};
  const body = mesh(g); root.add(body, glow); return { root, anim: { type: 'relic', glow, body }, shadow: 0.3 };
}

export function buildModel(e, age = 'stone') {
  if (e.kind === 'unit') return unitModel(e);
  if (e.kind === 'building') return buildingModel(e, age);
  if (e.kind === 'resource') return resourceModel(e);
  return relicModel();
}

// per-frame animation of a model's moving parts
export function animate(g, e, t, moving) {
  const a = g.userData.anim; if (!a) return;
  if (a.type === 'human' || a.type === 'horse') {
    const k = moving ? Math.sin(t * (a.type === 'horse' ? 14 : 11) + e.id) : 0;
    if (a.type === 'human') { a.legL.rotation.x = k * 0.7; a.legR.rotation.x = -k * 0.7; }
    else for (let i = 0; i < 4; i++) a.legs[i].rotation.x = (i % 3 === 0 ? k : -k) * 0.8;
    const o = e.order, attacking = o.type === 'attack' && e.cd > e.cooldown - 8, working = o.type === 'gather' && o.phase === 'work' || o.type === 'build' && !moving;
    if (a.armL) a.armL.rotation.x = moving ? -k * 0.6 : 0.05 * Math.sin(t * 2 + e.id);
    if (a.armR) {
      if (attacking) a.armR.rotation.x = -1.7 + (e.cd - (e.cooldown - 8)) * -0.2;
      else if (working) a.armR.rotation.x = -0.6 + Math.sin(t * 10 + e.id) * 0.9;
      else a.armR.rotation.x = moving ? k * 0.6 : 0;
    }
    if (a.tools) { // villager tool follows the job
      const kind = o.type === 'build' ? 'hammer' : o.type === 'gather' ? (o.kind === 'wood' ? 'axe' : o.kind === 'food' ? 'basket' : 'pick') : null;
      for (const [n, m] of Object.entries(a.tools)) m.visible = n === kind;
      if (a.sack) a.sack.visible = e.carry.amount > 0.5 && o.type === 'gather';
    }
  } else if (a.type === 'cat') {
    const p = Math.max(0, (e.cd - (e.cooldown - 14)) / 14); a.arm.rotation.x = e.order.type === 'attack' && p > 0 ? 1.1 - p * 1.6 : -0.5;
  } else if (a.type === 'drone') {
    a.body.position.y = 1.1 + Math.sin(t * 3 + e.id) * 0.055;
    a.body.rotation.x = moving ? 0.12 : 0;
    a.rotors.forEach((rotor, i) => { rotor.rotation.y = t * (i % 2 ? 35 : -35); });
  } else if (a.type === 'mech') {
    const stride = moving ? Math.sin(t * 8 + e.id) * 0.5 : 0;
    a.legs[0].rotation.x = stride; a.legs[1].rotation.x = -stride;
    a.body.position.y = moving ? Math.abs(Math.sin(t * 8 + e.id)) * 0.035 : 0;
  } else if (a.type === 'railgun') {
    a.barrel.position.z = e.order.type === 'attack' ? -Math.max(0, (e.cd - e.cooldown + 10) / 10) * 0.16 : 0;
  } else if (a.type === 'building') {
    const p = e.constructed ? 1 : 0.15 + 0.85 * e.progress; a.body.scale.y = p;
    if (a.scaffold) a.scaffold.visible = !e.constructed;
    if (a.crops) { a.crops.visible = e.constructed; a.crops.scale.y = 0.35 + 0.65 * Math.min(1, e.amount / 400); }
    if (a.flag) a.flag.rotation.y = Math.sin(t * 3) * 0.35;
  } else if (a.type === 'res') {
    const full = e.type === 'tree' ? 100 : e.type === 'berry' ? 200 : e.type === 'gold' ? 800 : 600, f = 0.55 + 0.45 * Math.min(1, e.amount / full), s = a.mesh.userData.baseScale;
    a.mesh.scale.set(s * f, s * (e.type === 'tree' ? f : 0.6 + 0.4 * f), s * f);
  } else if (a.type === 'relic') {
    a.body.rotation.y = t * 1.5; a.glow.scale.setScalar(1 + Math.sin(t * 3) * 0.15);
  }
}
