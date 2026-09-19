// Continuous snow surface, built off the main thread; procedural material has
// no image downloads. All detail is anchored in world space (no animated noise).
export class SnowView {
  constructor(gl,program){
    this.gl=gl;this.count=0;this.revision=0;this.busy=false;this.pending=null;this.active=true;
    this.worker=new Worker('surface-worker.js',{type:'module'});
    this.worker.onmessage=({data})=>{
      this.busy=false;
      if(data.error){this.onError?.(data.error);return;}
      if(data.revision===this.revision){gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data.mesh,gl.DYNAMIC_DRAW);this.count=data.mesh.length/6;this.onUpdate?.(this.count/3);}
      this.dispatch();
    };
    this.worker.onerror=e=>{this.busy=false;this.onError?.(e.message);};
    this.shader=program(gl,`#version 300 es
      precision highp float;
      layout(location=0)in vec3 position;layout(location=1)in vec3 normal;
      uniform mat4 vp;out vec3 world;out vec3 surfaceNormal;
      void main(){world=position;surfaceNormal=normal;gl_Position=vp*vec4(position,1);}`,
      `#version 300 es
      precision highp float;
      in vec3 world;in vec3 surfaceNormal;uniform vec3 eye;out vec4 color;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){
        vec3 n=normalize(surfaceNormal),v=normalize(eye-world),l=normalize(vec3(-.45,.85,.45));
        float grain=noise(world*340.);
        vec3 detail=vec3(noise(world*210.),noise(world*210.+17.),noise(world*210.+43.))-.5;
        n=normalize(n+detail*.19);
        float diffuse=max(dot(n,l),0.),sky=.5+.5*n.y;
        float wrap=clamp((dot(n,l)+.55)/1.55,0.,1.);
        vec3 shade=mix(vec3(.40,.53,.66),vec3(.80,.88,.93),sky)*.48;
        shade+=vec3(1.,.965,.89)*(.49*diffuse+.19*wrap);
        float contact=mix(.73,1.,smoothstep(.065,.17,world.y));
        shade*=contact*(.95+.08*grain);
        float roughHighlight=pow(max(dot(n,normalize(l+v)),0.),22.)*.035;
        // Sparse, antialiased crystal glints. Suppress subpixel sparkle at distance.
        float footprint=length(fwidth(world))*800.;
        float crystals=smoothstep(.91,.985,noise(world*800.));
        float glint=crystals*pow(max(dot(n,normalize(l+v)),0.),10.)*.34/(1.+footprint);
        color=vec4(pow(shade+roughHighlight+glint,vec3(1./2.2)),1.);
      }`);
    this.buffer=gl.createBuffer();this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    this.floorShader=program(gl,`#version 300 es
      layout(location=0)in vec3 position;uniform mat4 vp;out vec3 world;
      void main(){world=position;gl_Position=vp*vec4(position,1);}`,
      `#version 300 es
      precision highp float;in vec3 world;out vec4 color;
      void main(){float edge=(1.-smoothstep(.08,.65,length(world.xz-.5)));color=vec4(mix(vec3(.105,.17,.20),vec3(.21,.30,.33),edge),1.);}`);
    this.floorVao=gl.createVertexArray();gl.bindVertexArray(this.floorVao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([.035,.0615,.035,.965,.0615,.035,.965,.0615,.965,.035,.0615,.035,.965,.0615,.965,.035,.0615,.965]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  }
  clear(){this.revision++;this.pending=null;this.count=0;}
  update(particles,spacing){this.pending={particles:particles.slice(),spacing,revision:this.revision};this.dispatch();}
  dispatch(){if(!this.active||this.busy||!this.pending)return;this.busy=true;const job=this.pending;this.pending=null;this.worker.postMessage(job,[job.particles.buffer]);}
  floor(vp){const gl=this.gl;gl.useProgram(this.floorShader);gl.uniformMatrix4fv(gl.getUniformLocation(this.floorShader,'vp'),false,vp);gl.bindVertexArray(this.floorVao);gl.drawArrays(gl.TRIANGLES,0,6);}
  draw(vp,eye){if(!this.count)return;const gl=this.gl;gl.useProgram(this.shader);gl.uniformMatrix4fv(gl.getUniformLocation(this.shader,'vp'),false,vp);gl.uniform3fv(gl.getUniformLocation(this.shader,'eye'),eye);gl.bindVertexArray(this.vao);gl.drawArrays(gl.TRIANGLES,0,this.count);}
}
