import { MathUtils, Quaternion, Vector3 } from 'three';

// Two-bone arm pose over the existing rig; restores its hold pose on dismount.
export function createCoasterPaws(model) {
  const chains=[['L',1],['R',-1]].map(([side,sign])=>({sign,
    upper:model.getObjectByName('upper_arm'+side),fore:model.getObjectByName('forearm'+side),hand:model.getObjectByName('hand'+side),side}));
  const bones=[];model.traverse(node=>{if(node.isBone&&/upper_arm|forearm|hand|index_|middle_|ring_|little_|thumb_/.test(node.name))bones.push([node,node.quaternion.clone()]);});
  let applied=false,posed=null;
  const yAxis=new Vector3(0,1,0);
  function worldRotation(bone,quaternion){
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(quaternion));bone.updateWorldMatrix(false,true);
  }
  return {
    reset(){if(!applied)return;for(const [bone,q]of bones)bone.quaternion.copy(q);applied=false;},
    apply(body){
      if(posed){for(const [bone,q]of posed)bone.quaternion.copy(q);applied=true;model.updateWorldMatrix(true,true);return;}
      body.updateWorldMatrix(true,true);const bodyQ=body.getWorldQuaternion(new Quaternion());
      for(const {upper,fore,hand,side,sign}of chains){
        if(!upper||!fore||!hand)continue;
        const shoulder=upper.getWorldPosition(new Vector3());
        const target=body.localToWorld(new Vector3(sign*.34,1.67,.64));
        const direction=target.clone().sub(shoulder),distance=direction.length();direction.normalize();
        const a=fore.position.length(),b=hand.position.length(),reach=Math.min(distance,a+b-.001);
        const along=MathUtils.clamp((a*a-b*b+reach*reach)/(2*reach),-a,a);
        const bend=new Vector3(sign*.8,-.35,-.1).applyQuaternion(bodyQ);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
        const elbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
        worldRotation(upper,new Quaternion().setFromUnitVectors(yAxis,elbow.clone().sub(shoulder).normalize()));
        worldRotation(fore,new Quaternion().setFromUnitVectors(yAxis,target.clone().sub(elbow).normalize()));
        const flat=bodyQ.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2));
        worldRotation(hand,flat);
        // Uncurl the original fingers, retaining their authored attachment positions.
        for(const finger of ['index','middle','ring','little','thumb'])for(let joint=1;joint<=3;joint++){
          const bone=model.getObjectByName(finger+'_0'+joint+side);if(!bone)continue;
          if(joint===1)worldRotation(bone,flat.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),finger==='thumb'?-sign*.65:0)));
          else{bone.quaternion.identity();bone.updateWorldMatrix(false,true);}
        }
      }
      posed=bones.map(([bone])=>[bone,bone.quaternion.clone()]);
      applied=true;model.updateWorldMatrix(true,true);
    },
  };
}
