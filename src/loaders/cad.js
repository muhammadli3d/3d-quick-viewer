import * as THREE from 'three';
import { loadWith } from './registry.js';
import { stripExtension } from './printing.js';

// ---------------------------------------------------------------------
// STEP / IGES via occt-import-js (OpenCASCADE in WebAssembly)
// ---------------------------------------------------------------------

let worker = null;

function runOcct(format, buffer, params) {
  // `new URL(..., import.meta.url)` + type: 'module' is the pattern Vite
  // recognises to bundle a worker (and its imports) as a separate file.
  worker ??= new Worker(new URL('./occt.worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => (data.error ? reject(new Error(data.error)) : resolve(data.result));
    worker.onerror = (e) => {
      worker = null; // a crashed worker can't be reused
      reject(new Error(e.message || 'The STEP/IGES worker crashed (file too large or corrupt?)'));
    };
    worker.postMessage({ format, buffer, params }, [buffer]);
  });
}

/** STEP (.step/.stp) and IGES (.iges/.igs) → meshes with per-face colours. */
export async function loadCAD(files, manager, ctx) {
  const format = ctx.ext.startsWith('ig') ? 'iges' : 'step';
  const buffer = await files.main.arrayBuffer();

  ctx.onStage?.('Tessellating B-rep with OpenCASCADE…');
  const result = await runOcct(format, buffer, {
    linearUnit: 'millimeter', // occt converts whatever the file uses into mm
    linearDeflectionType: 'bounding_box_ratio',
    linearDeflection: 0.001, // chord error = 0.1% of the model size
    angularDeflection: 0.5, // radians
  });
  if (!result?.success) throw new Error(`OpenCASCADE could not read this ${format.toUpperCase()} file.`);

  const materials = new Map(); // one material per colour, shared across parts
  const materialFor = (rgb) => {
    const key = rgb ? rgb.map((c) => c.toFixed(3)).join(',') : 'default';
    if (!materials.has(key)) {
      const color = rgb ? new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace) : new THREE.Color(0x9da1a8);
      materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide }));
    }
    return materials.get(key);
  };

  const meshes = result.meshes.map((m, i) => buildMesh(m, i, materialFor));

  // Rebuild the assembly tree (root → sub-assemblies → parts).
  const build = (node) => {
    const group = new THREE.Group();
    group.name = node.name || '';
    for (const index of node.meshes ?? []) if (meshes[index]) group.add(meshes[index]);
    for (const child of node.children ?? []) group.add(build(child));
    return group;
  };
  const root = build(result.root);
  root.name ||= stripExtension(files.main.name);
  return root;
}

function buildMesh(m, index, materialFor) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
  if (m.attributes.normal) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
  geometry.setIndex(new THREE.Uint32BufferAttribute(m.index.array, 1));
  if (!m.attributes.normal) geometry.computeVertexNormals();

  // B-rep faces can carry their own colour (e.g. a red face on a grey body).
  // Use geometry groups so each coloured range of triangles gets its material.
  const faces = m.brep_faces ?? [];
  const faceColors = faces.some((f) => f.color);
  let material;
  if (faceColors) {
    const palette = [];
    const indexOf = (mat) => {
      let i = palette.indexOf(mat);
      if (i === -1) i = palette.push(mat) - 1;
      return i;
    };
    for (const face of faces) {
      const mat = materialFor(face.color ?? m.color);
      const start = face.first * 3;
      const count = (face.last - face.first + 1) * 3;
      const last = geometry.groups[geometry.groups.length - 1];
      const matIndex = indexOf(mat);
      // Merge consecutive faces with the same colour into one draw call.
      if (last && last.materialIndex === matIndex && last.start + last.count === start) last.count += count;
      else geometry.addGroup(start, count, matIndex);
    }
    material = palette;
  } else {
    material = materialFor(m.color);
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = m.name || `Part ${index + 1}`;
  return mesh;
}

// ---------------------------------------------------------------------
// Rhino .3dm via rhino3dm (WASM), loaded lazily by Rhino3dmLoader
// ---------------------------------------------------------------------

let rhinoLoader = null;

export async function load3DM(files, manager, ctx) {
  const { Rhino3dmLoader } = await import('three/addons/loaders/3DMLoader.js');
  // rhino3dm.js/.wasm are served from /vendor/rhino3dm/ (see vite-plugins/vendor-assets.js).
  // The loader keeps its worker pool, so reuse one instance.
  rhinoLoader ??= new Rhino3dmLoader(manager).setLibraryPath(`${import.meta.env.BASE_URL}vendor/rhino3dm/`);
  rhinoLoader.manager = manager;

  ctx.onStage?.('Loading rhino3dm (first time only) and parsing…');
  const object = await loadWith(rhinoLoader, files.url, ctx.onProgress);
  object.name ||= stripExtension(files.main.name);

  for (const w of object.userData?.warnings ?? []) {
    ctx.warn(`3DM: ${w.message ?? w.type ?? w}`);
  }

  // Rhino stores the document unit (e.g. { name: 'UnitSystem_Millimeters' });
  // pass it on so the "file units" default is right for this file.
  const unit = String(object.userData?.settings?.modelUnitSystem?.name ?? '').replace('UnitSystem_', '');
  const map = { Millimeters: 'mm', Centimeters: 'cm', Meters: 'm', Inches: 'in' };
  if (map[unit]) object.userData.fileUnits = map[unit];
  return object;
}
