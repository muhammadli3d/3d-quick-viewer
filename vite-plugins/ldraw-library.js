import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, normalize, sep, join } from 'node:path';

/**
 * Serves your local LDraw parts library at /ldraw/ in `npm run dev` and
 * `npm run preview`, so LDrawLoader can fetch parts like
 * /ldraw/parts/3001.dat. The library path comes from LDRAW_LIBRARY_PATH in
 * .env; it's never copied into the build or the repo.
 *
 * LDraw file names are officially case-insensitive but Windows zips and
 * Linux disks disagree, so if the exact path isn't found we retry lower-case.
 */
export function ldrawLibrary(libraryPath) {
  const root = libraryPath ? resolve(libraryPath) : null;
  const enabled = !!root && existsSync(join(root, 'LDConfig.ldr'));
  let base = '/';

  const middleware = (req, res, next) => {
    const url = decodeURIComponent((req.url ?? '').split('?')[0]);
    const prefix = `${base}ldraw/`;
    if (!url.startsWith(prefix)) return next();

    // Always answer /ldraw/* here: without this, a missing part would fall
    // through to Vite's SPA fallback and come back as index.html.
    if (!enabled) {
      res.statusCode = 404;
      return res.end('LDraw library not configured (set LDRAW_LIBRARY_PATH in .env)');
    }

    const rel = url.slice(prefix.length);
    for (const candidate of [rel, rel.toLowerCase()]) {
      const file = normalize(join(root, candidate));
      if (!file.startsWith(root + sep)) break; // block ../ path traversal
      if (existsSync(file) && statSync(file).isFile()) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'max-age=3600');
        return createReadStream(file).pipe(res);
      }
    }
    res.statusCode = 404;
    res.end('Not found');
  };

  return {
    name: 'ldraw-library',
    configResolved(config) {
      base = config.base;
      if (libraryPath && !enabled) {
        config.logger.warn(`[ldraw] LDRAW_LIBRARY_PATH="${libraryPath}" has no LDConfig.ldr — LDraw parts disabled.`);
      } else if (enabled) {
        config.logger.info(`[ldraw] Serving LDraw library from ${root} at ${base}ldraw/`);
      }
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
