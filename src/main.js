import './style.css';
import { Viewer } from './viewer/Viewer.js';
import { createSettingsPanel } from './ui/panel.js';
import { initDropzone } from './ui/dropzone.js';
import { loading, toast } from './ui/overlay.js';
import { resolveFiles, createFileSet, loadModel, LoadError } from './loaders/registry.js';
import { formatBytes } from './utils/units.js';

const $ = (id) => document.getElementById(id);

const viewer = new Viewer($('viewport'));
const panel = createSettingsPanel(viewer, { onFrame: () => viewer.frame() });

// ---------------------------------------------------------------------
// Theme (dark default, remembered per browser)
// ---------------------------------------------------------------------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--viewport-bg').trim();
  viewer.setBackground(bg);
  viewer.setTheme(theme === 'dark');
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* storage can be unavailable (private mode); the theme just won't persist */
  }
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

let savedTheme = 'dark';
try {
  savedTheme = localStorage.getItem('theme') || 'dark';
} catch {
  /* ignore */
}
applyTheme(savedTheme);

// ---------------------------------------------------------------------
// Loading pipeline
// ---------------------------------------------------------------------
let currentFileSet = null; // blob: URLs of the files behind the shown model
let busy = false;

/** Wait for the browser to paint (so the overlay shows before a long, blocking parse). */
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function openFiles(files) {
  if (busy) {
    toast('warn', 'Still loading the previous file…');
    return;
  }

  let plan;
  try {
    plan = resolveFiles(files);
  } catch (err) {
    showError(err);
    return;
  }

  busy = true;
  const fileSet = createFileSet(files, plan.main);
  loading.show(plan.main.name);
  await nextPaint();

  try {
    const { object, missing, warnings } = await loadModel(plan, fileSet, {
      renderer: viewer.renderer,
      onStage: (text) => loading.stage(text),
      onProgress: (f) => loading.progress(f),
    });

    loading.stage('Preparing scene…');
    await nextPaint();
    viewer.setModel(object, { upAxis: plan.format.upAxis });
    panel.sync('upAxis', plan.format.upAxis === 'z' ? 'Z-up' : 'Y-up');

    // The previous model is gone (disposed by setModel), so its blob URLs can go too.
    currentFileSet?.revoke();
    currentFileSet = fileSet;
    currentFile = { ...plan, size: plan.main.size };

    $('empty-state').hidden = true;
    $('file-label').textContent = `${plan.main.name} · ${formatBytes(plan.main.size)}`;
    document.title = `${plan.main.name} — Local 3D Viewer`;

    if (missing.length) {
      toast('warn', `${missing.length} referenced file(s) not found`, `${missing.slice(0, 8).join('\n')}${missing.length > 8 ? '\n…' : ''}\nDrop them together with the model to include them.`);
    }
    if (plan.ignored.length) {
      toast('info', `Opened ${plan.main.name}`, `Ignored other model files: ${plan.ignored.map((f) => f.name).join(', ')}`);
    }
    for (const w of warnings) toast('warn', 'Note', w);
  } catch (err) {
    fileSet.revoke();
    console.error(err);
    showError(err, plan.main.name);
  } finally {
    loading.hide();
    busy = false;
  }
}

let currentFile = null;

function showError(err, fileName) {
  if (err instanceof LoadError) {
    toast('error', err.title, err.detail);
  } else {
    toast('error', fileName ? `Couldn't load ${fileName}` : 'Something went wrong', err?.message ?? String(err));
  }
}

initDropzone({ input: $('file-input'), overlay: $('drop-overlay'), onFiles: openFiles });

// ---------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------
$('btn-frame').addEventListener('click', () => viewer.frame());
$('btn-theme').addEventListener('click', toggleTheme);
$('btn-open').addEventListener('click', () => $('file-input').click());
$('empty-state').addEventListener('click', () => $('file-input').click());

// ---------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  // Don't steal keys while typing in an input (lil-gui number boxes etc.).
  if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key.toLowerCase()) {
    case 'f':
      viewer.frame();
      break;
    case 'o':
      $('file-input').click();
      break;
    case 'g':
      panel.set('grid', !panel.state.grid);
      break;
    case 'a':
      panel.set('axes', !panel.state.axes);
      break;
    case 'c':
      panel.set('projection', panel.state.projection === 'Perspective' ? 'Orthographic' : 'Perspective');
      break;
    case 'u':
      panel.set('upAxis', panel.state.upAxis === 'Y-up' ? 'Z-up' : 'Y-up');
      break;
    case 'l':
      toggleTheme();
      break;
    default:
      return;
  }
  e.preventDefault();
});

// Handy for poking at the scene from DevTools: `viewer.scene`, `viewer.model`…
window.viewer = viewer;
