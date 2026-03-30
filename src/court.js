import * as THREE from 'three';

export const COURT = {
  width: 18,   // X axis (side to side)
  depth: 18,   // Z axis (front to back, split by net)
  netHeight: 2.43,
  netThickness: 0.05,
};

export function buildCourt(scene) {
  // Floor
  const floorGeo = new THREE.PlaneGeometry(COURT.width, COURT.depth);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Court lines
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  const addLine = (w, d, x, z) => {
    const geo = new THREE.BoxGeometry(w, 0.01, d);
    const mesh = new THREE.Mesh(geo, lineMat);
    mesh.position.set(x, 0.005, z);
    scene.add(mesh);
  };

  const hw = COURT.width / 2;
  const hd = COURT.depth / 2;
  const lw = 0.05;

  // Boundary lines
  addLine(COURT.width, lw, 0, -hd);
  addLine(COURT.width, lw, 0,  hd);
  addLine(lw, COURT.depth, -hw, 0);
  addLine(lw, COURT.depth,  hw, 0);
  // Center line (under net)
  addLine(COURT.width, lw, 0, 0);

  // Net posts
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, COURT.netHeight + 0.3);
  const postMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });

  [-hw - 0.1, hw + 0.1].forEach(x => {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, (COURT.netHeight + 0.3) / 2, 0);
    post.castShadow = true;
    scene.add(post);
  });

  // Net
  const netGeo = new THREE.BoxGeometry(COURT.width + 0.2, COURT.netHeight, COURT.netThickness);
  const netMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    wireframe: true,
  });
  const net = new THREE.Mesh(netGeo, netMat);
  net.position.set(0, COURT.netHeight / 2, 0);
  scene.add(net);

  // Net solid top band
  const bandGeo = new THREE.BoxGeometry(COURT.width + 0.2, 0.08, COURT.netThickness * 2);
  const bandMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.set(0, COURT.netHeight, 0);
  scene.add(band);
}
