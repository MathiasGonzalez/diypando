import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MM = 0.001;

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0b0a);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
  camera.position.set(2.2, 1.6, 3.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0.5, 1, 0);

  scene.add(new THREE.AmbientLight(0x9aa8b5, 0.9));
  const key = new THREE.DirectionalLight(0xfff1dd, 1.35);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88a0c0, 0.35);
  fill.position.set(-3, 1, -2);
  scene.add(fill);

  const grid = new THREE.GridHelper(6, 30, 0x3a3128, 0x2a241d);
  scene.add(grid);

  const group = new THREE.Group();
  scene.add(group);

  const steel = new THREE.MeshStandardMaterial({
    color: 0x8d97a3,
    metalness: 0.82,
    roughness: 0.32,
  });
  const rust = new THREE.MeshStandardMaterial({
    color: 0xd4652f,
    metalness: 0.4,
    roughness: 0.5,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x4a433c,
    metalness: 0.6,
    roughness: 0.45,
  });

  function materialFor(part) {
    if (part.role === "herraje" || part.role === "guia") return rust;
    if (part.role === "barrote") return steel;
    return dark;
  }

  function addPart(part) {
    const a = new THREE.Vector3(part.from[0] * MM, part.from[1] * MM, part.from[2] * MM);
    const b = new THREE.Vector3(part.to[0] * MM, part.to[1] * MM, part.to[2] * MM);

    if (part.kind === "hinge") {
      const geo = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 12);
      const mesh = new THREE.Mesh(geo, rust);
      mesh.position.copy(a);
      mesh.rotation.z = Math.PI / 2;
      group.add(mesh);
      return;
    }
    if (part.kind === "wheel") {
      const geo = new THREE.TorusGeometry(0.04, 0.012, 10, 18);
      const mesh = new THREE.Mesh(geo, rust);
      mesh.position.copy(a);
      mesh.rotation.x = Math.PI / 2;
      group.add(mesh);
      return;
    }

    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();
    if (length < 0.0005) return;
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const yAxis = new THREE.Vector3(0, 1, 0);
    let geo;
    if (part.kind === "round") {
      const r = (part.profile.w * MM) / 2;
      geo = new THREE.CylinderGeometry(r, r, length, 14);
    } else {
      geo = new THREE.BoxGeometry(part.profile.w * MM, length, part.profile.d * MM);
    }
    const mesh = new THREE.Mesh(geo, materialFor(part));
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(yAxis, dir.clone().normalize());
    group.add(mesh);
  }

  function frame() {
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    grid.position.y = box.min.y;
    controls.target.copy(center);
    const span = Math.max(size.x, size.y, size.z, 0.8);
    camera.position.set(center.x + span * 0.9, center.y + span * 0.45, center.z + span * 1.15);
    camera.near = span / 50;
    camera.far = span * 20;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function setParts(parts) {
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      child.geometry?.dispose?.();
    }
    for (const part of parts) addPart(part);
    frame();
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function tick() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  tick();

  return { setParts, resize };
}
