import { CatmullRomCurve3, CylinderGeometry, DoubleSide, Group, Mesh, MeshPhysicalMaterial,
  MeshStandardMaterial, TubeGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';

// Cross sections describe the outer width and the sill height along the train.
const HULL_PROFILE = [
  [.008,.63,-1.75], [1.32,.85,-1.65], [1.97,1.09,-1.34], [2.10,1.16,-.98],
  [2.13,1.08,-.40], [2.10,1.03,.25], [1.97,.99,.76], [1.63,.89,1.23],
  [.96,.75,1.61], [.008,.60,1.795],
];

function addBodywork(root, paint, edge, headlamp, taillamp) {
  const outline=new CatmullRomCurve3(HULL_PROFILE.map(section=>new Vector3(...section)));
  const section=new Vector3();
  const rear=3/(HULL_PROFILE.length-1),front=6/(HULL_PROFILE.length-1);
  function skin(name,start,end,lower) {
    const geometry=new ParametricGeometry((u,v,target)=>{
      outline.getPoint(start+v*(end-start),section);
      const {x:width,y:sill,z}=section;
      const angle=(lower ? u-.5 : .5-u)*Math.PI;
      const crown=lower ? -(sill-.25) : Math.min(.44,width*.28);
      target.set(width*Math.sin(angle),sill+crown*Math.cos(angle),z);
    },24,lower?42:18);
    const mesh=new Mesh(geometry,paint);mesh.name=name;root.add(mesh);
  }
  skin('Cart_SculptedHull',0,1,true);
  skin('Cart_RearFairing',0,rear,false);
  skin('Cart_RocketNose',front,1,false);
  for(const side of [-1,1]){
    const points=Array.from({length:9},(_,i)=>{
      const point=outline.getPoint(rear+(front-rear)*i/8);
      point.x=side*(point.x-.045);point.y+=.018;
      return point;
    });
    const sill=new Mesh(new TubeGeometry(new CatmullRomCurve3(points),16,.05,7,false),edge);
    sill.name='Cart_CockpitRim';root.add(sill);
  }
  // The front and rear arches finish the open cockpit where the shells meet it.
  for(const t of [rear,front]){
    outline.getPoint(t,section);
    const points=Array.from({length:17},(_,i)=>{
      const angle=(i/16-.5)*Math.PI;
      return new Vector3(section.x*Math.sin(angle),section.y+.44*Math.cos(angle),section.z);
    });
    const lip=new Mesh(new TubeGeometry(new CatmullRomCurve3(points),20,.035,7,false),paint);
    lip.name='Cart_FoldedPanelEdge';root.add(lip);
  }
  // Lay each lens against the same curved surface as the body panel.
  for(const [name,start,end,material] of [
    ['Cart_FrontLamp',.855,.899,headlamp],
    ['Cart_TailLamp',.075,.108,taillamp],
  ]){
    for(const side of [-1,1]){
      const geometry=new ParametricGeometry((u,v,target)=>{
        const angle=side*.89+(.5-u)*.30;
        outline.getPoint(start+v*(end-start)+side*(u-.5)*.032,section);
        const {x:width,y:sill,z}=section;
        target.set(width*Math.sin(angle)*1.01,
          sill+Math.min(.44,width*.28)*Math.cos(angle)+.022,z);
      },10,4);
      const lens=new Mesh(geometry,material);lens.name=name;root.add(lens);
    }
  }
}

// Three seats in one row. The middle eye remains at the existing route origin.
export function createCoasterCart() {
  const root=new Group();root.name='Coaster_Cart';root.userData.interactable=true;
  const paint=new MeshPhysicalMaterial({color:0xe52319,metalness:.18,roughness:.24,side:DoubleSide,
    clearcoat:.9,clearcoatRoughness:.19,emissive:0x800701,emissiveIntensity:.16});
  const trim=new MeshStandardMaterial({color:0xadb0b4,metalness:.62,roughness:.24});
  const accent=new MeshStandardMaterial({color:0x5f1017,metalness:.23,roughness:.32});
  const lamp=new MeshStandardMaterial({color:0xffebe0,emissive:0xffc080,emissiveIntensity:.75,roughness:.24});
  const tail=new MeshStandardMaterial({color:0xff2330,emissive:0xe50c14,emissiveIntensity:.52,roughness:.23});
  const dark=new MeshStandardMaterial({color:0x18191d,roughness:.62});
  const cushion=new MeshStandardMaterial({color:0x302a2b,roughness:.88});
  function box(parent,name,size,position,material,radius=.08){
    const geometry=new RoundedBoxGeometry(...size,1,radius);
    const mesh=new Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);parent.add(mesh);return mesh;
  }
  function tube(parent,name,from,to,radius,material){
    const start=new Vector3(...from),end=new Vector3(...to),axis=end.clone().sub(start);
    const mesh=new Mesh(new CylinderGeometry(radius,radius,axis.length(),10),material);
    mesh.name=name;mesh.position.copy(start).lerp(end,.5);
    mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),axis.normalize());
    parent.add(mesh);return mesh;
  }
  addBodywork(root,paint,accent,lamp,tail);
  box(root,'Cart_Chassis',[3.62,.22,2.37],[0,.15,0],dark,.09);
  box(root,'Cart_CockpitFloor',[3.72,.14,1.88],[0,.40,-.17],dark,.06);
  box(root,'Cart_RearBumper',[2.2,.13,.24],[0,.35,-1.57],dark,.055);
  for(const side of [-1,1]){
    const vent=box(root,'Cart_SideIntake',[.095,.19,.94],[side*1.99,.69,-.48],accent,.04);
    vent.rotation.z=-side*.21;
    for(const z of [-.76,-.57,-.38,-.19]){
      const vane=box(root,'Cart_IntakeVane',[.035,.12,.046],[side*2.04,.68,z],trim,.009);
      vane.rotation.x=-.32;
    }
    for(const z of [-1,1]){
      const wheel=new Mesh(new CylinderGeometry(.3,.3,.19,16),dark);
      wheel.rotation.z=Math.PI/2;wheel.position.set(side*1.88,-.05,z);wheel.name='Cart_Wheel';root.add(wheel);
      const hub=new Mesh(new CylinderGeometry(.19,.19,.21,12),trim);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);root.add(hub);
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
    box(seat,'Seat_StitchedPanel',[.77,.77,.065],[0,1.51,-.632],accent,.025);
    for(const side of [-1,1]){
      box(seat,'Seat_ShoulderBolster',[.16,.75,.16],[side*.43,1.51,-.63],dark,.07);
    }
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
  // These meshes have one material. Redundant per-face groups prevented batching.
  root.traverse(node=>{if(node.isMesh&&!Array.isArray(node.material))node.geometry.clearGroups();});
  return root;
}
