/**
 * Web Worker that runs OpenCASCADE (occt-import-js, compiled to WASM) to
 * tessellate STEP/IGES B-rep data into triangles. Running it here keeps the
 * UI (and the loading spinner) responsive while big assemblies are meshed.
 */
import occtimportjs from 'occt-import-js';
import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';

let occtPromise = null;

self.onmessage = async ({ data }) => {
  try {
    // First use downloads + compiles the ~7 MB WASM; later files reuse it.
    occtPromise ??= occtimportjs({ locateFile: () => wasmUrl });
    const occt = await occtPromise;
    const result = occt.ReadFile(data.format, new Uint8Array(data.buffer), data.params);
    self.postMessage({ result });
  } catch (err) {
    self.postMessage({ error: err?.message ?? String(err) });
  }
};
