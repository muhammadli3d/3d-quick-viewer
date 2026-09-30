/**
 * Free the GPU memory held by an object tree. three.js never garbage-collects
 * GPU resources on its own: geometries, materials and textures stay uploaded
 * until you call .dispose() on each one, so loading model after model without
 * this would leak VRAM.
 */
export function disposeObject(root) {
  const materials = new Set();
  const textures = new Set();

  root.traverse((obj) => {
    obj.geometry?.dispose();

    // Materials swapped out by view modes are stashed in userData; free those too.
    for (const m of toArray(obj.material)) materials.add(m);
    for (const m of toArray(obj.userData?.originalMaterial)) materials.add(m);

    if (obj.skeleton) obj.skeleton.dispose();
  });

  for (const material of materials) {
    // Any property that holds a texture (map, normalMap, roughnessMap, …).
    for (const value of Object.values(material)) {
      if (value?.isTexture) textures.add(value);
    }
    // ShaderMaterials keep textures in uniforms.
    if (material.uniforms) {
      for (const { value } of Object.values(material.uniforms)) {
        if (value?.isTexture) textures.add(value);
      }
    }
    material.dispose();
  }

  for (const texture of textures) {
    texture.image?.close?.(); // ImageBitmap (used by GLTFLoader) holds decoded pixels
    texture.dispose();
  }
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
