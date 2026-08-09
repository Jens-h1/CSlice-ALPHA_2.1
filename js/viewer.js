import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

const viewport = document.getElementById("viewport");
const status = document.getElementById("viewerStatus");
const modelInfo = document.getElementById("modelInfo");
const overlay = document.getElementById("dropOverlay");
const selectionBadge = document.getElementById("selectionBadge");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1120);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 20; controls.maxDistance = 3000;

const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls.getHelper());
transformControls.setMode("translate");
transformControls.addEventListener("dragging-changed", e => controls.enabled = !e.value);
transformControls.addEventListener("objectChange", () => { updateSelection(); window.csliceApp?.syncObjectList?.(); });

scene.add(new THREE.HemisphereLight(0xffffff,0x172033,2.1));
const key = new THREE.DirectionalLight(0xffffff,2.4); key.position.set(250,400,300); scene.add(key);
const fill = new THREE.DirectionalLight(0x8ab4ff,.8); fill.position.set(-300,250,-250); scene.add(fill);

const buildPlate = new THREE.Group(); scene.add(buildPlate);
const plate = new THREE.Mesh(new THREE.BoxGeometry(1,1,2),new THREE.MeshStandardMaterial({color:0x182235,roughness:.82,metalness:.08}));
plate.position.z=-1; buildPlate.add(plate);
const grid = new THREE.GridHelper(1,35,0x3b82f6,0x334155); grid.rotation.x=Math.PI/2; grid.position.z=.15; buildPlate.add(grid);
const borderGeometry = new THREE.BufferGeometry();
const border = new THREE.Line(borderGeometry,new THREE.LineBasicMaterial({color:0x60a5fa})); buildPlate.add(border);
const axes = new THREE.AxesHelper(55); scene.add(axes);

let buildWidth=350, buildDepth=350, buildHeight=350;
const objects = new Map();
let selectedId = null;
let nextId = 1;
const loader = new STLLoader();

function setBuildPlate(width,depth,height=350){
  buildWidth=Number(width)||350; buildDepth=Number(depth)||350; buildHeight=Number(height)||350;
  plate.scale.set(buildWidth,buildDepth,1); grid.scale.set(buildWidth,buildDepth,1);
  const x=buildWidth/2,y=buildDepth/2;
  borderGeometry.setFromPoints([new THREE.Vector3(-x,-y,.3),new THREE.Vector3(x,-y,.3),new THREE.Vector3(x,y,.3),new THREE.Vector3(-x,y,.3),new THREE.Vector3(-x,-y,.3)]);
  axes.position.set(-x+25,-y+25,1); fitView(); checkAllObjects();
}

function resize(){const w=Math.max(viewport.clientWidth,1),h=Math.max(viewport.clientHeight,1);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);}
function setStatus(text){status.textContent=text;}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function boundsFor(object){return new THREE.Box3().setFromObject(object);}
function sizeFor(object){return boundsFor(object).getSize(new THREE.Vector3());}
function placementFor(object){const b=boundsFor(object);return {x:b.min.x,y:b.min.y,z:b.min.z};}
function fits(object){const b=boundsFor(object);const eps=.01;return b.min.x>=-buildWidth/2-eps&&b.max.x<=buildWidth/2+eps&&b.min.y>=-buildDepth/2-eps&&b.max.y<=buildDepth/2+eps&&b.min.z>=-eps&&b.max.z<=buildHeight+eps;}

function makeMaterial(selected=false){return new THREE.MeshStandardMaterial({color:selected?0x60a5fa:0x4f8fe8,roughness:.58,metalness:.08});}
function recolor(object,selected){object.traverse(o=>{if(o.isMesh)o.material.color.set(selected?0x60a5fa:0x4f8fe8);});}

function addSTL(arrayBuffer,fileName="model.stl",savedState=null){
  try{
    const geometry=loader.parse(arrayBuffer); geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,makeMaterial(false));
    const id=savedState?.id||`object-${nextId++}`; nextId=Math.max(nextId,Number(String(id).replace(/\D/g,""))||0)+1;
    mesh.userData.cslice={id,name:fileName};
    geometry.computeBoundingBox();
    const box=new THREE.Box3().setFromObject(mesh); const center=box.getCenter(new THREE.Vector3());
    mesh.position.x-=center.x; mesh.position.y-=center.y; mesh.position.z-=box.min.z;
    mesh.position.z+=.8;
    if(savedState){mesh.position.fromArray(savedState.position||[0,0,.8]);mesh.rotation.fromArray(savedState.rotation||[0,0,0,"XYZ"]);mesh.scale.fromArray(savedState.scale||[1,1,1]);}
    scene.add(mesh); objects.set(id,mesh); selectObject(id); overlay.classList.add("hidden");
    setStatus(`${fileName} loaded`); checkAllObjects(); window.csliceApp?.syncObjectList?.(); fitView(); return id;
  }catch(error){console.error(error);setStatus("Could not load that STL file");return null;}
}

