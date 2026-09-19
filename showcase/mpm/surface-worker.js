import {buildSnowSurface} from './snow-surface.js';
self.onmessage=({data})=>{try{const mesh=buildSnowSurface(data.particles,data.spacing);postMessage({mesh,revision:data.revision},[mesh.buffer]);}catch(error){postMessage({error:error.message});}};
