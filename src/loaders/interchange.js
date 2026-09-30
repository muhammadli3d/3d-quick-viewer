import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { extensionOf, loadWith } from './registry.js';
import { neutralMaterial, stripExtension } from './printing.js';

/**
 * OBJ, with its MTL if it was dropped together. Textures referenced by the
 * MTL resolve through the manager's URL modifier (by filename).
 */
export async function loadOBJ(files, manager, ctx) {
  const text = await files.main.text();

  // "mtllib a.mtl" lines name the material libraries; fall back to any dropped .mtl.
  const mtlNames = [...text.matchAll(/^\s*mtllib\s+(.+?)\s*$/gm)].map((m) => m[1]);
  const mtlFile = mtlNames.map((n) => files.get(n)).find(Boolean) ?? files.files.find((f) => extensionOf(f.name) === 'mtl');

  const loader = new OBJLoader(manager);
  if (mtlFile) {
    ctx.onStage?.(`Reading ${mtlFile.name}…`);
    const materials = new MTLLoader(manager).parse(await mtlFile.text(), '');
    materials.preload();
    loader.setMaterials(materials);
  }

  ctx.onStage?.('Parsing OBJ…');
  const group = loader.parse(text);
  group.name = stripExtension(files.main.name);

  // Without an MTL, OBJLoader uses flat white Phong; swap in the neutral grey.
  if (!mtlFile) {
    if (mtlNames.length) ctx.warn?.(`Materials file "${mtlNames[0]}" wasn't dropped with the OBJ, so a plain grey material is used.`);
    group.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.material.dispose();
      obj.material = neutralMaterial({ vertexColors: !!obj.geometry.attributes.color });
      if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
    });
  } else if (mtlNames.length && !files.get(mtlNames[0])) {
    ctx.warn?.(`OBJ asks for "${mtlNames[0]}" but "${mtlFile.name}" was used instead.`);
  }
  return group;
}

/** FBX (binary or ASCII). Animations end up in group.animations. */
export async function loadFBX(files, manager, ctx) {
  const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
  const group = await loadWith(new FBXLoader(manager), files.url, ctx.onProgress);
  group.name ||= stripExtension(files.main.name);
  return group;
}

/** COLLADA .dae. The loader already converts Z_UP files and applies <unit>. */
export async function loadDAE(files, manager, ctx) {
  const { ColladaLoader } = await import('three/addons/loaders/ColladaLoader.js');
  const collada = await loadWith(new ColladaLoader(manager), files.url, ctx.onProgress);
  const scene = collada.scene;
  scene.name ||= stripExtension(files.main.name);
  scene.animations ??= []; // (collada.animations is deprecated; the loader fills scene.animations)
  return scene;
}

/** Autodesk .3ds (the old 3D Studio format, still common on model sites). */
export async function load3DS(files, manager, ctx) {
  const { TDSLoader } = await import('three/addons/loaders/TDSLoader.js');
  const group = await loadWith(new TDSLoader(manager), files.url, ctx.onProgress);
  group.name ||= stripExtension(files.main.name);
  return group;
}

/**
 * USDZ / USDA / USDC. USDZLoader is deprecated since r179 and just extends
 * USDLoader, which handles all three flavours, so we use that directly.
 */
export async function loadUSD(files, manager, ctx) {
  const { USDLoader } = await import('three/addons/loaders/USDLoader.js');
  const group = await loadWith(new USDLoader(manager), files.url, ctx.onProgress);
  group.name ||= stripExtension(files.main.name);
  return group;
}
