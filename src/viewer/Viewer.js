import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { InfiniteGrid, BoundsHelper, createAxesGizmo, createStats } from './helpers.js';
import { disposeObject } from '../utils/dispose.js';

const DEFAULT_VIEW_DIR = new THREE.Vector3(1, 0.75, 1.2).normalize();

/**
 * Owns everything WebGL: renderer, scene, cameras, controls, lights, helpers
 * and the currently loaded model. UI code talks to it through methods and
 * listens to the events it dispatches ('model', 'animation').
 *
 * Scene layout:
 *   scene
 *   ├─ grid, bounds, light            (helpers, names start with "__")
 *   └─ pivot      position: offsets the model so it is centred and sits on the grid
 *      └─ upGroup  rotation: converts Z-up files to three's Y-up
 *         └─ model (whatever the loader returned, untouched)
 */
export class Viewer extends EventTarget {
  constructor(container) {
    super();
    this.container = container;

    // --- Renderer -------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping; // keeps base colours honest for inspection
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // We clear manually: the axes gizmo is drawn with a second render() call,
    // and with autoClear on that call would wipe the whole canvas.
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    // --- Scene + image-based lighting ------------------------------------
    const scene = new THREE.Scene();
    // Background is a plain clear colour (not scene.background) so screenshots
    // can simply switch the clear alpha to 0 for transparency.
    this.backgroundColor = new THREE.Color(0x1e1f22);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene = scene;

    // One directional "key" light. It follows the camera (see _updateLight)
    // so the side you're looking at is always lit.
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.keyLight.name = '__keyLight';
    scene.add(this.keyLight, this.keyLight.target);

    // --- Cameras + controls ---------------------------------------------
    this.perspCamera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
    this.camera = this.perspCamera;
    this.camera.position.copy(DEFAULT_VIEW_DIR).multiplyScalar(5);
    this._orthoHalfHeight = 1;

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;

    // --- Helpers --------------------------------------------------------
    this.grid = new InfiniteGrid();
    this.grid.fitTo(10);
    scene.add(this.grid);

    this.bounds = new BoundsHelper();
    this.bounds.visible = false;
    scene.add(this.bounds);
    this.showBounds = false;

    this.gizmo = createAxesGizmo(this.camera, renderer.domElement);
    this.showAxes = true;
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (this.showAxes) this.gizmo.handleClick(e);
    });

    this.stats = createStats(document.body);

    // --- Model hierarchy ------------------------------------------------
    this.pivot = new THREE.Group();
    this.pivot.name = '__pivot';
    this.upGroup = new THREE.Group();
    this.upGroup.name = '__up';
    this.pivot.add(this.upGroup);
    scene.add(this.pivot);

    this.model = null;
    this.upAxis = 'y';
    this.modelBox = new THREE.Box3();
    this.modelSize = new THREE.Vector3();
    this._radius = 1;

    // --- Animation ------------------------------------------------------
    this.timer = new THREE.Timer();
    this.timer.connect(document); // pauses the delta while the tab is hidden
    this.mixer = null;
    this.clips = [];
    this.activeAction = null;

    // --- Resize + loop --------------------------------------------------
    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(container);
    this.resize();
    // Empty scene: show a ~10 unit patch of grid until a model arrives.
    this._radius = 6;
    this.frame({ box: new THREE.Box3(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, 2, 4)), resetDirection: true });
    renderer.setAnimationLoop((time) => this._tick(time));
  }

  // =====================================================================
  // Model management
  // =====================================================================

  /**
   * Replace the current model. The old one is disposed (GPU memory freed).
   * @param {THREE.Object3D} object
   * @param {{ upAxis?: 'y'|'z' }} options
   */
  setModel(object, { upAxis = 'y' } = {}) {
    this.clearModel();
    this.model = object;
    this.upGroup.add(object);

    this.clips = object.animations ?? [];
    if (this.clips.length) {
      this.mixer = new THREE.AnimationMixer(object);
      this.playClip(0);
    }

    this.setUpAxis(upAxis, { frame: false });
    this.frame({ resetDirection: true });
    this.dispatchEvent(new CustomEvent('model', { detail: { model: object } }));
  }

  clearModel() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.model);
    }
    this.mixer = null;
    this.clips = [];
    this.activeAction = null;

    if (this.model) {
      this.upGroup.remove(this.model);
      disposeObject(this.model);
      this.model = null;
    }
    this.modelBox.makeEmpty();
    this.bounds.visible = false;
  }

  /** 'y' = file is already Y-up; 'z' = rotate -90° about X so Z becomes up. */
  setUpAxis(axis, { frame = true } = {}) {
    this.upAxis = axis;
    this.upGroup.rotation.set(axis === 'z' ? -Math.PI / 2 : 0, 0, 0);
    this._placeOnGround();
    if (frame) this.frame();
  }

  /**
   * Centre the model on X/Z and rest its lowest point on the grid (y = 0),
   * like a part sitting on a print bed.
   */
  _placeOnGround() {
    this.pivot.position.set(0, 0, 0);
    this.pivot.updateMatrixWorld(true);
    if (!this.model) return;

    const box = new THREE.Box3().setFromObject(this.upGroup, true);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    this.pivot.position.set(-center.x, -box.min.y, -center.z);
    this.pivot.updateMatrixWorld(true);
    this.updateBounds();
  }

  /** Recompute the world-space bounding box (e.g. after an animation pose change). */
  updateBounds() {
    this.modelBox.setFromObject(this.pivot, true);
    this.modelBox.getSize(this.modelSize);
    this.bounds.fitTo(this.pivot);
    this.bounds.visible = this.showBounds && !this.modelBox.isEmpty();
    const maxDim = Math.max(this.modelSize.x, this.modelSize.y, this.modelSize.z);
    if (maxDim > 0) this.grid.fitTo(maxDim);
    return this.modelBox;
  }

  // =====================================================================
  // Camera
  // =====================================================================

  /**
   * Fit the camera to a box (defaults to the whole model), keeping the
   * current viewing direction unless `resetDirection` is set.
   */
  frame({ box = this.modelBox, resetDirection = false } = {}) {
    const target = new THREE.Vector3();
    let radius = 1;
    if (!box.isEmpty()) {
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      target.copy(sphere.center);
      radius = Math.max(sphere.radius, 1e-6);
    }
    if (box === this.modelBox) this._radius = radius;

    const dir = resetDirection
      ? DEFAULT_VIEW_DIR.clone()
      : this.camera.position.clone().sub(this.controls.target).normalize();
    if (!Number.isFinite(dir.lengthSq()) || dir.lengthSq() < 0.5) dir.copy(DEFAULT_VIEW_DIR);

    // Distance at which a sphere of `radius` fits both vertically and horizontally.
    const aspect = this._aspect();
    const vFov = THREE.MathUtils.degToRad(this.perspCamera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.05;

    this.controls.target.copy(target);
    this.perspCamera.position.copy(target).addScaledVector(dir, dist);
    this.perspCamera.lookAt(target);

    // Ortho: same framing, expressed as frustum half-height.
    this._orthoHalfHeight = (radius * 1.05) / Math.min(1, aspect);
    this.orthoCamera.zoom = 1;
    this.orthoCamera.position.copy(target).addScaledVector(dir, Math.max(dist, radius * 4));
    this.orthoCamera.lookAt(target);

    this._updateProjection();
    this.controls.update();
  }

  get isOrthographic() {
    return this.camera === this.orthoCamera;
  }

  /** Switch between perspective and orthographic, keeping the same view. */
  setOrthographic(ortho) {
    if (ortho === this.isOrthographic) return;
    const target = this.controls.target;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.perspCamera.fov) / 2);
    const dir = this.camera.position.clone().sub(target);
    const dist = dir.length();
    dir.normalize();

    if (ortho) {
      // Match the visible height at the target: persp shows 2·d·tan(fov/2).
      const visibleHeight = 2 * dist * tanHalf;
      this.orthoCamera.zoom = (2 * this._orthoHalfHeight) / visibleHeight;
      this.orthoCamera.position.copy(target).addScaledVector(dir, Math.max(dist, this._radius * 4));
      this.orthoCamera.quaternion.copy(this.camera.quaternion);
      this.camera = this.orthoCamera;
    } else {
      const visibleHeight = (2 * this._orthoHalfHeight) / this.orthoCamera.zoom;
      const d = visibleHeight / (2 * tanHalf);
      this.perspCamera.position.copy(target).addScaledVector(dir, d);
      this.perspCamera.quaternion.copy(this.camera.quaternion);
      this.camera = this.perspCamera;
    }
    this.controls.object = this.camera;
    this.gizmo.camera = this.camera;
    this._updateProjection();
    this.controls.update();
  }

  _aspect() {
    const { clientWidth: w, clientHeight: h } = this.container;
    return h > 0 ? w / h : 1;
  }

  _updateProjection() {
    const aspect = this._aspect();
    this.perspCamera.aspect = aspect;
    const h = this._orthoHalfHeight;
    Object.assign(this.orthoCamera, { left: -h * aspect, right: h * aspect, top: h, bottom: -h });
    this._updateClipping();
    this.perspCamera.updateProjectionMatrix();
    this.orthoCamera.updateProjectionMatrix();
  }

  /**
   * Near/far planes follow the camera distance so tiny parts (mm) and huge
   * scenes (km) both avoid clipping and z-fighting.
   */
  _updateClipping() {
    const r = this._radius;
    const gridReach = this.grid.material.uniforms.uFade.value;
    const d = this.camera.position.distanceTo(this.controls.target);
    if (this.isOrthographic) {
      this.orthoCamera.near = r * 0.01;
      this.orthoCamera.far = d + r * 4 + gridReach;
    } else {
      this.perspCamera.near = Math.max((d - r) * 0.5, d * 0.001, 1e-6);
      this.perspCamera.far = d + r * 4 + gridReach;
    }
    this.camera.updateProjectionMatrix();
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this._updateProjection();
  }

  // =====================================================================
  // Lights, helpers, background
  // =====================================================================

  setLightIntensity(v) {
    this.keyLight.intensity = v;
  }

  setEnvironmentIntensity(v) {
    this.scene.environmentIntensity = v;
  }

  setBackground(color) {
    this.backgroundColor.set(color);
  }

  setGridVisible(v) {
    this.grid.visible = v;
  }

  setAxesVisible(v) {
    this.showAxes = v;
  }

  setBoundsVisible(v) {
    this.showBounds = v;
    this.bounds.visible = v && !this.modelBox.isEmpty();
  }

  setStatsVisible(v) {
    this.stats.dom.hidden = !v;
  }

  setTheme(dark) {
    this.grid.setTheme(dark);
  }

  _updateLight() {
    // Key light sits above-right-behind the camera, pointing at the target.
    const d = this.camera.position.distanceTo(this.controls.target);
    const offset = new THREE.Vector3(0.6, 0.9, 1).applyQuaternion(this.camera.quaternion);
    this.keyLight.position.copy(this.controls.target).addScaledVector(offset, d);
    this.keyLight.target.position.copy(this.controls.target);
  }

  // =====================================================================
  // Animation
  // =====================================================================

  playClip(index) {
    if (!this.mixer || !this.clips[index]) return;
    const wasPaused = this.activeAction?.paused ?? false;
    this.activeAction?.stop();
    this.activeAction = this.mixer.clipAction(this.clips[index]);
    this.activeAction.paused = wasPaused;
    this.activeAction.play();
    this.dispatchEvent(new CustomEvent('animation'));
  }

  setAnimationPaused(paused) {
    if (!this.activeAction) return;
    this.activeAction.paused = paused;
    this.dispatchEvent(new CustomEvent('animation'));
  }

  get isAnimationPlaying() {
    return !!this.activeAction && !this.activeAction.paused;
  }

  // =====================================================================
  // Render loop
  // =====================================================================

  _tick(time) {
    this.timer.update(time);
    const delta = this.timer.getDelta();

    if (this.mixer) this.mixer.update(delta);

    this.controls.enabled = !this.gizmo.animating;
    if (this.gizmo.animating) {
      this.gizmo.center.copy(this.controls.target);
      this.gizmo.update(delta);
    }
    this.controls.update(delta);

    this._updateClipping();
    this._updateLight();
    this.render();
    this.stats.update();
  }

  render() {
    this.renderer.setClearColor(this.backgroundColor, 1);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.showAxes) this.gizmo.render(this.renderer);
  }
}
