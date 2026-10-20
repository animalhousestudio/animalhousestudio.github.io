import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
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
  box(root,'Cart_Chassis',[4.15,.22,3.5],[0,.15,0],dark);
  const nose=new Mesh(new SphereGeometry(1,24,12),blue);nose.name='Cart_RoundedRetroNose';
  nose.scale.set(2.08,.52,.74);nose.position.set(0,.72,1.03);root.add(nose);
  box(root,'Cart_FrontCreamBand',[2.65,.19,.12],[0,.65,1.735],cream,.06);
  box(root,'Cart_RearPanel',[4.15,.65,.38],[0,.61,-1.5],blue,.18);
  for(const side of [-1,1]){
    box(root,'Cart_SidePanel',[.4,.85,3.2],[side*1.94,.68,-.05],blue,.18);
    box(root,'Cart_CreamStripe',[.07,.19,2.8],[side*2.15,.78,-.1],cream,.035);
    box(root,'Cart_SideTrim',[.25,.12,3],[side*2.02,1.12,-.05],trim,.06);
    const headlight=new Mesh(new SphereGeometry(.13,12,8),lamp);headlight.scale.z=.55;headlight.position.set(side*1.55,.74,1.57);root.add(headlight);
    for(const z of [-1,1]){
      const wheel=new Mesh(new CylinderGeometry(.3,.3,.19,16),dark);
      wheel.rotation.z=Math.PI/2;wheel.position.set(side*1.88,-.05,z);wheel.name='Cart_Wheel';root.add(wheel);
      const hub=new Mesh(new CylinderGeometry(.19,.19,.21,12),cream);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);root.add(hub);
    }
  }
  for(const [index,x] of [-1.27,0,1.27].entries()){
    const seat=new Group();seat.name=index===1?'Cart_CentreSeat':'Cart_EmptySeat';seat.position.x=x;
    seat.userData.occupied=index===1;root.add(seat);
    box(seat,'Seat_Base',[1.07,.28,1.05],[0,.88,-.18],cushion);
    box(seat,'Seat_Back',[1.07,1.18,.25],[0,1.5,-.77],cushion,.12);
    box(seat,'Seat_Headrest',[.65,.28,.28],[0,2.02,-.75],dark);
    for(const side of [-1,1])box(seat,'Seat_Armrest',[.13,.15,1.12],[side*.51,1.15,-.05],dark,.05);
    box(seat,'Seat_LapBar',[.96,.12,.28],[0,1.63,.48],trim,.04);
  }
  // A dotted star-like decoration inspired by the supplied blue cart reference.
  const dotGeometry=new SphereGeometry(.04,6,4);
  for(let i=0;i<19;i++){
    const dot=new Mesh(dotGeometry,star);dot.position.set(-1.8+i*.2,.45,1.63);root.add(dot);
  }
  return root;
}
