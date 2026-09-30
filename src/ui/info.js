import { formatBytes, formatCount, formatLength, formatNumber, convertLength, UNIT_LABELS } from '../utils/units.js';

/**
 * Info panel: file facts, scene statistics and bounding-box dimensions.
 * Pure rendering: main.js calls renderInfo() whenever anything changes.
 */
export function renderInfo(el, { file, format, stats, size, upAxis, fileUnits, displayUnits }) {
  const rows = [
    ['File', file.name],
    ['Format', format.label],
    ['Size', formatBytes(file.size)],
    ['Meshes', formatCount(stats.meshes)],
    ['Triangles', formatCount(stats.triangles)],
    ['Vertices', formatCount(stats.vertices)],
  ];
  if (stats.points) rows.push(['Points', formatCount(stats.points)]);
  if (stats.lines) rows.push(['Lines', formatCount(stats.lines)]);
  rows.push(['Materials', formatCount(stats.materials)]);
  if (stats.textures) rows.push(['Textures', formatCount(stats.textures)]);
  rows.push([
    'Animations',
    stats.animations ? `${stats.animations} (${stats.animationNames.slice(0, 3).join(', ')}${stats.animations > 3 ? '…' : ''})` : 'none',
  ]);

  // Show dimensions in the file's own convention: for Z-up files the
  // viewer's Y (up) is reported as Z, and its Z (towards you) as Y.
  const dims =
    upAxis === 'z'
      ? [['X', size.x], ['Y', size.z], ['Z', size.y]]
      : [['X', size.x], ['Y', size.y], ['Z', size.z]];
  const upLabel = upAxis === 'z' ? 'Z' : 'Y';

  const unitNote =
    displayUnits === 'file'
      ? 'raw file units'
      : `1 file unit = 1 ${UNIT_LABELS[fileUnits]}`;

  el.replaceChildren();
  el.append(h3('Model'), table(rows), h3('Dimensions', 'margin-top:10px'));

  const grid = document.createElement('div');
  grid.className = 'dims';
  for (const [axis, value] of dims) {
    const label = document.createElement('span');
    label.className = `axis-${axis.toLowerCase()}`;
    label.textContent = axis === upLabel ? `${axis} ↑` : axis;
    const v = document.createElement('span');
    v.textContent = formatLength(value, fileUnits, displayUnits);
    grid.append(label, v);
  }
  el.append(grid);

  const note = document.createElement('div');
  note.style.cssText = 'color:var(--text-dim);font-size:11px;margin-top:4px';
  note.textContent = unitNote;
  // LEGO bonus: footprint in studs (1 stud = 8 mm) for LDraw files.
  if (format.label.startsWith('LDraw') && displayUnits !== 'file') {
    const mm = (v) => convertLength(v, fileUnits, 'mm');
    note.textContent += ` · ≈ ${formatNumber(mm(size.x) / 8)} × ${formatNumber(mm(size.z) / 8)} studs`;
  }
  el.append(note);
}

function h3(text, style = '') {
  const h = document.createElement('h3');
  h.textContent = text;
  if (style) h.style.cssText = style;
  return h;
}

function table(rows) {
  const t = document.createElement('table');
  t.className = 'info-table';
  for (const [k, v] of rows) {
    const tr = t.insertRow();
    tr.insertCell().textContent = k;
    tr.insertCell().textContent = v;
  }
  return t;
}
