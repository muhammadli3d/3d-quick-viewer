import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { extensionOf } from './registry.js';
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
