/**
 * Scene outliner: a collapsible tree of the model's hierarchy.
 * Click a row to highlight that node in the viewport, double-click to frame it,
 * Esc (handled in main.js) to clear the highlight.
 * Children are only built when a node is first expanded, so a model with
 * thousands of nodes (a big LDraw set, a CAD assembly) stays fast.
 */
export function createOutliner(container, { onSelect, onFocus }) {
  let selectedRow = null;

  function build(root) {
    container.replaceChildren();
    selectedRow = null;
    if (!root) return;
    const ul = document.createElement('ul');
    ul.className = 'tree';
    ul.append(buildNode(root, 0));
    container.append(ul);
  }

  function visibleChildren(obj) {
    return obj.children.filter((c) => !c.name.startsWith('__'));
  }

  function buildNode(obj, depth) {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'tree-row';

    const kids = visibleChildren(obj);
    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle';
    toggle.textContent = kids.length ? '▸' : '';

    const name = document.createElement('span');
    name.textContent = obj.name || `(${obj.type})`;

    const type = document.createElement('span');
    type.className = 'tree-type';
    type.textContent = typeLabel(obj, kids.length);

    row.append(toggle, name, type);
    row.title = `${obj.type}${obj.name ? ` "${obj.name}"` : ''}\nClick: highlight · Double-click: frame`;
    li.append(row);

    let childList = null;
    const setOpen = (open) => {
      if (!kids.length) return;
      if (open && !childList) {
        childList = document.createElement('ul');
        childList.className = 'tree';
        for (const child of kids) childList.append(buildNode(child, depth + 1));
        li.append(childList);
      }
      if (childList) childList.hidden = !open;
      toggle.textContent = open ? '▾' : '▸';
    };

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(toggle.textContent === '▸');
    });
    row.addEventListener('click', () => {
      if (selectedRow === row) return; // (a double-click fires two clicks)
      selectedRow?.classList.remove('selected');
      selectedRow = row;
      row.classList.add('selected');
      onSelect(obj);
    });
    row.addEventListener('dblclick', () => onFocus(obj));

    // Open the first couple of levels so the structure is visible at a glance.
    if (depth < 1 && kids.length <= 50) setOpen(true);
    return li;
  }

  function clearSelection() {
    selectedRow?.classList.remove('selected');
    selectedRow = null;
  }

  return { build, clearSelection };
}

function typeLabel(obj, childCount) {
  if (obj.isSkinnedMesh) return 'skinned';
  if (obj.isInstancedMesh) return `instanced ×${obj.count}`;
  if (obj.isMesh) return 'mesh';
  if (obj.isPoints) return 'points';
  if (obj.isLineSegments || obj.isLine) return 'lines';
  if (obj.isBone) return 'bone';
  if (obj.isLight) return 'light';
  if (obj.isCamera) return 'camera';
  return childCount ? `${childCount}` : '';
}
