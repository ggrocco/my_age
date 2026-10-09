import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { UNITS } from '../src/data/units.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { AGES } from '../src/data/ages.js';
import { buildModel, animate } from '../src/render/models.js';

function checkGeometry(model, label) {
  let meshes = 0;
  model.root.updateMatrixWorld(true);
  model.root.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    const { position, normal, color } = object.geometry.attributes;
    assert.ok(position.count > 0, `${label}: empty geometry`);
    assert.equal(normal.count, position.count, `${label}: missing normals`);
    if (object.material.vertexColors) assert.equal(color.count, position.count, `${label}: missing colors`);
    if (object.geometry.attributes.surface) {
      const surface = object.geometry.attributes.surface;
      assert.equal(surface.count, position.count, `${label}: missing material categories`);
      assert.ok(surface.array.every(v => Number.isFinite(v) && v >= 0 && v <= 4), `${label}: invalid material category`);
    }
    for (const attribute of [position, normal, color].filter(Boolean)) {
      assert.ok(attribute.array.every(Number.isFinite), `${label}: non-finite vertex data`);
    }
    object.geometry.computeBoundingSphere();
    assert.ok(Number.isFinite(object.geometry.boundingSphere.radius), `${label}: invalid culling bounds`);
  });
  assert.ok(meshes > 0, `${label}: no meshes`);
  const bounds = new THREE.Box3().setFromObject(model.root);
  assert.ok(!bounds.isEmpty() && bounds.max.y > bounds.min.y, `${label}: no volume`);
}

test('all building ages and teams have complete, finite renderable geometry', () => {
  for (const age of AGES) for (const owner of [0, 1]) for (const [type, spec] of Object.entries(BUILDINGS)) {
    const e = { kind: 'building', type, owner, size: spec.size, constructed: false, progress: 0.4, amount: 300 };
    const model = buildModel(e, age), g = new THREE.Group(); g.userData.anim = model.anim;
    animate(g, e, 1, false);
    checkGeometry(model, `${type}/${age}/${owner}`);
    assert.equal(model.anim.scaffold.visible, true);
    e.constructed = true; animate(g, e, 2, false);
    assert.equal(model.anim.scaffold.visible, false);
    assert.equal(model.anim.body.scale.y, 1);
  }
});

test('every unit renders and animates idle, movement and attack states', () => {
  for (const owner of [0, 1]) for (const [type, spec] of Object.entries(UNITS)) {
    const e = { ...spec, kind: 'unit', type, owner, id: 3, carry: { amount: 0 }, cd: 39, cooldown: 40 };
    const model = buildModel(e), g = new THREE.Group(); g.add(model.root); g.userData.anim = model.anim;
    for (const order of [{ type: 'idle' }, { type: 'move' }, { type: 'attack' }, { type: 'gather', kind: 'wood', phase: 'work' }]) {
      e.order = order;
      animate(g, e, 2.5, order.type === 'move');
      g.updateMatrixWorld(true);
      g.traverse(o => assert.ok(o.matrixWorld.elements.every(Number.isFinite), `${type}: invalid animation transform`));
    }
    checkGeometry(model, type);
  }
});

test('age upgrades change architecture without changing earlier cached models', () => {
  const e = Object.freeze({ kind: 'building', type: 'town_center', owner: 0, size: 3 });
  const stone = buildModel(e, 'stone');
  const geometry = stone.anim.body.children[0].geometry;
  const original = geometry.attributes.position.array.slice();
  const bronze = buildModel(e, 'bronze');
  assert.notDeepEqual(geometry.attributes.position.array, bronze.anim.body.children[0].geometry.attributes.position.array);
  assert.deepEqual(geometry.attributes.position.array, original);
  assert.notEqual(stone.root, buildModel(e, 'stone').root, 'instances must have independent animation transforms');
});

test('resources and relics have finite geometry and independent animations', () => {
  for (const type of ['tree', 'berry', 'gold', 'stone']) for (let id = 0; id < 6; id++) {
    const e = { kind: 'resource', type, id, amount: 50 }, model = buildModel(e), g = new THREE.Group();
    g.userData.anim = model.anim; animate(g, e, 1, false); checkGeometry(model, `${type}/${id}`);
  }
  checkGeometry(buildModel({ kind: 'relic' }), 'relic');
});
