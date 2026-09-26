import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const source='C:/Users/Amministratore/Desktop/trees';
const files=(await readdir(source)).filter(name=>name.toLowerCase().endsWith('.glb'));
const report=[];
for(const name of files){
  const bytes=await readFile(path.join(source,name));
  const magic=bytes.toString('ascii',0,4),version=bytes.readUInt32LE(4),declared=bytes.readUInt32LE(8);
  if(magic!=='glTF'||version!==2||declared!==bytes.length)throw new Error(`Invalid GLB header: ${name}`);
  let offset=12,json;
  while(offset<bytes.length){
    const length=bytes.readUInt32LE(offset),kind=bytes.toString('ascii',offset+4,offset+8);
    if(offset+8+length>bytes.length)throw new Error(`Truncated chunk: ${name}`);
    if(kind==='JSON')json=JSON.parse(bytes.toString('utf8',offset+8,offset+8+length));
    offset+=8+length;
  }
  if(!json||offset!==bytes.length)throw new Error(`Invalid chunks: ${name}`);
  const accessors=json.accessors??[],meshes=json.meshes??[];
  let triCount=0,vertexCount=0;
  for(const mesh of meshes)for(const p of mesh.primitives){
    if((p.mode??4)!==4)continue;
    triCount+=(accessors[p.indices]?.count??accessors[p.attributes.POSITION]?.count??0)/3;
    vertexCount+=accessors[p.attributes.POSITION]?.count??0;
  }
  report.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex').slice(0,16),
    nodes:json.nodes?.length??0,meshes:meshes.length,primitives:meshes.reduce((sum,m)=>sum+m.primitives.length,0),
    triangles:triCount,vertices:vertexCount,images:(json.images??[]).map(i=>i.mimeType??i.uri??'unknown'),
    materials:(json.materials??[]).map(m=>m.name),roots:(json.scenes?.[json.scene??0]?.nodes??[]).map(n=>json.nodes[n].name),
    generator:json.asset?.generator});
}
await writeFile(new URL('./source-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
