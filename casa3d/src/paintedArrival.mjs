import { Group, MathUtils } from 'three';
import { ARRIVAL_DURATION } from './arrival.mjs';
import { arrivalFireworkLight, createArrivalFireworks, createArrivalFlares } from './arrivalFireworks.mjs';
import { createArrivalSmoke } from './arrivalSmoke.mjs';

const smooth=MathUtils.smoothstep;
const SHOW_START=.385, SHOW_END=.89;
const SMOKE_END_SECONDS=6.2;
const seconds=ARRIVAL_DURATION/1000;
const smokeEnd=SMOKE_END_SECONDS*1000/ARRIVAL_DURATION;
const showDuration=(SHOW_END-SHOW_START)*seconds;

export function createPaintedArrival(scene,camera,arrival,bounds,detail=2) {
  const group=new Group();
  group.name='PaintedArrival';scene.add(group);
  let fireworks=createArrivalFireworks(group,{bounds,duration:showDuration,aspect:camera.aspect,
    sample(localTime){
      const {position,focus}=arrival.sample(SHOW_START+localTime*(SHOW_END-SHOW_START));
      return {position,forward:focus.sub(position).normalize()};
    }});
  let flares=createArrivalFlares(camera,SMOKE_END_SECONDS);
  let smoke=createArrivalSmoke(group,camera,arrival,detail);
  fireworks.update(0,1,false);
  let disposed=false;
  return {
    renderSmoke(renderer){smoke?.render(renderer);},
    update(t,viewportHeight) {
      const elapsed=t*seconds;
      const showTime=elapsed-SHOW_START*seconds;
      const light=t>=SHOW_START && t<SHOW_END ? arrivalFireworkLight(showTime,showDuration) : 0;
      if(t>=SHOW_END){fireworks?.dispose();fireworks=null;}
      else fireworks?.update(showTime,viewportHeight,t>=SHOW_START);
      if(t>=smokeEnd){
        flares?.dispose();flares=null;
        smoke?.dispose();smoke=null;
      }else{
        flares?.update(elapsed,viewportHeight);
        smoke?.update(elapsed,1-smooth(elapsed,4.65,SMOKE_END_SECONDS),light);
      }
      return light;
    },
    dispose() {
      if(disposed)return;
      disposed=true;group.removeFromParent();fireworks?.dispose();smoke?.dispose();
      flares?.dispose();flares=null;fireworks=null;smoke=null;
    },
  };
}
