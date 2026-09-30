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
