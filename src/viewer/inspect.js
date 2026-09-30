/**
 * Count what's in a model: meshes, triangles, vertices, materials…
 * Helper objects (names starting with "__", like the wireframe overlays)
 * are skipped so the numbers describe the file, not the viewer.
 */
export function computeModelStats(root) {
  const stats = {
    meshes: 0,
    triangles: 0,
    vertices: 0,
    points: 0,
    lines: 0,
    materials: 0,
    textures: 0,
    animations: root.animations?.length ?? 0,
    animationNames: (root.animations ?? []).map((clip) => clip.name || 'unnamed'),
    skinned: false,
  };
  const materials = new Set();
  const textures = new Set();

  root.traverse((obj) => {
    if (obj.name.startsWith('__')) return;
    const geometry = obj.geometry;
    const position = geometry?.attributes?.position;
    if (!position) return;

    const instances = obj.isInstancedMesh ? obj.count : 1;
    const original = obj.userData.originalMaterial ?? obj.material; // ignore view-mode overrides
    for (const m of Array.isArray(original) ? original : [original]) {
      if (!m) continue;
      materials.add(m);
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
    }

    if (obj.isMesh) {
      stats.meshes++;
      stats.vertices += position.count * instances;
      const indices = geometry.index ? geometry.index.count : position.count;
      stats.triangles += (indices / 3) * instances;
      if (obj.isSkinnedMesh) stats.skinned = true;
    } else if (obj.isPoints) {
      stats.points += position.count;
    } else if (obj.isLine) {
      stats.lines++;
      stats.vertices += position.count;
    }
  });

  stats.materials = materials.size;
  stats.textures = textures.size;
  return stats;
}
