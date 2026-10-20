import {BoxGeometry,Mesh,MeshBasicMaterial,MathUtils,Vector3} from 'three';

export function prepareContactBoothDoor(model){
  const pivot=model.getObjectByName('Review_DoorHinge');
  if(!pivot)throw new Error('Cabin door hinge missing from Blender asset');
  pivot.userData.interactable=true;pivot.userData.collisionDynamic=true;
  pivot.rotation.set(0,0,0);
  const hull=new Mesh(new BoxGeometry(1.28,2.4,.10),new MeshBasicMaterial({visible:false}));
  hull.name='ContactBoothDoor_Physics';hull.position.set(.64,1.2,0);
  hull.userData.collidable=true;hull.userData.boothDoorPhysics=true;pivot.add(hull);
  let open=false,visited=false,closingAfterExit=false;
  return {pivot,
    get isOpen(){return open;},
    get passable(){return Math.abs(pivot.rotation.y)>1.4;},
    open({immediate=false}={}){open=true;closingAfterExit=false;if(immediate)pivot.rotation.y=-MathUtils.degToRad(100);},
    update(dt,visitor){
      if(visitor){
        const {root,eye,inside}=visitor;
        const local=root.worldToLocal(eye.clone());
        const radius=1.28+.35/root.getWorldScale(new Vector3()).x+.03;
        const clear=local.z>.82&&Math.hypot(local.x+.64,local.z-.73)>radius;
        if(inside){visited=true;if(closingAfterExit){open=true;closingAfterExit=false;}}
        if(visited&&!inside&&clear){open=false;visited=false;closingAfterExit=true;}
        // Wait for the full capsule to clear the outward door sweep.
        if(closingAfterExit&&!clear)return;
      }
      pivot.rotation.y=MathUtils.damp(pivot.rotation.y,open?-MathUtils.degToRad(100):0,6,dt);
    },
    available(root,eye,blocked=false,lineOfSight=()=>true){
      if(blocked||!root.userData.ready)return false;
      const local=root.worldToLocal(eye.clone());
      const target=root.localToWorld(new Vector3(0,.95,local.z>.73 ? .84 : .62));
      return Math.abs(local.x)<1.8&&eye.distanceTo(target)<3&&lineOfSight(eye,target);
    },
  };
}
