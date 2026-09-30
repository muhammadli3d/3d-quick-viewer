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

## Folder structure

```
index.html            page shell: toolbar, side panel, overlays
vite.config.js
src/
  main.js             entry point: wires viewer + UI + keyboard shortcuts
  style.css           dark/light theme via CSS variables on <html data-theme>
  viewer/Viewer.js    renderer, scene, cameras, OrbitControls, lights, framing, animation
  viewer/helpers.js   infinite grid (shader), axes gizmo (ViewHelper), bounds box, stats
  ui/panel.js         lil-gui settings panel
  utils/dispose.js    frees geometry/material/texture GPU memory
public/               static assets copied as-is
```

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
