import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

const viewport = document.getElementById("viewport");
const status = document.getElementById("viewerStatus");
const modelInfo = document.getElementById("modelInfo");
const overlay = document.getElementById("dropOverlay");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1120);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
camera.position.set(300, 280, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);
controls.minDistance = 30;
controls.maxDistance = 1800;

const ambient = new THREE.HemisphereLight(0xffffff, 0x172033, 2.2);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(250, 500, 200);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8ab4ff, 0.9);
fillLight.position.set(-300, 200, -250);
scene.add(fillLight);

const buildPlate = new THREE.Group();
scene.add(buildPlate);

const plateSize = 350;
const plate = new THREE.Mesh(
  new THREE.BoxGeometry(plateSize, 2, plateSize),
  new THREE.MeshStandardMaterial({ color: 0x182235, roughness: 0.82, metalness: 0.08 })
);
plate.position.y = -1;
buildPlate.add(plate);

const grid = new THREE.GridHelper(plateSize, 35, 0x3b82f6, 0x334155);
grid.position.y = 0.15;
buildPlate.add(grid);

const borderPoints = [
  new THREE.Vector3(-175, 0.3, -175),
  new THREE.Vector3(175, 0.3, -175),
  new THREE.Vector3(175, 0.3, 175),
  new THREE.Vector3(-175, 0.3, 175),
  new THREE.Vector3(-175, 0.3, -175)
];
const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
const border = new THREE.Line(borderGeometry, new THREE.LineBasicMaterial({ color: 0x60a5fa }));
buildPlate.add(border);

const axes = new THREE.AxesHelper(55);
axes.position.set(-150, 1, 150);
scene.add(axes);

let currentModel = null;
let currentModelSize = null;
const loader = new STLLoader();

function resize() {
  const width = Math.max(viewport.clientWidth, 1);
  const height = Math.max(viewport.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function setStatus(text) {
  status.textContent = text;
}

function updateInfo(name, size) {
  modelInfo.innerHTML = `
    <span><strong>${escapeHtml(name)}</strong></span>
    <span>${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm</span>
    <span>Centered on build plate</span>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
}

function fitModel() {
  if (!currentModel || !currentModelSize) {
    camera.position.set(300, 280, 300);
    controls.target.set(0, 0, 0);
    controls.update();
    return;
  }

  const maxSize = Math.max(currentModelSize.x, currentModelSize.y, currentModelSize.z);
  const distance = Math.max(maxSize * 2.0, 260);
  camera.position.set(distance, distance * 0.85, distance);
  controls.target.set(0, currentModelSize.y * 0.25, 0);
  controls.update();
}

function removeCurrentModel() {
  if (!currentModel) return;
  scene.remove(currentModel);
  currentModel.traverse(object => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else object.material.dispose();
    }
  });
  currentModel = null;
  currentModelSize = null;
}

export function loadSTL(arrayBuffer, fileName = "model.stl") {
  try {
    const geometry = loader.parse(arrayBuffer);
    geometry.computeVertexNormals();
    geometry.center();

    const boxBeforePlacement = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute("position"));
    const size = boxBeforePlacement.getSize(new THREE.Vector3());

    if (size.x > plateSize || size.z > plateSize) {
      setStatus("Model is larger than the 350 × 350 mm build plate");
    } else {
      setStatus(`${fileName} loaded successfully`);
    }

    removeCurrentModel();

    const material = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      roughness: 0.58,
      metalness: 0.08
    });

    currentModel = new THREE.Mesh(geometry, material);

    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    currentModel.position.x -= center.x;
    currentModel.position.z -= center.z;
    currentModel.position.y -= box.min.y;
    currentModel.position.y += 0.8;

    scene.add(currentModel);
    currentModelSize = size;
    updateInfo(fileName, size);
    overlay.classList.add("hidden");
    fitModel();
  } catch (error) {
    console.error(error);
    setStatus("Could not load that STL file");
  }
}

window.csliceViewer = {
  loadSTL,
  fitModel,
  resetView: () => {
    camera.position.set(300, 280, 300);
    controls.target.set(0, 0, 0);
    controls.update();
  }
};

window.addEventListener("resize", resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
