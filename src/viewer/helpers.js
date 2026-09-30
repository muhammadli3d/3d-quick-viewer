import * as THREE from 'three';
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';
import Stats from 'three/addons/libs/stats.module.js';

/**
 * Infinite-style ground grid.
 *
 * Instead of a GridHelper made of real line geometry (which has a hard edge
 * and aliases badly at grazing angles), this is one big quad whose fragment
 * shader draws the lines procedurally. `fwidth()` gives the screen-space size
 * of one world unit, so lines stay ~1px wide at any distance, and the whole
 * thing fades out radially so you never see the edge.
 */
export class InfiniteGrid extends THREE.Mesh {
  constructor() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    geometry.rotateX(-Math.PI / 2); // lie flat on the XZ (ground) plane

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        uCell: { value: 1 },
        uFade: { value: 100 },
        uMinorColor: { value: new THREE.Color(0x3a3c42) },
        uMajorColor: { value: new THREE.Color(0x55585f) },
        uXColor: { value: new THREE.Color(0xc0443c) },
        uZColor: { value: new THREE.Color(0x3c6fc0) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uCell;
        uniform float uFade;
        uniform vec3 uMinorColor;
        uniform vec3 uMajorColor;
        uniform vec3 uXColor;
        uniform vec3 uZColor;
        varying vec3 vWorld;

        // 1.0 on a grid line, 0.0 between lines, anti-aliased to ~1px.
        float gridLine(vec2 p, float size) {
          vec2 c = p / size;
          vec2 d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
          return 1.0 - min(min(d.x, d.y), 1.0);
        }

        void main() {
          vec2 p = vWorld.xz;
          float minor = gridLine(p, uCell);
          float major = gridLine(p, uCell * 10.0);

          // Coloured world axes: X axis (z = 0) red, Z axis (x = 0) blue.
          vec2 fw = fwidth(p);
          float xAxis = 1.0 - min(abs(p.y) / (fw.y * 1.5), 1.0);
          float zAxis = 1.0 - min(abs(p.x) / (fw.x * 1.5), 1.0);

          vec3 color = mix(uMinorColor, uMajorColor, major);
          float alpha = max(minor * 0.6, major);
          color = mix(color, uXColor, xAxis);
          color = mix(color, uZColor, zAxis);
          alpha = max(alpha, max(xAxis, zAxis));

          // Radial fade so the quad's edge is never visible.
          alpha *= 1.0 - smoothstep(uFade * 0.35, uFade, length(p));
          if (alpha < 0.005) discard;

          gl_FragColor = vec4(color, alpha);
          #include <colorspace_fragment>
        }
      `,
    });

    super(geometry, material);
    this.name = '__grid';
    this.frustumCulled = false;
    this.renderOrder = -1; // draw before the (transparent parts of the) model
  }

  /**
   * Scale the grid to the model: the minor cell is a "nice" power of ten so
   * one cell reads as 1, 10, 100… file units.
   */
  fitTo(size) {
    const s = Math.max(size, 1e-6);
    const cell = Math.pow(10, Math.floor(Math.log10(s)) - 1);
    const fade = s * 6;
    this.material.uniforms.uCell.value = cell;
    this.material.uniforms.uFade.value = fade;
    this.scale.setScalar(fade);
    return cell;
  }

  setTheme(dark) {
    const u = this.material.uniforms;
    u.uMinorColor.value.set(dark ? 0x3a3c42 : 0xc4c7cd);
    u.uMajorColor.value.set(dark ? 0x5a5d65 : 0x9ea2a9);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * XYZ axes gizmo in the bottom-right corner. three's ViewHelper already
 * draws a labelled gizmo into a small viewport and is clickable (click an
 * axis to snap the camera to that view), so we just wrap it.
 */
export function createAxesGizmo(camera, domElement) {
  const gizmo = new ViewHelper(camera, domElement);
  gizmo.location.right = 8;
  gizmo.location.bottom = 8;
  return gizmo;
}

/** FPS/ms counter (three's stats.js), hidden by default. */
export function createStats(parent) {
  const stats = new Stats();
  stats.dom.style.cssText = 'position:fixed;bottom:10px;left:300px;z-index:10;';
  stats.dom.hidden = true;
  parent.appendChild(stats.dom);
  return stats;
}

/** Axis-aligned bounding box helper; the viewer copies the model box into `.box`. */
export class BoundsHelper extends THREE.Box3Helper {
  constructor(color = 0xf5b942) {
    super(new THREE.Box3(), color);
    this.name = '__bounds';
    this.material.depthTest = false;
    this.material.transparent = true;
    this.material.opacity = 0.9;
    this.renderOrder = 999;
  }

}
