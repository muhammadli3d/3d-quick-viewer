import { defineConfig } from 'vite';
import { vendorAssets } from './vite-plugins/vendor-assets.js';

export default defineConfig({
  plugins: [vendorAssets()],
  build: {
    target: 'es2022',
    // three.js core alone is ~600 kB minified; every loader is split into its
    // own lazy chunk, so only the core chunk trips the default 500 kB warning.
    chunkSizeWarningLimit: 800,
  },
});
