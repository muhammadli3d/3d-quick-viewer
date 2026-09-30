import { defineConfig, loadEnv } from 'vite';
import { vendorAssets } from './vite-plugins/vendor-assets.js';
import { ldrawLibrary } from './vite-plugins/ldraw-library.js';

export default defineConfig(({ mode }) => {
  // '' prefix = load all vars from .env, not just VITE_* ones. LDRAW_LIBRARY_PATH
  // is only used here in Node (never exposed to the browser bundle).
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [vendorAssets(), ldrawLibrary(env.LDRAW_LIBRARY_PATH)],
    build: {
      target: 'es2022',
      // three.js core alone is ~600 kB minified; every loader is split into its
      // own lazy chunk, so only the core chunk trips the default 500 kB warning.
      chunkSizeWarningLimit: 800,
    },
    worker: {
      format: 'es', // the STEP/IGES worker is an ES module worker
    },
  };
});
