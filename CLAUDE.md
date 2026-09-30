# CLAUDE.md — Local 3D Viewer

Offline-first 3D model viewer (a replacement for the discontinued Microsoft 3D Viewer),
built with **Vite + three.js** in **plain modern JavaScript (ES modules, no TypeScript, no UI framework)**.
The owner is a technical artist who is learning from this code, so readability comes before cleverness.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run build` | Production build into `dist/` (must pass before every commit) |
| `npm run preview` | Serve the built `dist/` at http://localhost:4173 |

## Stack

- **three.js** (r186+). Loaders are imported from `three/addons/...`.
- **Vite 8** (vanilla template, Rolldown bundler).
- **lil-gui** for the settings panel.
- **occt-import-js** (OpenCASCADE → WASM) for STEP/IGES, run in a module Web Worker.
- **rhino3dm** (WASM) for .3dm, fetched at runtime by `Rhino3dmLoader`.

## Folder structure

```
index.html            page shell: toolbar, side panel, overlays
vite.config.js        plugins below + reads LDRAW_LIBRARY_PATH from .env
vite-plugins/
  vendor-assets.js    serves/copies rhino3dm.js+.wasm to /vendor/rhino3dm/
  ldraw-library.js    serves the local LDraw library at /ldraw/ (dev + preview)
.env.example          LDRAW_LIBRARY_PATH template
src/
  main.js             entry point: wires viewer + UI + keyboard shortcuts
  style.css           dark/light theme via CSS variables on <html data-theme>
  viewer/Viewer.js    renderer, scene, cameras, OrbitControls, lights, framing, animation
  viewer/helpers.js   infinite grid (shader), axes gizmo (ViewHelper), bounds box, stats
  viewer/bounds.js    bounding box of *visible* geometry (exact, per-vertex)
  loaders/registry.js extension → { label, upAxis, units, load } + file resolution,
                      blob-URL map, LoadingManager URL modifier, loadModel()
  loaders/printing.js STL, 3MF, AMF, G-code
  loaders/interchange.js OBJ(+MTL), FBX, COLLADA, 3DS, USD/USDZ
  loaders/gltf.js     glTF/GLB with Draco, KTX2, Meshopt
  loaders/pointcloud.js PLY, PCD, XYZ, VTK/VTP
  loaders/cad.js      STEP/IGES (occt worker) and Rhino 3DM
  loaders/occt.worker.js  Web Worker running occt-import-js
  loaders/ldraw.js    LDraw .ldr/.mpd/.dat (+ ldraw-colors.js fallback palette)
  ui/dropzone.js      drag-and-drop (incl. folders) + file input
  ui/overlay.js       loading overlay + toasts
  ui/panel.js         lil-gui settings panel
  utils/dispose.js    frees geometry/material/texture GPU memory
public/               static assets copied as-is
```

## Adding a format

1. Write `async function loadXYZ(files, manager, ctx)` in the matching `src/loaders/<family>.js`.
   - `files.url` is the main file's blob URL, `files.main` the `File`, `files.get(name)` finds a companion.
   - Pass `manager` to the three.js loader so dependent files resolve by filename.
   - Use `ctx.onStage(text)`, `ctx.onProgress(0..1)`, `ctx.warn(message)`; `ctx.renderer` is available.
   - Return an `Object3D`; put animation clips in `object.animations`.
   - Dynamically `import()` the three.js addon inside the function so it gets its own chunk.
2. Add the extension to `FORMATS` in `registry.js` with its default `upAxis` and `units`.
3. Add it to the README formats table.

## Gotchas found so far

- `USDZLoader` is deprecated (r179) → use `USDLoader` (handles usdz/usda/usdc).
- `VTKLoader` is deprecated and scheduled for removal in r194.
- `DRACOLoader`/`KTX2Loader` find their decoders via `new URL(..., import.meta.url)`;
  don't call `setDecoderPath`, Vite bundles them.
- `GCodeLoader` rotates its output to Y-up; we reset that and treat G-code as Z-up.
- `ColladaLoader`/`FBXLoader` already convert Z-up files; they stay `upAxis: 'y'`.
- Relative URLs inside a file loaded from a blob: URL look like `blob:http://host/tex.png`,
  so the URL modifier must look up blob: URLs by basename too.
- `occt-import-js` build prints "Module path/crypto externalized" warnings: harmless
  (Emscripten's Node-only code paths).

## Conventions

- ES modules, 2-space indent, single quotes, semicolons.
- Comment the **why** for anything non-obvious (three.js quirks, maths).
- `Viewer` owns all WebGL state; UI modules call its methods and listen to its events
  (`'model'`, `'animation'`). UI never touches `viewer.scene` internals directly.
- Helper objects in the scene are named with a `__` prefix (`__grid`, `__pivot`…) so
  the outliner and stats can skip them.
- Scene layout: `scene > __pivot (centring offset) > __up (Z-up → Y-up rotation) > model`.
  The loaded model itself is never modified by the viewer.
- The renderer uses `autoClear = false` and clears manually in `Viewer.render()`,
  because the axes gizmo is a second `render()` call into a corner viewport.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…).
- Never commit `node_modules/`, `dist/`, `.env` or the LDraw parts library.
- If a three.js API seems different from what you remember, check
  `node_modules/three/examples/jsm/...` — e.g. `THREE.Clock` is deprecated in favour of `THREE.Timer`.
