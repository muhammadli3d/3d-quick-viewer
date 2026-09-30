import * as THREE from 'three';
import { loadWith } from './registry.js';
import { neutralMaterial, stripExtension } from './printing.js';

/**
 * Formats that may hold either a surface mesh or just points. If the
 * geometry has faces (an index) it becomes a Mesh, otherwise Points.
 */
function meshOrPoints(geometry, name) {
  const hasColor = !!geometry.attributes.color;
  let object;
  if (geometry.index && geometry.index.count >= 3) {
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    object = new THREE.Mesh(geometry, neutralMaterial({ color: hasColor ? 0xffffff : 0x9da1a8, vertexColors: hasColor }));
  } else {
    object = new THREE.Points(geometry, new THREE.PointsMaterial({ color: hasColor ? 0xffffff : 0xb8bcc4, vertexColors: hasColor, size: 1 }));
  }
  object.name = name;
  return object;
}

/** Stanford PLY: meshes or scans, with optional per-vertex colour. */
export async function loadPLY(files, manager, ctx) {
  const { PLYLoader } = await import('three/addons/loaders/PLYLoader.js');
  const geometry = await loadWith(new PLYLoader(manager), files.url, ctx.onProgress);
  return meshOrPoints(geometry, stripExtension(files.main.name));
}

/** Point Cloud Library .pcd (ASCII, binary or compressed). */
export async function loadPCD(files, manager, ctx) {
  const { PCDLoader } = await import('three/addons/loaders/PCDLoader.js');
  const points = await loadWith(new PCDLoader(manager), files.url, ctx.onProgress);
  points.name = stripExtension(files.main.name);
  if (!points.geometry.attributes.color) points.material.color.set(0xb8bcc4);
  return points;
}

/** Plain-text XYZ point cloud: "x y z [r g b]" per line. */
export async function loadXYZ(files, manager, ctx) {
  const { XYZLoader } = await import('three/addons/loaders/XYZLoader.js');
  const geometry = await loadWith(new XYZLoader(manager), files.url, ctx.onProgress);
  return meshOrPoints(geometry, stripExtension(files.main.name));
}

/** VTK legacy (.vtk) and XML PolyData (.vtp), common in scientific/scan pipelines. */
export async function loadVTK(files, manager, ctx) {
  const { VTKLoader } = await import('three/addons/loaders/VTKLoader.js');
  const geometry = await loadWith(new VTKLoader(manager), files.url, ctx.onProgress);
  return meshOrPoints(geometry, stripExtension(files.main.name));
}
