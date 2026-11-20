import {
  BufferGeometry, Camera, DataTexture, Float32BufferAttribute, LinearFilter, Matrix4, Mesh,
  NoBlending, Quaternion, RepeatWrapping, Scene, ShaderMaterial,
  Vector2, Vector3, WebGLRenderTarget,
} from 'three';

// Adjacent Z slices occupy the red and green channels of the same lookup.
// Bilinear filtering in XY and interpolation in Z give continuous 3-D noise.
function turbulenceTable() {
  const size=128, bytes=new Uint8Array(size*size*4);
  let seed=69491;
  for(let i=0;i<bytes.length;i+=4) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    bytes[i]=seed>>>24;
  }
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=4*(y*size+x);
    bytes[i+1]=bytes[4*(((y+17)%size)*size+(x+37)%size)];
  }
  const texture=new DataTexture(bytes,size,size);
  texture.wrapS=texture.wrapT=RepeatWrapping;
  texture.magFilter=texture.minFilter=LinearFilter;
  texture.needsUpdate=true;
  return texture;
}

const vertexShader = /* glsl */ `
  varying vec2 screenUV;
  void main(){
    screenUV=position.xy*.5+.5;
    gl_Position=vec4(position.xy,0.,1.);
  }`;

// The vortex bends around the actual flight path, including the taller portrait approach.
const centerline = /* glsl */ `
  uniform vec2 bendA,bendB,bendC;
  vec2 channel(float z){
    return bendA*clamp(z/8.,0.,1.)+(bendB-bendA)*clamp((z-8.)/8.,0.,1.)+(bendC-bendB)*clamp((z-16.)/8.,0.,1.);
  }`;

const volumeShader = /* glsl */ `
  varying vec2 screenUV;
  uniform sampler2D noiseMap;
  uniform float seconds, aperture, aspect, flash, strength;
  uniform mat4 orientation;
  uniform vec3 eye;
  ${centerline}
  float noise3(vec3 p){
    vec3 cell=floor(p), f=fract(p);
    f=f*f*(3.-2.*f);
    vec2 rg=texture2D(noiseMap,(cell.xy+vec2(37.,17.)*cell.z+f.xy+.5)/128.).rg;
    return mix(rg.x,rg.y,f.z);
  }
  mat2 rotate2(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
  void main(){
    vec2 uv=screenUV*2.-1.;
    vec3 ray=normalize((orientation*vec4(uv*vec2(aspect,1.)*aperture,-1.,0.)).xyz);
    ray.z=-ray.z;
    // Integrate only the part of the viewing ray in front of the far bank.
    float reach=clamp((23.-eye.z)/max(.12,ray.z),0.,28.);
    float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    vec4 sum=vec4(0.);
    for(int i=0;i<STEPS;i++){
      float k=float(i)/float(STEPS),next=k+1./float(STEPS);
      float nearD=reach*k*(.64+.36*k),farD=reach*next*(.64+.36*next);
      float dx=farD-nearD;
      vec3 p=eye+ray*mix(nearD,farD,.12+.76*jitter);
      vec2 center=channel(p.z)+vec2(.64*sin(.28*p.z+.24*seconds),.48*cos(.31*p.z-.22*seconds));
      vec2 offset=p.xy-center;
      float radius=length(offset);
      if(radius<.7 || radius>10.)continue;
      float phase=.30*p.z-.60*seconds+.32*sin(.43*p.z+.38*seconds);
      vec2 coil=rotate2(phase)*offset;
      float angle=atan(coil.y,coil.x);
      // The main banks shear with depth; eddies on their surfaces drift
      // independently, roll over, split apart and expose the illuminated core.
      vec3 q=vec3(coil*.69,p.z*.42-seconds*.74);
      float roll=noise3(q*.62+vec3(.32*seconds,4.,0.));
      q.xy=rotate2(1.95*(roll-.5))*q.xy;
      q+=vec3(1.75*roll,-1.2*roll,1.1*roll);
      float body=noise3(q);
      float folds=noise3(q*2.12+vec3(1.,-.62*seconds,5.));
      float grain=noise3(q*4.37+vec3(seconds*.47,13.,3.));
      float swirl=sin(3.*angle+.37*sin(2.*angle-p.z*.24)+1.85*(roll-.5));
      float inner=2.95+1.18*swirl+.54*sin(angle+.36*p.z)+.34*sin(.84*p.z-seconds);
      float surface=radius-inner+3.35*(body-.5)+1.50*(folds-.5)+.73*(grain-.5);
      float density=smoothstep(-.46,1.04,surface)*(.23+.86*body)
        *(1.-smoothstep(6.0,9.7,radius))*(1.-smoothstep(17.,23.,p.z));
      density*=smoothstep(.24,.77,.52*body+.29*roll+.19*folds+.27*swirl);
      if(density<.008)continue;
      vec3 mint=vec3(.015,.51,.59), rose=vec3(.85,.035,.39), iris=vec3(.018,.23,.77);
      vec3 hue=mix(mint,iris,smoothstep(-.83,.15,sin(angle+.62)));
      hue=mix(hue,rose,smoothstep(-.22,.72,cos(angle-.80)));
      hue=mix(hue,vec3(.98,.75,.012),smoothstep(.23,.68,cos(angle-1.72)));
      // Sample the same moving billows toward the light to shade the folds.
      vec3 lightDir=normalize(vec3(-.52,.79,-.34));
      vec2 sideways=rotate2(phase+1.95*(roll-.5))*lightDir.xy;
      float occluder=noise3(q+vec3(sideways,lightDir.z)*.80);
      float face=smoothstep(.09,.94,.44+3.7*(body-occluder)+1.02*(folds-.5));
      float edge=1.-smoothstep(.03,1.72,surface);
      vec3 shade=hue*(.27+.65*face);
      shade=mix(shade,hue,.68*edge*(.26+.74*face));
      shade+=hue*(.08+.14*edge)*face;
      shade+=hue*flash*(.10+.20*edge)*(.4+.6*face);
      float opacity=1.-exp(-2.75*dx*density);
      sum.rgb+=(1.-sum.a)*opacity*shade;
      sum.a+=(1.-sum.a)*opacity;
      if(sum.a>.986)break;
    }
    // The render target holds premultiplied display colour for clean filtering.
    gl_FragColor=sum*strength;
  }`;

