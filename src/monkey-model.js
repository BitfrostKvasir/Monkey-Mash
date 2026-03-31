import * as THREE from 'three';

/**
 * Builds a monkey mesh group.
 * @param {number} bodyColor  hex colour for fur
 * @param {string} hat        'none' | 'tophat' | 'party' | 'cowboy' | 'crown'
 * @returns {{ group, rightArm, leftArm, rightLeg, leftLeg }}
 */
export function buildMonkeyMesh(bodyColor = 0x7B3F00, hat = 'none') {
  const group = new THREE.Group();
  const mat   = (c) => new THREE.MeshLambertMaterial({ color: c });
  const bodyM = mat(bodyColor);
  const cream = mat(0xF5DEB3);
  const white = mat(0xF5F5F5);
  const black = mat(0x151515);

  const add = (geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Body
  add(new THREE.SphereGeometry(0.36, 12, 10), bodyM, 0, 0.56, 0, 1, 1.25, 0.95);

  // Head
  add(new THREE.SphereGeometry(0.44, 14, 12), bodyM, 0, 1.32, 0);

  // Face mask
  add(new THREE.SphereGeometry(0.34, 12, 10), white, 0, 1.28, 0.36, 0.88, 0.72, 0.28);

  // Eyes
  [-0.14, 0.14].forEach(x => {
    add(new THREE.SphereGeometry(0.115, 10, 8), white, x, 1.38, 0.48, 1, 1, 0.45);
    add(new THREE.SphereGeometry(0.072, 8,  6), black, x, 1.38, 0.51);
    add(new THREE.SphereGeometry(0.026, 6,  4), white, x + 0.03, 1.41, 0.545);
  });

  // Nose
  add(new THREE.SphereGeometry(0.055, 7, 5), black, 0, 1.22, 0.52);

  // Ears
  [-0.44, 0.44].forEach(x => {
    add(new THREE.SphereGeometry(0.155, 8, 6), bodyM, x, 1.36, 0);
    add(new THREE.SphereGeometry(0.085, 7, 5), cream, x, 1.36, 0.08);
  });

  // Arm groups — pivot at shoulder
  const makeArmGroup = (dir) => {
    const g = new THREE.Group();
    g.position.set(dir * 0.42, 0.85, 0);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.55, 8), bodyM);
    cyl.rotation.z = Math.PI / 2;
    cyl.position.set(dir * 0.275, 0, 0);
    cyl.castShadow = true;
    g.add(cyl);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), cream);
    hand.position.set(dir * 0.55, 0, 0);
    hand.castShadow = true;
    g.add(hand);
    group.add(g);
    return g;
  };
  const rightArm = makeArmGroup(1);
  const leftArm  = makeArmGroup(-1);

  // Leg groups — pivot at hip
  const makeLegGroup = (dir) => {
    const g = new THREE.Group();
    g.position.set(dir * 0.17, 0.37, 0);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.32, 8), bodyM);
    cyl.position.set(0, -0.16, 0);
    cyl.castShadow = true;
    g.add(cyl);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), black);
    foot.scale.set(1, 0.75, 1.35);
    foot.position.set(0, -0.32, 0.07);
    foot.castShadow = true;
    g.add(foot);
    group.add(g);
    return g;
  };
  const rightLeg = makeLegGroup(1);
  const leftLeg  = makeLegGroup(-1);

  addHat(group, hat);

  return { group, rightArm, leftArm, rightLeg, leftLeg };
}

export function addHat(group, hat) {
  if (hat === 'none') return;
  const hatGroup = new THREE.Group();
  hatGroup.position.y = 1.82;

  if (hat === 'tophat') {
    const brimMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16), brimMat);
    hatGroup.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.48, 16), brimMat);
    crown.position.y = 0.26;
    hatGroup.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 16),
      new THREE.MeshLambertMaterial({ color: 0xcc0000 }));
    band.position.y = 0.05;
    hatGroup.add(band);

  } else if (hat === 'party') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 12),
      new THREE.MeshLambertMaterial({ color: 0xff44cc }));
    cone.position.y = 0.3;
    hatGroup.add(cone);
    [0, 1, 2, 3].forEach(i => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0xffff00 }));
      const a = (i / 4) * Math.PI * 2;
      dot.position.set(Math.cos(a) * 0.14, 0.22, Math.sin(a) * 0.14);
      hatGroup.add(dot);
    });
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    pom.position.y = 0.62;
    hatGroup.add(pom);

  } else if (hat === 'cowboy') {
    const brimMat = new THREE.MeshLambertMaterial({ color: 0x8B5E3C });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.04, 16), brimMat);
    hatGroup.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.35, 16), brimMat);
    crown.position.y = 0.18;
    hatGroup.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.06, 16),
      new THREE.MeshLambertMaterial({ color: 0x333333 }));
    band.position.y = 0.05;
    hatGroup.add(band);

  } else if (hat === 'crown') {
    const crownMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.2, 16), crownMat);
    hatGroup.add(base);
    [0, 1, 2, 3, 4].forEach(i => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 6), crownMat);
      const a = (i / 5) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.24, 0.22, Math.sin(a) * 0.24);
      hatGroup.add(spike);
    });
    const gemColors = [0xff2222, 0x2222ff, 0x22ff22];
    [0, 1, 2].forEach(i => {
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshLambertMaterial({ color: gemColors[i] }));
      const a = (i / 3) * Math.PI * 2;
      gem.position.set(Math.cos(a) * 0.24, 0.1, Math.sin(a) * 0.24);
      hatGroup.add(gem);
    });
  }

  group.add(hatGroup);
}
