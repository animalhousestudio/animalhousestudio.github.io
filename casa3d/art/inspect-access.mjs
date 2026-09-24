import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3} from 'three';
const b=readFileSync(new URL('../src/assets/models/mansion-v04.glb',import.meta.url));
const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');scene.updateMatrixWorld(true);
const rows=[];scene.traverse(o=>{if(o.isMesh&&/Conservatory.*(Plinth|Floor|Back|Side)|AVIARY_Left.*(Floor|Door)|Tower.*(Floor|Portal)|WestPassage|Bridge.*(Deck|Floor|Socket)|Passage|GrandBalcony.*(Deck|Slab)/i.test(o.name)){const b=new Box3().setFromObject(o);rows.push({n:o.name,min:b.min.toArray().map(x=>+x.toFixed(3)),max:b.max.toArray().map(x=>+x.toFixed(3))});}});console.log(JSON.stringify(rows));
