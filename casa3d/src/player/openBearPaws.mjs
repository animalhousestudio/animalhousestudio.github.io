import { ConeGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { batchStaticArchitecture } from '../rooms/optimize.mjs';

// Canonical paw: fingers +Y, pads +Z. On the ride +Z points straight down.
export function createOpenBearPaw() {
  const root=new Group();root.name='OpenBearPaw';root.userData.palmNormal=[0,0,1];
  const fur=new MeshStandardMaterial({color:0x17191b,roughness:1});
  const pad=new MeshStandardMaterial({color:0x545052,roughness:1});
  const horn=new MeshStandardMaterial({color:0x8a7b66,roughness:.78});
  const sphere=new SphereGeometry(1,16,10);sphere.clearGroups();
  function oval(name,x,y,z,sx,sy,sz,material){
    const mesh=new Mesh(sphere,material);mesh.name=name;mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);root.add(mesh);
  }
  oval('Broad_Palm',0,.115,0,.137,.17,.073,fur);
  oval('Furry_Wrist',0,-.025,-.004,.09,.10,.07,fur);
  oval('Central_Pad',0,.12,.068,.097,.103,.016,pad);
  oval('Wrist_Pad',0,-.007,.064,.055,.035,.014,pad);
  const clawGeometry=new ConeGeometry(.013,.095,8);clawGeometry.clearGroups();
  for(let i=0;i<5;i++){
    const x=(i-2)*.055,y=.25+.04*(1-Math.abs(i-2)/2);
    oval('Toe_'+i,x,y,0,.042,.066,.054,fur);
    oval('Toe_Pad_'+i,x,y+.005,.05,.029,.038,.012,pad);
    const claw=new Mesh(clawGeometry,horn);claw.name='Claw_'+i;
    claw.position.set(x,y+.10,.005);claw.rotation.x=.2;root.add(claw);
  }
  const tuftGeometry=new ConeGeometry(.007,.025,4);tuftGeometry.clearGroups();
  const tufts=new InstancedMesh(tuftGeometry,fur,64),matrix=new Matrix4();tufts.name='Short_Fur';
  for(let i=0;i<64;i++){
    const a=i/64*Math.PI*2;
    matrix.makeRotationZ(-a).setPosition(Math.sin(a)*.13,.115+Math.cos(a)*.15,-.018);
    tufts.setMatrixAt(i,matrix);
  }
  tufts.computeBoundingSphere();root.add(tufts);return root;
}

// The authored grip paws share three skinned meshes. Partition their triangles
// by skeleton side so one held hand can keep its exact grip independently.
export function attachOpenBearPaws(model) {
  const source=model.getObjectByName('Hands_Bear_Paws'),grips={L:[],R:[]},open={};
  const meshes=[];source?.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node);});
  for(const mesh of meshes){
    const geometry=mesh.geometry,a=geometry.attributes,index=geometry.index,sides={L:[],R:[]};
    const count=index?.count??a.position.count;
    for(let i=0;i<count;i+=3){
      const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);let weight=0;
      for(const id of ids)for(let k=0;k<4;k++){
        const name=mesh.skeleton.bones[a.skinIndex.getComponent(id,k)].name;
        weight+=a.skinWeight.getComponent(id,k)*(name.endsWith('L')?1:name.endsWith('R')?-1:0);
      }
      if(!weight)weight=ids.reduce((sum,id)=>sum+a.position.getX(id),0);
      sides[weight>=0?'L':'R'].push(...ids);
    }
    mesh.visible=false;
    for(const side of ['L','R']){
      const copy=mesh.clone(false);copy.name=mesh.name+'_Grip_'+side;copy.geometry=geometry.clone();
      copy.geometry.setIndex(sides[side]);copy.geometry.clearGroups();copy.visible=false;
      mesh.parent.add(copy);grips[side].push(copy);
    }
  }
  for(const side of ['L','R']){
    const paw=createOpenBearPaw();paw.name='OpenBearPaw_'+side;
    batchStaticArchitecture(paw,Infinity);model.getObjectByName('hand'+side)?.add(paw);open[side]=paw;
  }
  return {
    open,grips,
    update({leftHeld=false,rightHeld=false,riding=false}={}){
      for(const [side,held]of [['L',leftHeld],['R',rightHeld]]){
        open[side].visible=riding||!held;
        for(const mesh of grips[side])mesh.visible=!riding&&held;
      }
    },
  };
}
