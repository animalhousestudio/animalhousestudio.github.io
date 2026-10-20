import * as THREE from 'three';
import {createRedButton} from '../contact/buttonGeometry.mjs';

export const BOOTH_CONTROL_LABELS=Object.freeze(['MESSAGGIO','SALA INFORMAZIONI']);
export function prepareBoothGlass(model){
  model.traverse(node=>{
    if(!node.isMesh)return;
    for(const material of (Array.isArray(node.material)?node.material:[node.material])){
      if(!/GlassPlaceholder/.test(material.name))continue;
      material.color.setHex(0xc2e1e2);material.transparent=true;material.opacity=.10;
      material.depthWrite=false;material.roughness=.08;material.metalness=.02;
      material.side=THREE.DoubleSide;material.forceSinglePass=true;
      if('transmission' in material)material.transmission=0;
      material.needsUpdate=true;node.castShadow=false;
    }
  });
}
function labelTexture(text){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#e9dfc6';ctx.fillRect(0,0,1024,128);
  ctx.strokeStyle='#a9976d';ctx.lineWidth=4;ctx.strokeRect(2,2,1020,124);
  ctx.fillStyle='#2b332d';ctx.font='500 46px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(text,512,67);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
export function addBoothControls(root,{createLabelTexture=labelTexture}={}){
  const controls=new THREE.Group();controls.name='ContactBoothControls';
  controls.userData.interactable=true;controls.userData.collisionDisabled=true;root.add(controls);
  const buttons=BOOTH_CONTROL_LABELS.map((label,index)=>{
    const x=index===0?-.35:.35;
    const button=createRedButton(controls,x,1.07,-.62);
    button.name=index===0?'BoothMessageButton':'BoothInformationButton';
    button.userData.boothAction=index===0?'message':'information';
    const plaque=new THREE.Mesh(new THREE.PlaneGeometry(.59,.074),
      new THREE.MeshBasicMaterial({map:createLabelTexture(label)}));
    plaque.position.set(x,.85,-.571);plaque.name=label;controls.add(plaque);
    return button;
  });
  // A small fixture illuminates the actual controls while preserving exterior views.
  const light=new THREE.PointLight(0xffdfab,.7,5,2);light.position.set(0,1.65,.05);controls.add(light);
  return {root:controls,buttons};
}
