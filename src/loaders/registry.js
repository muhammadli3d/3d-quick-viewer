import * as THREE from 'three';

/**
 * Extension → format description.
 *
 *   label   shown in the info panel
 *   upAxis  default up axis of files in this format ('y' or 'z')
 *   units   what one file unit usually means ('mm', 'cm', 'm', 'in')
 *   load    () => Promise<(files, manager, ctx) => Promise<Object3D>>
 *
 * Every loader is behind a dynamic import(), so Vite puts it in its own
 * chunk and the initial page only downloads three.js core + the UI.
 */
const printing = () => import('./printing.js');
const interchange = () => import('./interchange.js');
const gltf = () => import('./gltf.js');
const pointcloud = () => import('./pointcloud.js');
const cad = () => import('./cad.js');
const ldraw = () => import('./ldraw.js');

export const FORMATS = {
  // 3D printing (Z-up, millimetres)
  stl: { label: 'STL', upAxis: 'z', units: 'mm', load: () => printing().then((m) => m.loadSTL) },
  '3mf': { label: '3MF', upAxis: 'z', units: 'mm', load: () => printing().then((m) => m.load3MF) },
  // AMF is a print format like 3MF, so it gets the same Z-up default.
  amf: { label: 'AMF', upAxis: 'z', units: 'mm', load: () => printing().then((m) => m.loadAMF) },
  gcode: { label: 'G-code', upAxis: 'z', units: 'mm', load: () => printing().then((m) => m.loadGCode) },
  gco: { label: 'G-code', upAxis: 'z', units: 'mm', load: () => printing().then((m) => m.loadGCode) },

  // DCC / interchange
  obj: { label: 'Wavefront OBJ', upAxis: 'y', units: 'm', load: () => interchange().then((m) => m.loadOBJ) },
  gltf: { label: 'glTF', upAxis: 'y', units: 'm', load: () => gltf().then((m) => m.loadGLTF) },
  glb: { label: 'glTF binary', upAxis: 'y', units: 'm', load: () => gltf().then((m) => m.loadGLTF) },
  fbx: { label: 'FBX', upAxis: 'y', units: 'cm', load: () => interchange().then((m) => m.loadFBX) },
  dae: { label: 'COLLADA', upAxis: 'y', units: 'm', load: () => interchange().then((m) => m.loadDAE) },
  '3ds': { label: '3DS', upAxis: 'y', units: 'm', load: () => interchange().then((m) => m.load3DS) },
  usdz: { label: 'USDZ', upAxis: 'y', units: 'm', load: () => interchange().then((m) => m.loadUSD) },
  usda: { label: 'USD (ASCII)', upAxis: 'y', units: 'm', load: () => interchange().then((m) => m.loadUSD) },
  usdc: { label: 'USD (crate)', upAxis: 'y', units: 'm', load: () => interchange().then((m) => m.loadUSD) },
  usd: { label: 'USD', upAxis: 'y', units: 'm', load: () => interchange().then((m) => m.loadUSD) },

  // Scans / point clouds / scientific
  ply: { label: 'PLY', upAxis: 'y', units: 'm', load: () => pointcloud().then((m) => m.loadPLY) },
  pcd: { label: 'PCD point cloud', upAxis: 'y', units: 'm', load: () => pointcloud().then((m) => m.loadPCD) },
  xyz: { label: 'XYZ point cloud', upAxis: 'y', units: 'm', load: () => pointcloud().then((m) => m.loadXYZ) },
  vtk: { label: 'VTK', upAxis: 'y', units: 'm', load: () => pointcloud().then((m) => m.loadVTK) },
  vtp: { label: 'VTK PolyData', upAxis: 'y', units: 'm', load: () => pointcloud().then((m) => m.loadVTK) },

  // CAD (occt converts STEP/IGES to mm). Rhino is always Z-up.
  step: { label: 'STEP', upAxis: 'y', units: 'mm', load: () => cad().then((m) => m.loadCAD) },
  stp: { label: 'STEP', upAxis: 'y', units: 'mm', load: () => cad().then((m) => m.loadCAD) },
  iges: { label: 'IGES', upAxis: 'y', units: 'mm', load: () => cad().then((m) => m.loadCAD) },
  igs: { label: 'IGES', upAxis: 'y', units: 'mm', load: () => cad().then((m) => m.loadCAD) },
  '3dm': { label: 'Rhino 3DM', upAxis: 'z', units: 'mm', load: () => cad().then((m) => m.load3DM) },

  // LEGO (the loader flips −Y-up to Y-up and scales LDU → mm)
  ldr: { label: 'LDraw', upAxis: 'y', units: 'mm', quietMissing: true, load: () => ldraw().then((m) => m.loadLDraw) },
  mpd: { label: 'LDraw MPD', upAxis: 'y', units: 'mm', quietMissing: true, load: () => ldraw().then((m) => m.loadLDraw) },
  dat: { label: 'LDraw part', upAxis: 'y', units: 'mm', quietMissing: true, load: () => ldraw().then((m) => m.loadLDraw) },
};

