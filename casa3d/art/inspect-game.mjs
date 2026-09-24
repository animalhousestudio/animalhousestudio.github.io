import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Raycaster,Vector3} from 'three';
const b=readFileSync(new URL('../src/assets/models/mansion-v04.glb',import.meta.url));
const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');scene.updateMatrixWorld(true);
const ray=new Raycaster(new Vector3(.5,35,2.4),new Vector3(0,-1,0));
console.log(ray.intersectObject(scene,true).map(h=>[h.object.name,h.point.y.toFixed(2)]));
console.log('glass', [...new Set((()=>{const a=[];scene.traverse(o=>{if(o.isMesh&&/glass/i.test(o.name))a.push(o.material.name)});return a;})())]);
