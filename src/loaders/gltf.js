import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { loadWith } from './registry.js';

// Decoders spin up Web Workers + WASM, so create them once and reuse.
let draco = null;
let ktx2 = null;

// No setDecoderPath()/setTranscoderPath() needed: in current three.js (r186) these loaders
// point at their bundled decoders via `new URL('../libs/…', import.meta.url)`,
// which Vite detects and copies into dist/assets automatically.
function decoders(renderer) {
  draco ??= new DRACOLoader();
  // detectSupport() asks the GPU which compressed formats it can use, so
  // Basis textures are transcoded to the best one (BC7, ASTC, ETC…).
  ktx2 ??= new KTX2Loader().detectSupport(renderer);
  return { draco, ktx2 };
}

/** .gltf (+ .bin + textures) and .glb, with Draco, KTX2/Basis and Meshopt. */
export async function loadGLTF(files, manager, ctx) {
  const { draco, ktx2 } = decoders(ctx.renderer);
  const loader = new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

  const gltf = await loadWith(loader, files.url, ctx.onProgress);
  const scene = gltf.scene ?? gltf.scenes[0];
  scene.name ||= files.main.name;
  scene.animations = gltf.animations ?? [];
  return scene;
}
