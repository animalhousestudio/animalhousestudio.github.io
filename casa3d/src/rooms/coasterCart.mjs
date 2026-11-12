import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Three seats in one row. The middle eye remains at the existing route origin.
export function createCoasterCart() {
  const root=new Group();root.name='Coaster_Cart';root.userData.interactable=true;
  const blue=new MeshStandardMaterial({color:0x267f9e,metalness:.45,roughness:.25});
  const trim=new MeshStandardMaterial({color:0xc9a66d,metalness:.7,roughness:.28});
  const cream=new MeshStandardMaterial({color:0xf4e3bd,roughness:.45});
  const lamp=new MeshStandardMaterial({color:0xffe3a0,emissive:0xffb84e,emissiveIntensity:1.4,roughness:.3});
  const dark=new MeshStandardMaterial({color:0x182530,roughness:.65});
  const cushion=new MeshStandardMaterial({color:0x29353b,roughness:.95});
  const star=new MeshStandardMaterial({color:0xf5d792,emissive:0x342208});
  function box(parent,name,size,position,material,radius=.08){
    const geometry=radius?new RoundedBoxGeometry(...size,2,radius):new BoxGeometry(...size);
    const mesh=new Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);parent.add(mesh);return mesh;
  }
  function tube(parent,name,from,to,radius,material){
    const start=new Vector3(...from),end=new Vector3(...to),axis=end.clone().sub(start);
    const mesh=new Mesh(new CylinderGeometry(radius,radius,axis.length(),10),material);
    mesh.name=name;mesh.position.copy(start).lerp(end,.5);
    mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),axis.normalize());
    parent.add(mesh);return mesh;
  }
  box(root,'Cart_Chassis',[4.15,.22,3.5],[0,.15,0],dark);
  const nose=new Mesh(new SphereGeometry(1,24,12),blue);nose.name='Cart_RoundedRetroNose';
  nose.scale.set(2.08,.52,.74);nose.position.set(0,.72,1.03);root.add(nose);
  box(root,'Cart_FrontCreamBand',[2.65,.19,.12],[0,.65,1.735],cream,.06);
  box(root,'Cart_RearPanel',[4.15,.65,.38],[0,.61,-1.5],blue,.18);
  for(const side of [-1,1]){
    box(root,'Cart_SidePanel',[.4,.85,3.2],[side*1.94,.68,-.05],blue,.18);
    box(root,'Cart_CreamStripe',[.07,.19,2.8],[side*2.15,.78,-.1],cream,.035);
    box(root,'Cart_SideTrim',[.25,.12,3],[side*2.02,1.12,-.05],trim,.06);
    box(root,'Cart_RecessedSideSill',[.09,.13,2.66],[side*2.14,.36,-.08],dark,0);
    for(const z of [-1.2,-.43,.34,1.08]){
      const rivet=new Mesh(new CylinderGeometry(.045,.045,.035,8),trim);
      rivet.rotation.z=Math.PI/2;rivet.position.set(side*2.165,.59,z);root.add(rivet);
    }
    const headlight=new Mesh(new SphereGeometry(.13,12,8),lamp);headlight.scale.z=.55;headlight.position.set(side*1.55,.74,1.57);root.add(headlight);
    for(const z of [-1,1]){
      const wheel=new Mesh(new CylinderGeometry(.3,.3,.19,16),dark);
      wheel.rotation.z=Math.PI/2;wheel.position.set(side*1.88,-.05,z);wheel.name='Cart_Wheel';root.add(wheel);
      const hub=new Mesh(new CylinderGeometry(.19,.19,.21,12),cream);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);root.add(hub);
      tube(root,'Cart_Axle',[side*1.62,-.05,z],[side*2.01,-.05,z],.09,trim);
      tube(root,'Cart_BogieBrace',[side*1.88,.02,z],[side*1.60,.23,z+.25],.055,dark);
    }
  }
  for(const [index,x] of [-1.27,0,1.27].entries()){
    const seat=new Group();seat.name=index===1?'Cart_CentreSeat':'Cart_EmptySeat';seat.position.x=x;
    seat.userData.occupied=index===1;root.add(seat);
    box(seat,'Seat_Base',[1.07,.28,1.05],[0,.88,-.18],cushion);
    box(seat,'Seat_Back',[1.07,1.18,.25],[0,1.5,-.77],cushion,.12);
    box(seat,'Seat_Headrest',[.65,.28,.28],[0,2.02,-.75],dark);
    box(seat,'Seat_Pedestal',[.76,.53,.73],[0,.51,-.25],dark,.035);
    box(seat,'Seat_StitchedPanel',[.77,.77,.065],[0,1.51,-.632],dark,.025);
    for(const side of [-1,1]){
      const x=side*.51;
      box(seat,'Seat_Armrest',[.13,.15,1.12],[x,1.15,-.05],dark,.05);
      tube(seat,'Seat_ArmrestSupport',[x,.77,.32],[x,1.12,.32],.055,dark);
      const pivot=[x,1.22,-.54],grip=[side*.43,1.63,.48];
      tube(seat,'Seat_RestraintSupport',pivot,grip,.058,trim);
      const hinge=new Mesh(new CylinderGeometry(.112,.112,.1,12),trim);
      hinge.name='Seat_RestraintHinge';hinge.rotation.z=Math.PI/2;
      hinge.position.set(...pivot);seat.add(hinge);
    }
    box(seat,'Seat_LapBar',[.96,.12,.28],[0,1.63,.48],trim,.04);
  }
  // A dotted star-like decoration inspired by the supplied blue cart reference.
  const dotGeometry=new SphereGeometry(.04,6,4);
  for(let i=0;i<19;i++){
    const dot=new Mesh(dotGeometry,star);dot.position.set(-1.8+i*.2,.45,1.63);root.add(dot);
  }
  // These meshes have one material. Redundant per-face groups prevented batching.
  root.traverse(node=>{if(node.isMesh&&!Array.isArray(node.material))node.geometry.clearGroups();});
  return root;
}
