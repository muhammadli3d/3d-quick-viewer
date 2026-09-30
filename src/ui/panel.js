import GUI from 'lil-gui';
import { VIEW_MODES } from '../viewer/viewModes.js';
import { UNIT_LABELS } from '../utils/units.js';

// lil-gui dropdowns take { label: value }
const invert = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));

/**
 * lil-gui settings panel (top-right). `state` is the single source of truth
 * for the settings; each controller writes into it and calls the viewer.
 *
 * Model-specific folders (Animation, G-code, Point cloud) are rebuilt by
 * `onModel()` each time a file is loaded.
 */
export function createSettingsPanel(viewer, { onFrame, onUnitsChange, onScreenshot }) {
  const gui = new GUI({ title: 'Settings' });

  const state = {
    // view
    projection: 'Perspective',
    upAxis: 'Y-up',
    viewMode: 'shaded',
    doubleSided: false,
    background: '#1e1f22',
    frame: () => onFrame(),
    // lighting
    lightIntensity: 1.5,
    envIntensity: 1.0,
    // helpers
    grid: true,
    axes: true,
    bounds: false,
    stats: false,
    // units
    displayUnits: 'mm',
    fileUnits: 'mm',
    // screenshot
    transparent: false,
    screenshot: () => onScreenshot(state.transparent),
    // model-specific
    playing: true,
    clip: 0,
    layer: 0,
    travel: false,
    pointScale: 1,
  };

  // --- View -----------------------------------------------------------
  const view = gui.addFolder('View');
  view
    .add(state, 'viewMode', invert(VIEW_MODES))
    .name('Mode (1–5)')
    .onChange((v) => viewer.setViewMode(v));
  view
    .add(state, 'projection', ['Perspective', 'Orthographic'])
    .name('Camera (C)')
    .onChange((v) => viewer.setOrthographic(v === 'Orthographic'));
  view
    .add(state, 'upAxis', ['Y-up', 'Z-up'])
    .name('Up axis (U)')
    .onChange((v) => {
      viewer.setUpAxis(v === 'Z-up' ? 'z' : 'y');
      onUnitsChange();
    });
  view.add(state, 'doubleSided').name('Double-sided (D)').onChange((v) => viewer.setDoubleSided(v));
  view.addColor(state, 'background').name('Background').onChange((v) => viewer.setBackground(v));
  view.add(state, 'frame').name('Frame model (F)');

  // --- Units ----------------------------------------------------------
  const units = gui.addFolder('Units');
  units
    .add(state, 'displayUnits', { ...invert(UNIT_LABELS), 'file units': 'file' })
    .name('Show in')
    .onChange(() => onUnitsChange());
  units
    .add(state, 'fileUnits', invert(UNIT_LABELS))
    .name('File units are')
    .onChange(() => onUnitsChange());

  // --- Lighting -------------------------------------------------------
  const light = gui.addFolder('Lighting');
  light
    .add(state, 'lightIntensity', 0, 6, 0.05)
    .name('Key light')
    .onChange((v) => viewer.setLightIntensity(v));
  light
    .add(state, 'envIntensity', 0, 3, 0.05)
    .name('Environment')
    .onChange((v) => viewer.setEnvironmentIntensity(v));
  light.close();

  // --- Helpers --------------------------------------------------------
  const helpers = gui.addFolder('Helpers');
  helpers.add(state, 'grid').name('Grid (G)').onChange((v) => viewer.setGridVisible(v));
  helpers.add(state, 'axes').name('Axes gizmo (A)').onChange((v) => viewer.setAxesVisible(v));
  helpers.add(state, 'bounds').name('Bounding box (B)').onChange((v) => viewer.setBoundsVisible(v));
  helpers.add(state, 'stats').name('FPS stats').onChange((v) => viewer.setStatsVisible(v));

  // --- Screenshot -----------------------------------------------------
  const shot = gui.addFolder('Screenshot');
  shot.add(state, 'transparent').name('Transparent bg');
  shot.add(state, 'screenshot').name('Save PNG (S)');

  // --- Model-specific folders -----------------------------------------
  let modelFolders = [];

  function onModel(model) {
    modelFolders.forEach((f) => f.destroy());
    modelFolders = [];

    // Animation: clip picker + play/pause
    if (viewer.clips.length) {
      const anim = gui.addFolder('Animation');
      const clips = Object.fromEntries(viewer.clips.map((c, i) => [`${i + 1}. ${c.name || 'clip'}`, i]));
      state.clip = 0;
      state.playing = viewer.isAnimationPlaying;
      anim.add(state, 'clip', clips).name('Clip').onChange((i) => viewer.playClip(i));
      anim
        .add(state, 'playing')
        .name('Playing (Space)')
        .onChange((v) => viewer.setAnimationPaused(!v));
      modelFolders.push(anim);
    }

    // G-code: show layers up to N, optional travel moves
    const gcode = model?.userData.gcode;
    if (gcode?.layerCount) {
      const folder = gui.addFolder('G-code');
      state.layer = gcode.layerCount - 1;
      state.travel = false;
      const applyLayers = () => {
        for (const child of model.children) {
          const inRange = child.userData.layer <= state.layer;
          child.visible = inRange && (!child.userData.travel || state.travel);
        }
      };
      folder
        .add(state, 'layer', 0, gcode.layerCount - 1, 1)
        .name(`Layer (of ${gcode.layerCount})`)
        .onChange(applyLayers);
      folder.add(state, 'travel').name('Travel moves').onChange(applyLayers);
      modelFolders.push(folder);
    }

    // Point clouds: point size
    let hasPoints = false;
    model?.traverse((o) => (hasPoints ||= o.isPoints));
    if (hasPoints) {
      const folder = gui.addFolder('Point cloud');
      state.pointScale = 1;
      folder
        .add(state, 'pointScale', 0.1, 10, 0.1)
        .name('Point size')
        .onChange((v) => viewer.setPointScale(v));
      modelFolders.push(folder);
    }
  }

  /** Set a value from outside (keyboard shortcut) and fire its onChange. */
  function set(key, value) {
    const controller = gui.controllersRecursive().find((c) => c.property === key);
    if (controller) controller.setValue(value);
    else state[key] = value;
  }

  /** Update the displayed value without firing onChange. */
  function sync(key, value) {
    state[key] = value;
    gui.controllersRecursive().find((c) => c.property === key)?.updateDisplay();
  }

  return { gui, state, set, sync, onModel };
}
