import './style.css';
import { Viewer } from './viewer/Viewer.js';
import { createSettingsPanel } from './ui/panel.js';

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
