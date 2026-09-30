import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Some libraries are not ES modules you can `import`: 3DMLoader fetches
 * rhino3dm.js + rhino3dm.wasm at runtime from a folder URL you give it
 * (setLibraryPath) and runs them inside a Web Worker. This plugin exposes
 * such files under /vendor/…
 *
 *   dev     served straight from node_modules by a middleware
 *   build   copied into dist/vendor/… as assets
 *
 * so nothing has to be copied into /public by hand or committed.
 */
const nm = (p) => fileURLToPath(new URL(`../node_modules/${p}`, import.meta.url));

// (Draco/Basis decoders don't need this: DRACOLoader/KTX2Loader reference
// them with `new URL(..., import.meta.url)`, which Vite bundles by itself.)
const FILES = {
  'vendor/rhino3dm/rhino3dm.js': nm('rhino3dm/rhino3dm.js'),
  'vendor/rhino3dm/rhino3dm.wasm': nm('rhino3dm/rhino3dm.wasm'),
};

const MIME = { js: 'text/javascript', wasm: 'application/wasm' };

export function vendorAssets(extraFiles = {}) {
  const files = { ...FILES, ...extraFiles };
  let base = '/';

  return {
    name: 'vendor-assets',

    configResolved(config) {
      base = config.base;
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').split('?')[0]);
        const key = path.startsWith(base) ? path.slice(base.length) : null;
        const source = key && files[key];
        if (!source) return next();
        res.setHeader('Content-Type', MIME[key.split('.').pop()] ?? 'application/octet-stream');
        res.end(readFileSync(source));
      });
    },

    generateBundle() {
      for (const [fileName, source] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(source) });
      }
    },
  };
}
