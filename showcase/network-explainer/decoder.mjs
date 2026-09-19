// Independent, dependency-free reader of the packed Round 15 codec.
// All coordinates are native 512 x 512 pixel centers. Images are top-to-bottom.
export function unpackModel(buffer, descriptor) {
  const data = new Uint8Array(buffer);
  const values = {};
  for (const segment of descriptor.segments) {
    const count = segment.shape.reduce((a,b) => a*b, 1);
    const result = new Float64Array(count);
    if (segment.format === 'float32') {
      const view = new DataView(buffer, segment.offset, segment.bytes);
      for (let i=0;i<count;i++) result[i] = view.getFloat32(i*4, true);
    } else {
      for (let i=0;i<count;i++) {
        const bit = i*segment.bits, start = segment.offset + (bit >> 3);
        let word = data[start];
        if ((bit & 7)+segment.bits > 8) word |= data[start+1] << 8;
        if ((bit & 7)+segment.bits > 16) word |= data[start+2] << 16;
        result[i] = (word >> (bit & 7)) & ((1 << segment.bits)-1);
      }
    }
    values[segment.name] = result;
  }
  const grids = descriptor.config.bits.map((bits,i) => Float64Array.from(values['grid'+i], v => (v-((1 << (bits-1))-1))/(1 << bits)));
  const layers = [0,1,2,3].map(i => {
    const segment = descriptor.segments.find(s => s.name === 'weight'+i);
    const [output,input] = segment.shape;
    return {input,output,bias: values['bias'+i], weights: Float64Array.from(values['weight'+i], (v,k) => Math.fround((v-512)*values['scale'+i][Math.floor(k/input)]))};
  });
  return {grids,layers,config:descriptor.config};
}

export function gridSample(model, level, u, v) {
  const n = model.config.sizes[level], channels = model.config.channels[level];
  const px=u*n-.5, py=v*n-.5, ix=Math.floor(px), iy=Math.floor(py);
  const clamp = q => Math.max(0,Math.min(n-1,q));
  const nodes = [[ix,iy],[ix+1,iy],[ix,iy+1],[ix+1,iy+1]].map(([x,y])=>({x:clamp(x),y:clamp(y),values:Array.from(model.grids[level].slice((clamp(y)*n+clamp(x))*channels,(clamp(y)*n+clamp(x)+1)*channels))}));
  const fx=px-ix, fy=py-iy;
  const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
  return {nodes,weights,fx,fy};
}

export function tracePixel(model, x, y) {
  const u=(x+.5)/512,v=(y+.5)/512;
  const fine=gridSample(model,0,u,v), coarse=gridSample(model,1,u,v);
  const fineValues=fine.nodes.flatMap(n=>n.values);
  const coarseValues=Array.from({length:5},(_,c)=>coarse.nodes.reduce((sum,node,i)=>sum+node.values[c]*coarse.weights[i],0));
  const position=[];
  for(const f of [1,2,4]) {
    // Match the training code's FP32 phase construction before sin/cos.
    const phase=t=>Math.fround(Math.fround(Math.fround(t*model.config.position_scale)*f)*Math.fround(2*Math.PI));
    const a=phase(u),b=phase(v);
    position.push(Math.fround(Math.sin(a)),Math.fround(Math.sin(b)),Math.fround(Math.cos(a)),Math.fround(Math.cos(b)));
  }
  const input=[...fineValues,...coarseValues,...position];
  const activations=[];
  let current=input;
  model.layers.forEach((layer,index)=>{
    const next=new Float64Array(layer.output);
    for(let j=0;j<layer.output;j++) {
      let sum=layer.bias[j];
      for(let k=0;k<layer.input;k++) sum+=layer.weights[j*layer.input+k]*current[k];
      next[j]=index<3?Math.sin(model.config.omega*sum):sum;
    }
    current=next;
    activations.push(Array.from(next));
  });
  return {x,y,u,v,fine,coarse,fineValues,coarseValues,position,input,activations,rgb:Array.from(current,v=>Math.max(0,Math.min(1,v)))};
}
