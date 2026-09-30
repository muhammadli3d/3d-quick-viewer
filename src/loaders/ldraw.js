import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { loadWith } from './registry.js';
import { stripExtension } from './printing.js';
import { FALLBACK_LDCONFIG } from './ldraw-colors.js';

// The parts library is served at /ldraw/ by vite-plugins/ldraw-library.js
// when LDRAW_LIBRARY_PATH is set in .env. It is never bundled or committed.
const LIBRARY_URL = `${import.meta.env.BASE_URL}ldraw/`;

const LDU_TO_MM = 0.4; // 1 LDraw Unit = 0.4 mm (a 1x1 brick is 20 × 20 LDU wide)

let libraryStatus = null; // cached: { available: boolean }

async function checkLibrary() {
  if (libraryStatus) return libraryStatus;
  try {
    const res = await fetch(`${LIBRARY_URL}LDConfig.ldr`);
    // Check the content too: a static host may answer any URL with index.html.
    const text = res.ok ? await res.text() : '';
    libraryStatus = { available: text.includes('!COLOUR') };
  } catch {
    libraryStatus = { available: false };
  }
  return libraryStatus;
}

/**
 * LDraw .ldr / .mpd / .dat.
 *
 * - With the library: parts are fetched from /ldraw/parts/, /ldraw/p/ …
 *   and colours come from the official LDConfig.ldr.
 * - Without it: packed .mpd files (all parts embedded) still work; colours
 *   fall back to a small built-in table of common LEGO colours.
 */
export async function loadLDraw(files, manager, ctx) {
  const { available } = await checkLibrary();

  const loader = new LDrawLoader(manager);
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
  // Even without a library, point at /ldraw/: the dev/preview middleware
  // answers there with a clean 404 (a bare path could hit the SPA fallback
  // and get index.html back as a "part"). Dropped .dat files still resolve
  // first through the manager's URL modifier.
  loader.setPartsLibraryPath(LIBRARY_URL);

  ctx.onStage?.('Loading LDraw colours…');
  if (available) {
    await loader.preloadMaterials(`${LIBRARY_URL}LDConfig.ldr`);
  } else {
    const url = URL.createObjectURL(new Blob([FALLBACK_LDCONFIG], { type: 'text/plain' }));
    try {
      await loader.preloadMaterials(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  ctx.onStage?.('Parsing LDraw (fetching parts)…');
  let group;
  try {
    group = await loadWith(loader, files.url, ctx.onProgress);
  } catch (err) {
    if (/could not be loaded/i.test(err.message)) {
      const part = err.message.match(/"([^"]+)"/)?.[1] ?? 'a part';
      throw new Error(
        available
          ? `Part "${part}" is not in your LDraw library (is it an unofficial part?). Drop the .dat together with the model to include it.`
          : `This model references "${part}", but no LDraw parts library is configured.\n` +
              'Set LDRAW_LIBRARY_PATH in .env (see README → LDraw setup) and restart `npm run dev`, ' +
              'or open a packed .mpd that embeds its parts.',
      );
    }
    throw err;
  }

  // LDraw is −Y up (Y points down): flip 180° about X to make it Y-up,
  // then scale LDU → mm so dimensions read in real brick millimetres.
  group.rotation.x = Math.PI;
  group.scale.setScalar(LDU_TO_MM);
  group.name ||= stripExtension(files.main.name);

  if (!available) ctx.warn('No LDraw library configured: using built-in approximate colours. See README → LDraw setup.');
  return group;
}
