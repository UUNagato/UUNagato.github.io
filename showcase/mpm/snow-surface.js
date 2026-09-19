// Compact-support density reconstruction. Display geometry only: the MPM state
// remains untouched. Marching tetrahedra shares a consistent cube diagonal.
export function buildSnowSurface(particles, spacing, resolution=72) {
  const n=resolution, size=n+1, plane=size*size, field=new Float32Array(size**3);
  const lo=[n,n,n],hi=[0,0,0];
  for(let p=0;p<particles.length;p+=5){
    const x=particles[p],y=particles[p+1],z=particles[p+2];
    const radius=spacing*1.65*Math.cbrt(Math.max(.6,Math.min(1.4,particles[p+3])));
    const r2=radius*radius, a=[x,y,z].map(v=>Math.max(1,Math.floor((v-radius)*n))),b=[x,y,z].map(v=>Math.min(n-1,Math.ceil((v+radius)*n)));
    for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],a[k]);hi[k]=Math.max(hi[k],b[k]);}
    for(let iz=a[2];iz<=b[2];iz++)for(let iy=a[1];iy<=b[1];iy++)for(let ix=a[0];ix<=b[0];ix++){
      const d=((ix/n-x)**2+(iy/n-y)**2+(iz/n-z)**2)/r2;
      if(d<1)field[ix+iy*size+iz*plane]+=(1-d)**3;
    }
  }
  // Half the bulk density gives the exterior of a densely sampled snow body.
  const iso=1.05, corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const tetra=[[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]],out=[];
  // Outward normals are negative density gradients, interpolated on each edge.
  function edge(a,b){const t=(iso-a[3])/(b[3]-a[3]);return a.slice(0,3).map((v,i)=>v+(b[i]-v)*t).concat(a.slice(4,7).map((v,i)=>v+(b[i+4]-v)*t));}
  function triangle(a,b,c){
    const u=b.slice(0,3).map((v,i)=>v-a[i]),v=c.slice(0,3).map((v,i)=>v-a[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(cross.reduce((s,x,i)=>s+x*(a[i+3]+b[i+3]+c[i+3]),0)<0)[b,c]=[c,b];
    for(const p of [a,b,c]){const length=Math.hypot(p[3],p[4],p[5])||1;out.push(p[0],p[1],p[2],p[3]/length,p[4]/length,p[5]/length);}
  }
  for(let z=Math.max(1,lo[2]-1);z<Math.min(n-1,hi[2]+1);z++)for(let y=Math.max(1,lo[1]-1);y<Math.min(n-1,hi[1]+1);y++)for(let x=Math.max(1,lo[0]-1);x<Math.min(n-1,hi[0]+1);x++){
    const indices=corners.map(c=>x+c[0]+(y+c[1])*size+(z+c[2])*plane);
    let mask=0;for(let i=0;i<8;i++)if(field[indices[i]]>=iso)mask|=1<<i;
    if(mask===0||mask===255)continue;
    const points=corners.map((c,i)=>{const k=indices[i];return[(x+c[0])/n,(y+c[1])/n,(z+c[2])/n,field[k],field[k-1]-field[k+1],field[k-size]-field[k+size],field[k-plane]-field[k+plane]];});
    for(const t of tetra){const inside=t.filter(i=>mask&(1<<i)),outside=t.filter(i=>!(mask&(1<<i)));
      if(inside.length===1)triangle(...outside.map(i=>edge(points[inside[0]],points[i])));
      else if(inside.length===3)triangle(...inside.map(i=>edge(points[outside[0]],points[i])));
      else if(inside.length===2){const a=edge(points[inside[0]],points[outside[0]]),b=edge(points[inside[0]],points[outside[1]]),c=edge(points[inside[1]],points[outside[0]]),d=edge(points[inside[1]],points[outside[1]]);triangle(a,b,c);triangle(b,d,c);}
    }
  }
  return new Float32Array(out);
}
