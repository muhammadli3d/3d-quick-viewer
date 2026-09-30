import * as THREE from 'three';

export const VIEW_MODES = {
  shaded: 'Shaded',
  wireframe: 'Wireframe',
  'shaded+wire': 'Shaded + wireframe',
  normals: 'Normals',
  clay: 'Clay',
};

/*
 * How it works: every Mesh keeps its file material in
 * `mesh.userData.originalMaterial` while an override is shown. Override
 * materials are shared by all meshes (one draw state instead of thousands).
 * "Shaded + wireframe" adds a child mesh ("__wire") that re-draws the same
 * geometry with a wireframe material on top.
 */
const overrides = {
  wireframe: new THREE.MeshBasicMaterial({ color: 0x9ec5ff, wireframe: true }),
  wireOverlay: new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.35 }),
  normals: new THREE.MeshNormalMaterial(),
  // Matte, warm-grey "sculpting clay": shows form without texture/colour noise.
  clay: new THREE.MeshStandardMaterial({ color: 0xc8c0b4, roughness: 0.85, metalness: 0 }),
};

function meshesOf(root) {
  const meshes = [];
  root.traverse((obj) => {
    if (obj.isMesh && !obj.name.startsWith('__')) meshes.push(obj);
  });
  return meshes;
}

const eachMaterial = (material, fn) => (Array.isArray(material) ? material.forEach(fn) : material && fn(material));

/** Put every mesh back on its original material and remove overlays. */
export function restoreMaterials(root) {
  for (const mesh of meshesOf(root)) {
    if (mesh.userData.originalMaterial) {
      mesh.material = mesh.userData.originalMaterial;
      delete mesh.userData.originalMaterial;
    }
    const wire = mesh.children.find((c) => c.name === '__wire');
    if (wire) mesh.remove(wire);
    // Undo the polygon offset used to keep the wire overlay from z-fighting.
    eachMaterial(mesh.material, (m) => {
      if (m.userData.savedPolygonOffset) {
        Object.assign(m, m.userData.savedPolygonOffset);
        delete m.userData.savedPolygonOffset;
        m.needsUpdate = true;
      }
    });
  }
}

export function applyViewMode(root, mode, { doubleSided = false } = {}) {
  restoreMaterials(root);
  const side = doubleSided ? THREE.DoubleSide : THREE.FrontSide;
  for (const m of Object.values(overrides)) m.side = side;

  for (const mesh of meshesOf(root)) {
    switch (mode) {
      case 'wireframe':
      case 'normals':
      case 'clay':
        mesh.userData.originalMaterial = mesh.material;
        mesh.material = overrides[mode];
        break;

      case 'shaded+wire': {
        // Push the shaded faces slightly back in depth so the lines win.
        eachMaterial(mesh.material, (m) => {
          m.userData.savedPolygonOffset = {
            polygonOffset: m.polygonOffset,
            polygonOffsetFactor: m.polygonOffsetFactor,
            polygonOffsetUnits: m.polygonOffsetUnits,
          };
          Object.assign(m, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
          m.needsUpdate = true;
        });
        mesh.add(createWireOverlay(mesh));
        break;
      }
      default:
        break; // 'shaded' = originals, already restored
    }
  }
}

/** A mesh that shares `mesh`'s geometry (and skeleton / instances) but draws wireframe. */
function createWireOverlay(mesh) {
  let wire;
  if (mesh.isSkinnedMesh) {
    wire = new THREE.SkinnedMesh(mesh.geometry, overrides.wireOverlay);
    wire.bind(mesh.skeleton, mesh.bindMatrix);
    wire.bindMode = mesh.bindMode;
  } else if (mesh.isInstancedMesh) {
    wire = new THREE.InstancedMesh(mesh.geometry, overrides.wireOverlay, mesh.count);
    wire.instanceMatrix = mesh.instanceMatrix;
  } else {
    wire = new THREE.Mesh(mesh.geometry, overrides.wireOverlay);
  }
  // Morph targets: share the parent's influences array so the overlay follows.
  wire.morphTargetInfluences = mesh.morphTargetInfluences;
  wire.morphTargetDictionary = mesh.morphTargetDictionary;
  wire.name = '__wire';
  wire.raycast = () => {};
  return wire;
}

/**
 * Double-sided rendering for the file's own materials. The original `side`
 * is remembered so switching it off restores what the file asked for.
 */
export function setDoubleSided(root, enabled) {
  root.traverse((obj) => {
    if (!obj.isMesh || obj.name.startsWith('__')) return;
    eachMaterial(obj.userData.originalMaterial ?? obj.material, (m) => {
      if (m.userData.fileSide === undefined) m.userData.fileSide = m.side;
      m.side = enabled ? THREE.DoubleSide : m.userData.fileSide;
      m.needsUpdate = true;
    });
  });
  for (const m of Object.values(overrides)) m.side = enabled ? THREE.DoubleSide : THREE.FrontSide;
}

/** Wireframe colours that stay readable on the current background. */
export function setViewModeTheme(dark) {
  overrides.wireframe.color.set(dark ? 0x9ec5ff : 0x1f5fbf);
  overrides.wireOverlay.opacity = dark ? 0.45 : 0.3;
}
