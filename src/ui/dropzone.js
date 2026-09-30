/**
 * Drag-and-drop anywhere on the window + the hidden <input type="file">.
 * Calls `onFiles(File[])` with every file dropped/picked at once, so the
 * loader can pair e.g. model.obj with model.mtl and its textures.
 * Dropped folders are walked recursively (folder paths are ignored later).
 */
export function initDropzone({ input, overlay, onFiles }) {
  let dragDepth = 0; // dragenter/leave fire for every child element, so count them

  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');

  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    overlay.hidden = false;
  });

  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); // required, or the browser won't fire 'drop'
    e.dataTransfer.dropEffect = 'copy';
  });

  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) overlay.hidden = true;
  });

  window.addEventListener('drop', async (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    overlay.hidden = true;
    const files = await filesFromDataTransfer(e.dataTransfer);
    if (files.length) onFiles(files);
  });

  input.addEventListener('change', () => {
    const files = [...input.files];
    input.value = ''; // so picking the same file again still fires 'change'
    if (files.length) onFiles(files);
  });
}

/**
 * DataTransfer.files flattens nothing: a dropped folder shows up as a useless
 * zero-byte entry. The (non-standard but universally supported)
 * webkitGetAsEntry() API lets us walk folders instead.
 */
async function filesFromDataTransfer(dt) {
  const entries = [...(dt.items ?? [])]
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);

  if (!entries.length) return [...dt.files];

  const out = [];
  await Promise.all(entries.map((entry) => walkEntry(entry, out)));
  return out;
}

async function walkEntry(entry, out) {
  if (entry.isFile) {
    out.push(await new Promise((resolve, reject) => entry.file(resolve, reject)));
    return;
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    // readEntries() returns results in batches (100 in Chrome) until empty.
    for (;;) {
      const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      await Promise.all(batch.map((child) => walkEntry(child, out)));
    }
  }
}
