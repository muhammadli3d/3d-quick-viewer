import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { loadWith } from './registry.js';

/** Neutral grey "printed part" look used when a format carries no material. */
export function neutralMaterial(options = {}) {
  return new THREE.MeshStandardMaterial({ color: 0x9da1a8, roughness: 0.55, metalness: 0.05, ...options });
}

export function stripExtension(name) {
  return name.replace(/\.[^.]+$/, '');
}

/** STL, binary or ASCII (STLLoader sniffs which). */
export async function loadSTL(files, manager, ctx) {
  const geometry = await loadWith(new STLLoader(manager), files.url, ctx.onProgress);

  // Some exporters (Materialise/VisCAM "COLOR=" header) store per-face colours.
  const material = geometry.hasColors
    ? neutralMaterial({ color: 0xffffff, vertexColors: true, opacity: geometry.alpha, transparent: geometry.alpha < 1 })
    : neutralMaterial();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = stripExtension(files.main.name);
  return mesh;
}

/** 3MF (zip of XML + optional textures/colours). Z-up, millimetres by default. */
export async function load3MF(files, manager, ctx) {
  const { ThreeMFLoader } = await import('three/addons/loaders/3MFLoader.js');
  const group = await loadWith(new ThreeMFLoader(manager), files.url, ctx.onProgress);
  group.name ||= stripExtension(files.main.name);
  greyIfUncoloured(group);
  return group;
}

/** AMF (XML, sometimes zipped). */
export async function loadAMF(files, manager, ctx) {
  const { AMFLoader } = await import('three/addons/loaders/AMFLoader.js');
  const group = await loadWith(new AMFLoader(manager), files.url, ctx.onProgress);
  group.name ||= stripExtension(files.main.name);
  return group;
}

/**
 * G-code toolpaths. With splitLayer on, GCodeLoader emits two LineSegments per
 * layer ("layerN"): extrusion moves, then travel moves. We record the layer
 * count in userData so the UI can show a layer slider.
 */
export async function loadGCode(files, manager, ctx) {
  const { GCodeLoader } = await import('three/addons/loaders/GCodeLoader.js');
  const loader = new GCodeLoader(manager);
  loader.splitLayer = true;
  const group = await loadWith(loader, files.url, ctx.onProgress);

  // GCodeLoader rotates its result to Y-up itself; undo that so G-code is
  // handled like every other Z-up format (the viewer's up-axis toggle does it).
  group.rotation.set(0, 0, 0);
  group.name = stripExtension(files.main.name);

  let layerCount = 0;
  group.children.forEach((child) => {
    const layer = Number(child.name.replace('layer', ''));
    child.userData.layer = layer;
    child.userData.travel = child.material.name === 'path';
    layerCount = Math.max(layerCount, layer + 1);
  });
  // Softer colours than the loader's pure green/red. Travel moves start
  // hidden (like a slicer preview) so they don't clutter the view or the
  // bounding box; the settings panel can show them.
  group.children.forEach((child) => {
    child.material.color.set(child.userData.travel ? 0x9c4a4a : 0xf29d38);
    if (child.userData.travel) child.visible = false;
  });
  group.userData.gcode = { layerCount };
  if (!layerCount || !group.children.some((c) => c.geometry.attributes.position?.count)) {
    ctx.warn('No extrusion moves were found in this G-code.');
  }
  return group;
}

/** 3MF files without colour info get the loader's default; use our neutral grey instead. */
function greyIfUncoloured(root) {
  root.traverse((obj) => {
    if (!obj.isMesh || obj.geometry.attributes.color) return;
    const m = obj.material;
    if (!Array.isArray(m) && m.color && m.color.getHex() === 0xffffff && !m.map) {
      m.dispose();
      obj.material = neutralMaterial();
    }
  });
}
