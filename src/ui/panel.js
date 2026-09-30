import GUI from 'lil-gui';

/**
 * lil-gui settings panel (top-right). `state` is the single source of truth
 * for the settings; each controller writes into it and calls the viewer.
 */
export function createSettingsPanel(viewer, { onFrame }) {
  const gui = new GUI({ title: 'Settings' });

  const state = {
    projection: 'Perspective',
    upAxis: 'Y-up',
    lightIntensity: 1.5,
    envIntensity: 1.0,
    grid: true,
    axes: true,
    stats: false,
    frame: () => onFrame(),
  };

  // --- View -----------------------------------------------------------
  const view = gui.addFolder('View');
  view
    .add(state, 'projection', ['Perspective', 'Orthographic'])
    .name('Camera')
    .onChange((v) => viewer.setOrthographic(v === 'Orthographic'));
  view
    .add(state, 'upAxis', ['Y-up', 'Z-up'])
    .name('Up axis')
    .onChange((v) => viewer.setUpAxis(v === 'Z-up' ? 'z' : 'y'));
  view.add(state, 'frame').name('Frame model (F)');

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

  // --- Helpers --------------------------------------------------------
  const helpers = gui.addFolder('Helpers');
  helpers.add(state, 'grid').name('Grid (G)').onChange((v) => viewer.setGridVisible(v));
  helpers.add(state, 'axes').name('Axes gizmo (A)').onChange((v) => viewer.setAxesVisible(v));
  helpers.add(state, 'stats').name('FPS stats').onChange((v) => viewer.setStatsVisible(v));

  /** Set a value from outside (keyboard shortcut, new file) and fire its onChange. */
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

  return { gui, state, set, sync };
}