function removeObject(id=selectedId){const object=objects.get(id);if(!object)return;transformControls.detach();scene.remove(object);object.traverse(o=>{o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});objects.delete(id);selectedId=null;const next=objects.keys().next().value;if(next)selectObject(next);else{selectionBadge.textContent="";modelInfo.innerHTML="<span>No model loaded</span>";setStatus("No objects loaded");overlay.classList.remove("hidden");}window.csliceApp?.syncObjectList?.();}

function duplicateObject(id=selectedId){const source=objects.get(id);if(!source)return null;const clone=source.clone();clone.geometry=source.geometry.clone();clone.material=makeMaterial(false);const newId=`object-${nextId++}`;clone.userData.cslice={id:newId,name:`${source.userData.cslice.name.replace(/\.stl$/i,"")} copy.stl`};clone.position.x+=10;clone.position.y+=10;scene.add(clone);objects.set(newId,clone);selectObject(newId);setStatus("Object duplicated");window.csliceApp?.syncObjectList?.();return newId;}

function selectObject(id){if(!objects.has(id))return; if(selectedId&&objects.has(selectedId))recolor(objects.get(selectedId),false);selectedId=id;const object=objects.get(id);recolor(object,true);transformControls.attach(object);updateSelection();window.csliceApp?.syncObjectList?.();}
function updateSelection(){if(!selectedId)return;const object=objects.get(selectedId);if(!object)return;const size=sizeFor(object);const p=placementFor(object);const ok=fits(object);selectionBadge.textContent=`${object.userData.cslice.name} • ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`;modelInfo.innerHTML=`<span><strong>${escapeHtml(object.userData.cslice.name)}</strong></span><span>${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm</span><span>${ok?"✓ Fits build volume":"⚠ Outside build volume"}</span><span>Position ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} mm</span>`;}
function checkAllObjects(){objects.forEach((object,id)=>{object.userData.cslice.fits=fits(object);if(id===selectedId)updateSelection();});}
function fitView(){const size=Math.max(buildWidth,buildDepth,buildHeight);camera.position.set(size*.85,size*.85,size);controls.target.set(0,0,0);controls.update();}
function fitSelected(){if(!selectedId){fitView();return;}const object=objects.get(selectedId);if(!object){fitView();return;}const b=boundsFor(object),c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3()),d=Math.max(s.x,s.y,s.z)*2.2;camera.position.set(c.x+d,c.y+d*.8,c.z+d);controls.target.copy(c);controls.update();}
function resetView(){camera.position.set(Math.max(buildWidth,buildDepth)*.85,Math.max(buildWidth,buildDepth)*.85,Math.max(buildWidth,buildDepth));controls.target.set(0,0,0);controls.update();}
function setTransformMode(mode){if(!selectedId){setStatus("Select an object first");return;}transformControls.setMode(mode);}

renderer.domElement.addEventListener("pointerdown",e=>{if(e.button!==0)return;const rect=renderer.domElement.getBoundingClientRect();const mouse=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);const hits=ray.intersectObjects([...objects.values()],true);if(hits.length){let o=hits[0].object;while(o.parent&&!o.userData.cslice)o=o.parent;if(o.userData.cslice)selectObject(o.userData.cslice.id);}});

window.csliceViewer={loadSTL:addSTL,setBuildPlate,fitModel:fitSelected,fitView,resetView,setTransformMode,selectObject,removeObject,duplicateObject,getSelectedId:()=>selectedId,getObjects:()=>[...objects.entries()].map(([id,o])=>({id,name:o.userData.cslice.name,position:o.position.toArray(),rotation:o.rotation.toArray(),scale:o.scale.toArray(),fits:fits(o),size:sizeFor(o).toArray()})),serializeObjects:()=>[...objects.entries()].map(([id,o])=>({id,name:o.userData.cslice.name,position:o.position.toArray(),rotation:o.rotation.toArray(),scale:o.scale.toArray()}))};

window.addEventListener("resize",resize); resize(); setBuildPlate(350,350,350);
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
