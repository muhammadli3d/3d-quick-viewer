import * as THREE from 'three';

const _v = new THREE.Vector3();
const _box = new THREE.Box3();

// Above this many vertices, use the (slightly conservative) transformed
// geometry bounding box instead of visiting every vertex.
const PRECISE_VERTEX_LIMIT = 2_000_000;

/**
 * World-space bounding box of the *visible* geometry under `root`.
 *
 * Box3.setFromObject() includes hidden objects (e.g. G-code travel moves,
 * hidden glTF nodes), which makes framing and dimensions wrong, so we walk
 * the tree ourselves with traverseVisible().
 */
export function computeVisibleBounds(root, target = new THREE.Box3()) {
  target.makeEmpty();
  root.updateWorldMatrix(true, true);

  root.traverseVisible((obj) => {
    const position = obj.geometry?.attributes?.position;
    if (!position) return;

    // Skinned/instanced meshes know how to bound their deformed/instanced shape.
    if (obj.isSkinnedMesh || obj.isInstancedMesh) {
      obj.computeBoundingBox();
      target.union(_box.copy(obj.boundingBox).applyMatrix4(obj.matrixWorld));
      return;
    }

    if (position.count > PRECISE_VERTEX_LIMIT) {
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      target.union(_box.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld));
      return;
    }

    // Exact: transform every vertex. (Transforming the local AABB instead would
    // overestimate for rotated parts, and dimensions matter for printing.)
    for (let i = 0; i < position.count; i++) {
      target.expandByPoint(_v.fromBufferAttribute(position, i).applyMatrix4(obj.matrixWorld));
    }
  });

  return target;
}