/**
 * Formats we can't open, with a hint about what to export instead.
 * (Most are closed, undocumented formats that need the authoring app.)
 */
export const UNSUPPORTED = {
  ma: 'Maya ASCII scenes need Maya. Export as FBX or glTF (File › Export Selection), or OBJ for static meshes.',
  mb: 'Maya binary scenes need Maya. Export as FBX or glTF (File › Export Selection), or OBJ for static meshes.',
  max: '3ds Max scenes need 3ds Max. Export as FBX or glTF.',
  c4d: 'Cinema 4D scenes need Cinema 4D. Export as FBX or glTF.',
  skp: 'SketchUp files need SketchUp. Export as COLLADA (.dae), OBJ or STL.',
  blend: 'Blender files need Blender. Export as glTF (.glb) — it keeps materials and animation.',
  sldprt: 'SolidWorks parts are proprietary. Save As STEP (.step) for exact CAD, or STL/3MF for printing.',
  sldasm: 'SolidWorks assemblies are proprietary. Save As STEP (.step) for exact CAD, or STL/3MF for printing.',
  f3d: 'Fusion archives need Fusion. Export as STEP (.step) or 3MF/STL for printing.',
  f3z: 'Fusion archives need Fusion. Export as STEP (.step) or 3MF/STL for printing.',
  ipt: 'Inventor parts need Inventor. Export as STEP (.step) or STL.',
  catpart: 'CATIA parts need CATIA. Export as STEP (.step) or STL.',
  io: 'BrickLink Studio files are encrypted zips. Export from Studio as LDraw (.ldr/.mpd) or COLLADA (.dae).',
  lxf: 'LEGO Digital Designer files: open in BrickLink Studio and export as LDraw (.ldr/.mpd).',
};

/**
 * Extensions that only make sense as companions of a main model file.
 * They're never picked as "the" model when several files are dropped.
 */
