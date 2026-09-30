/**
 * Generate small test models into /samples using three.js exporters.
 *
 *   npm run samples
 *
 * Runs in plain Node (no browser): three's core and exporters don't need a
 * DOM, except GLTFExporter, which uses FileReader (polyfilled below).
 *
 * Output (all tiny, safe to commit):
 *   cube-20mm-binary.stl      20 mm calibration cube, binary STL (Z-up, mm)
 *   torus-knot-ascii.stl      ASCII STL
 *   robot.obj + robot.mtl     multi-object OBJ with materials (tests OBJ+MTL pairing)
 *   spinning-knot.glb         PBR materials + a keyframe animation
 *   vertex-colors.ply         ASCII PLY with per-vertex colours
 *   spiral.xyz                coloured point cloud
 *   brick-2x4.ldr             self-contained LDraw brick (no parts library needed)
 *   bricks-packed.mpd         packed MPD: embedded sub-part used 3× in 3 colours
 *   vase.gcode                spiral-vase toolpath with 40 layers
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const OUT = fileURLToPath(new URL('../samples/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const write = (name, data) => {
  const buf = typeof data === 'string' ? data : Buffer.from(data instanceof ArrayBuffer ? data : data.buffer);
  writeFileSync(OUT + name, buf);
  console.log(`  ${name.padEnd(24)} ${(Buffer.byteLength(buf) / 1024).toFixed(1).padStart(7)} KB`);
};

// GLTFExporter turns its output Blob into an ArrayBuffer with FileReader,
// which Node doesn't have. Blob.arrayBuffer() does the same job.
globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.({ target: this });
      this.onload?.({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((ab) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(ab).toString('base64')}`;
      this.onloadend?.({ target: this });
      this.onload?.({ target: this });
    });
  }
};

console.log('Writing samples to /samples:');

// ---------------------------------------------------------------------
// STL: binary 20 mm cube + ASCII torus knot (Z-up, millimetres)
// ---------------------------------------------------------------------
{
  const stl = new STLExporter();
  const cube = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20).translate(0, 0, 10)); // sits on Z = 0
  cube.updateMatrixWorld();
  write('cube-20mm-binary.stl', stl.parse(cube, { binary: true }));

  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(10, 3, 64, 8).translate(0, 0, 13));
  knot.updateMatrixWorld();
  write('torus-knot-ascii.stl', stl.parse(knot, { binary: false }));
}

// ---------------------------------------------------------------------
// OBJ + MTL: a little robot made of named parts (tests the outliner too)
// ---------------------------------------------------------------------
{
  const mat = (name) => Object.assign(new THREE.MeshStandardMaterial(), { name });
  const robot = new THREE.Group();
  const part = (name, geometry, material, x, y, z) => {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.position.set(x, y, z);
    robot.add(m);
  };
  part('body', new THREE.BoxGeometry(1, 1.2, 0.6), mat('robot_body'), 0, 1.3, 0);
  part('head', new THREE.SphereGeometry(0.35, 24, 16), mat('robot_head'), 0, 2.2, 0);
  part('arm_left', new THREE.CylinderGeometry(0.12, 0.12, 1, 16), mat('robot_limb'), -0.65, 1.3, 0);
  part('arm_right', new THREE.CylinderGeometry(0.12, 0.12, 1, 16), mat('robot_limb'), 0.65, 1.3, 0);
  part('leg_left', new THREE.CylinderGeometry(0.15, 0.15, 0.7, 16), mat('robot_limb'), -0.25, 0.35, 0);
  part('leg_right', new THREE.CylinderGeometry(0.15, 0.15, 0.7, 16), mat('robot_limb'), 0.25, 0.35, 0);
  robot.updateMatrixWorld(true);

  write('robot.obj', `# Sample robot (metres, Y-up)\nmtllib robot.mtl\n${new OBJExporter().parse(robot)}`);
  write(
    'robot.mtl',
    [
      'newmtl robot_body', 'Kd 0.85 0.35 0.10', 'Ks 0.3 0.3 0.3', 'Ns 40', '',
      'newmtl robot_head', 'Kd 0.90 0.90 0.92', 'Ks 0.5 0.5 0.5', 'Ns 80', '',
      'newmtl robot_limb', 'Kd 0.25 0.28 0.32', 'Ks 0.2 0.2 0.2', 'Ns 20', '',
    ].join('\n'),
  );
}

// ---------------------------------------------------------------------
// GLB: PBR materials + an animation clip (tests the Animation panel)
// ---------------------------------------------------------------------
{
  const scene = new THREE.Scene();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.7, 0.15, 48),
    new THREE.MeshStandardMaterial({ name: 'plinth', color: 0x2b2f36, roughness: 0.6, metalness: 0.2 }),
  );
  base.name = 'plinth';
  base.position.y = 0.075;
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.3, 0.1, 128, 16),
    new THREE.MeshStandardMaterial({ name: 'gold', color: 0xffc657, roughness: 0.25, metalness: 1 }),
  );
  knot.name = 'knot';
  knot.position.y = 0.7;
  scene.add(base, knot);

  const spin = new THREE.AnimationClip('spin', 4, [
    new THREE.QuaternionKeyframeTrack(
      'knot.quaternion',
      [0, 1, 2, 3, 4],
      [0, 0.5, 1, 1.5, 2].flatMap((t) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t * Math.PI).toArray()),
    ),
    new THREE.VectorKeyframeTrack('knot.position', [0, 2, 4], [0, 0.7, 0, 0, 0.85, 0, 0, 0.7, 0]),
  ]);

  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, animations: [spin] });
  write('spinning-knot.glb', glb);
}

// ---------------------------------------------------------------------
// PLY: sphere coloured by its normals (tests vertex colours)
// ---------------------------------------------------------------------
{
  const geometry = new THREE.IcosahedronGeometry(1, 4);
  const normal = geometry.attributes.normal;
  const colors = new Float32Array(normal.count * 3);
  for (let i = 0; i < normal.count; i++) {
    colors[i * 3] = normal.getX(i) * 0.5 + 0.5;
    colors[i * 3 + 1] = normal.getY(i) * 0.5 + 0.5;
    colors[i * 3 + 2] = normal.getZ(i) * 0.5 + 0.5;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Weld duplicate vertices so the PLY stores shared verts + a face list.
  const indexed = mergeVertices(geometry);
  const mesh = new THREE.Mesh(indexed);
  mesh.updateMatrixWorld();
  write('vertex-colors.ply', new PLYExporter().parse(mesh, null, { binary: false }));
}

// ---------------------------------------------------------------------
// XYZ: coloured spiral point cloud ("x y z r g b" per line)
// ---------------------------------------------------------------------
{
  const lines = [];
  for (let i = 0; i < 3000; i++) {
    const t = i / 3000;
    const a = t * Math.PI * 16;
    const r = 0.3 + t * 0.7 + (Math.sin(i * 12.9898) * 0.5) * 0.03; // a little noise like a scan
    const c = new THREE.Color().setHSL(t, 0.8, 0.55);
    lines.push(
      [Math.cos(a) * r, t * 2, Math.sin(a) * r].map((v) => v.toFixed(4)).join(' ') +
        ' ' +
        [c.r, c.g, c.b].map((v) => Math.round(v * 255)).join(' '),
    );
  }
  write('spiral.xyz', lines.join('\n') + '\n');
}

// ---------------------------------------------------------------------
// LDraw: brick geometry written directly as type 3/4 (tri/quad) lines,
// so no parts library is needed. LDraw is −Y up: Y grows downward.
// ---------------------------------------------------------------------
function ldrawBrick(studsX, studsZ, color = 16) {
  const w = studsX * 20; // 1 stud = 20 LDU
  const d = studsZ * 20;
  const h = 24; // brick height in LDU (9.6 mm)
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  const L = [];
  const q = (...p) => L.push(`4 ${color} ${p.map((v) => +v.toFixed(3)).join(' ')}`);
  const t = (...p) => L.push(`3 ${color} ${p.map((v) => +v.toFixed(3)).join(' ')}`);
  const e = (...p) => L.push(`2 24 ${p.map((v) => +v.toFixed(3)).join(' ')}`);
  // box: top (y=0), bottom (y=h), four sides — wound counter-clockwise seen from outside
  q(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1);
  q(x0, h, z1, x1, h, z1, x1, h, z0, x0, h, z0);
  q(x0, 0, z1, x1, 0, z1, x1, h, z1, x0, h, z1);
  q(x1, 0, z0, x0, 0, z0, x0, h, z0, x1, h, z0);
  q(x1, 0, z1, x1, 0, z0, x1, h, z0, x1, h, z1);
  q(x0, 0, z0, x0, 0, z1, x0, h, z1, x0, h, z0);
  // outline edges
  for (const y of [0, h]) {
    e(x0, y, z0, x1, y, z0); e(x1, y, z0, x1, y, z1); e(x1, y, z1, x0, y, z1); e(x0, y, z1, x0, y, z0);
  }
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) e(x, 0, z, x, h, z);
  // studs: 12-sided cylinders, Ø12 LDU, 4 LDU tall, on a 20 LDU pitch
  const seg = 12, r = 6, sh = 4;
  for (let i = 0; i < studsX; i++) {
    for (let k = 0; k < studsZ; k++) {
      const cx = x0 + 10 + i * 20, cz = z0 + 10 + k * 20;
      for (let s = 0; s < seg; s++) {
        const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
        const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r];
        const p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
        q(p0[0], 0, p0[1], p1[0], 0, p1[1], p1[0], -sh, p1[1], p0[0], -sh, p0[1]); // side
        t(cx, -sh, cz, p0[0], -sh, p0[1], p1[0], -sh, p1[1]); // top cap
        e(p0[0], -sh, p0[1], p1[0], -sh, p1[1]);
      }
    }
  }
  return L;
}

write(
  'brick-2x4.ldr',
  ['0 Brick 2 x 4 (sample, geometry inline — no library needed)', '0 Name: brick-2x4.ldr', '0 BFC CERTIFY CCW', ...ldrawBrick(2, 4, 4)].join('\r\n') + '\r\n',
);

write(
  'bricks-packed.mpd',
  [
    '0 FILE bricks-packed.ldr',
    '0 Three bricks (packed MPD sample: the sub-part is embedded below)',
    '0 Name: bricks-packed.ldr',
    // "1 <colour> x y z a b c d e f g h i <file>" — colour 16 in the part inherits this colour
    '1 4 0 0 0 1 0 0 0 1 0 0 0 1 brick-2x4.dat',
    '1 1 0 -24 0 0 0 1 0 1 0 -1 0 0 brick-2x4.dat',
    '1 14 0 -48 20 1 0 0 0 1 0 0 0 1 brick-2x4.dat',
    '',
    '0 FILE brick-2x4.dat',
    '0 Brick 2 x 4 (embedded)',
    '0 Name: brick-2x4.dat',
    '0 !LDRAW_ORG Part UNOFFICIAL',
    '0 BFC CERTIFY CCW',
    ...ldrawBrick(2, 4, 16),
    '',
  ].join('\r\n'),
);

// ---------------------------------------------------------------------
// G-code: 40-layer spiral vase (cylinder, Ø30 mm, 0.2 mm layers)
// ---------------------------------------------------------------------
{
  const g = ['; Sample spiral vase for Local 3D Viewer', 'G21 ; mm', 'G90 ; absolute', 'M82 ; absolute E', 'G28', 'G92 E0'];
  g.push('G0 X110 Y100 Z0.2 F6000'); // travel to start
  let e = 0;
  const cx = 100, cy = 100, r = 15, segs = 48;
  for (let layer = 0; layer < 40; layer++) {
    const z = 0.2 + layer * 0.2;
    const radius = r + Math.sin(layer / 6) * 2; // gentle wave so layers are distinguishable
    for (let s = 1; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      e += ((2 * Math.PI * radius) / segs) * 0.033;
      g.push(`G1 X${(cx + Math.cos(a) * radius).toFixed(3)} Y${(cy + Math.sin(a) * radius).toFixed(3)} Z${z.toFixed(2)} E${e.toFixed(5)} F1800`);
    }
  }
  g.push('G0 Z20 F3000', 'M84');
  write('vase.gcode', g.join('\n') + '\n');
}

console.log('Done.');