const profiles=[
  {steps:23,scale:.37,edge:320}, {steps:30,scale:.43,edge:432}, {steps:38,scale:.52,edge:544},
];

export function createArrivalSmoke(parent,camera,arrival,detail) {
  const profile=profiles[detail-1]??profiles[1];
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0],3));
  const noise=turbulenceTable();
  const target=new WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false,
    magFilter:LinearFilter,minFilter:LinearFilter});
  const uniforms={noiseMap:{value:noise},seconds:{value:0},aspect:{value:1},aperture:{value:1},
    orientation:{value:new Matrix4()},eye:{value:new Vector3()},
    strength:{value:1},flash:{value:0}};
  const field=new ShaderMaterial({vertexShader,fragmentShader:volumeShader,uniforms,
    defines:{STEPS:profile.steps},depthTest:false,depthWrite:false,blending:NoBlending,toneMapped:false});
  const pass=new Scene(),passCamera=new Camera(),volume=new Mesh(geometry,field);
  volume.frustumCulled=false;pass.add(volume);
  const texel=new Vector2();
  const composite=new ShaderMaterial({vertexShader,fragmentShader:`
    uniform sampler2D smoke;
    uniform vec2 texel;
    varying vec2 screenUV;
    void main(){
      vec2 tap=.85*texel;
      gl_FragColor=.28*texture2D(smoke,screenUV)+.18*(
        texture2D(smoke,screenUV+tap)+texture2D(smoke,screenUV-tap)+
        texture2D(smoke,screenUV+vec2(tap.x,-tap.y))+texture2D(smoke,screenUV+vec2(-tap.x,tap.y)));
    }`,
    uniforms:{smoke:{value:target.texture},texel:{value:texel}},transparent:true,premultipliedAlpha:true,
    depthTest:false,depthWrite:false,toneMapped:false});
  const layer=new Mesh(geometry,composite);
  layer.name='ArrivalSmoke';layer.frustumCulled=false;layer.renderOrder=20;
  parent.add(layer);
  const start=arrival.start.clone();
  const basis=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(start,arrival.sample(0).focus,new Vector3(0,1,0))).invert();
  const relative=new Quaternion(),size=new Vector2();
  const units=30/start.distanceTo(arrival.end);
  function flowPosition(out,world){
    out.copy(world).sub(start).applyQuaternion(basis).multiplyScalar(units);
    out.z=-out.z;
  }
  const position=new Vector3();
  for(const [i,name] of ['bendA','bendB','bendC'].entries()){
    let low=0,high=1;
    for(let j=0;j<15;j++){
      const mid=(low+high)/2;
      flowPosition(position,arrival.sample(mid).position);
      if(position.z<(i+1)*8)low=mid;else high=mid;
    }
    uniforms[name]={value:new Vector2(position.x,position.y)};
  }
  return {
    update(seconds,strength,flash){
      layer.visible=strength>.001;
      if(!layer.visible)return;
      uniforms.seconds.value=seconds;uniforms.strength.value=strength;uniforms.flash.value=flash;
      uniforms.aspect.value=camera.aspect;uniforms.aperture.value=1/camera.projectionMatrix.elements[5];
      uniforms.orientation.value.makeRotationFromQuaternion(relative.copy(basis).multiply(camera.quaternion));
      flowPosition(uniforms.eye.value,camera.position);
    },
    render(renderer){
      if(!layer.visible)return;
      renderer.getDrawingBufferSize(size);
      const scale=Math.min(profile.scale,profile.edge/Math.max(size.x,size.y));
      target.setSize(Math.max(1,Math.round(size.x*scale)),Math.max(1,Math.round(size.y*scale)));
      texel.set(1/target.width,1/target.height);
      const previous=renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      try{renderer.render(pass,passCamera);}finally{renderer.setRenderTarget(previous);}
    },
    dispose(){
      layer.removeFromParent();volume.removeFromParent();
      target.dispose();noise.dispose();field.dispose();composite.dispose();geometry.dispose();
    },
  };
}