const COMPANION_EXTS = new Set(['mtl', 'bin', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tga', 'tif', 'tiff', 'ktx2', 'dds', 'hdr', 'exr']);

export function extensionOf(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Last path segment, lower-cased, URL-decoded; works for "a/b\\c.png?x=1". */
export function basename(url) {
  let name = url.split(/[?#]/)[0];
  name = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
  try {
    name = decodeURIComponent(name);
  } catch {
    /* malformed % escapes: use as-is */
  }
  return name.toLowerCase();
}

/** A user-facing error: its message is shown as-is in a toast. */
export class LoadError extends Error {
  constructor(title, detail = '') {
    super(detail ? `${title}\n${detail}` : title);
    this.title = title;
    this.detail = detail;
  }
}

/**
 * Pick which dropped file is the model, and describe how to load it.
 * @param {File[]} files
 */
export function resolveFiles(files) {
  const candidates = files.filter((f) => FORMATS[extensionOf(f.name)] && !COMPANION_EXTS.has(extensionOf(f.name)));

  if (!candidates.length) {
    const unsupported = files.find((f) => UNSUPPORTED[extensionOf(f.name)]);
    if (unsupported) {
      throw new LoadError(`Can't open .${extensionOf(unsupported.name)} files directly`, UNSUPPORTED[extensionOf(unsupported.name)]);
    }
    const exts = [...new Set(files.map((f) => '.' + (extensionOf(f.name) || '?')))].join(', ');
    throw new LoadError(`Unsupported file type (${exts})`, `Supported: ${Object.keys(FORMATS).map((e) => '.' + e).join(' ')}`);
  }

  // Prefer the format listed earliest in FORMATS priority… but within LDraw a
  // .dat is usually a part, so prefer .ldr/.mpd when both were dropped.
  candidates.sort((a, b) => rank(extensionOf(a.name)) - rank(extensionOf(b.name)));
  const main = candidates[0];
  const ext = extensionOf(main.name);
  return {
    main,
    ext,
    format: FORMATS[ext],
    ignored: candidates.slice(1).filter((f) => extensionOf(f.name) !== 'dat'),
  };
}

function rank(ext) {
  return ext === 'dat' ? 1 : 0;
}

/**
 * Turn the dropped files into blob: URLs, keyed by lower-case basename.
 * Call `revoke()` once the model has been replaced to free the memory.
 */
export function createFileSet(files, main) {
  const urls = new Map();
  for (const file of files) urls.set(file.name.toLowerCase(), URL.createObjectURL(file));
  return {
    main,
    files,
    urls,
    url: urls.get(main.name.toLowerCase()),
    /** Find a dropped file by name (case-insensitive, folder paths ignored). */
    get: (name) => files.find((f) => f.name.toLowerCase() === basename(name)),
    revoke: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  };
}

/**
 * A LoadingManager whose URL modifier redirects every request a loader makes
 * ("textures/Wood.PNG", "C:\\export\\scene.bin", …) to the matching dropped
 * file, by basename. Anything not dropped passes through unchanged (and will
 * usually 404, which we report as a missing file).
 */
export function createManager(fileSet, { onProgress, onMissing }) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url.startsWith('data:')) return url;
    // Note: relative paths inside a file loaded from a blob: URL come out as
    // "blob:http://host/texture.png", so blob: URLs must be looked up too.
    return fileSet.urls.get(basename(url)) ?? url;
  });
  manager.onProgress = (_url, loaded, total) => onProgress?.(total ? loaded / total : null);
  manager.onError = (url) => onMissing?.(url);

  // Count in-flight requests so we can wait for late texture loads.
  manager.pending = 0;
  const { itemStart, itemEnd } = manager;
  manager.itemStart = (url) => {
    manager.pending++;
    itemStart(url);
  };
  manager.itemEnd = (url) => {
    manager.pending--;
    itemEnd(url);
  };
  return manager;
}

/**
 * Wrap a callback-style three.js loader.load() in a promise, forwarding byte
 * progress. (loadAsync exists too, but this keeps the progress callback.)
 */
export function loadWith(loader, url, onProgress) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      resolve,
      (e) => e.lengthComputable && onProgress?.(e.loaded / e.total),
      (err) => reject(err instanceof Error ? err : new Error(String(err?.message ?? err))),
    );
  });
}

/**
 * Load a model end to end.
 * @returns {Promise<{ object: THREE.Object3D, missing: string[], warnings: string[] }>}
 */
export async function loadModel(plan, fileSet, { renderer, onStage, onProgress }) {
  const missing = new Set();
  const warnings = [];
  const manager = createManager(fileSet, {
    onProgress,
    onMissing: (url) => {
      const ours = [...fileSet.urls.values()].includes(url);
      if (!ours && !url.startsWith('data:') && !plan.format.quietMissing) missing.add(basename(url));
    },
  });

  onStage?.('Loading loader…');
  const load = await plan.format.load();

  onStage?.(`Parsing ${plan.format.label}…`);
  const object = await load(fileSet, manager, {
    renderer,
    onStage,
    onProgress,
    ext: plan.ext,
    warn: (message) => warnings.push(message),
  });
  if (!object?.isObject3D) throw new LoadError('The file loaded but contained no 3D data.');
  finalize(object);

  // Let async texture requests (e.g. OBJ+MTL) settle so we can report missing ones.
  await waitForManager(manager);
  return { object, missing: [...missing], warnings };
}

/**
 * Format-independent tidy-up after loading:
 * - give point clouds a point size relative to the model (loaders use
 *   fixed sizes like 0.005 that are invisible on a mm-scale scan)
 */
function finalize(object) {
  const points = [];
  object.traverse((o) => o.isPoints && points.push(o));
  if (points.length) {
    const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).length();
    for (const p of points) {
      p.material.size = size / 500;
      p.material.sizeAttenuation = true;
      p.userData.basePointSize = p.material.size;
    }
  }
}

/** Resolve once the manager has no requests in flight (or after `timeout` ms). */
function waitForManager(manager, timeout = 10000) {
  const start = performance.now();
  return new Promise((resolve) => {
    const check = () => {
      if (manager.pending <= 0 || performance.now() - start > timeout) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}
