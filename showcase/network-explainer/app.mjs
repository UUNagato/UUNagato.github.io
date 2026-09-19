import {unpackModel,tracePixel} from './decoder.mjs';
import {t as translate,locale} from './i18n.mjs';

const $=id=>document.getElementById(id);
const state={x:193,y:224,node:'fine',storage:'fine',level:0,channel:0,detail:'color',size:32,model:null,data:null,images:{},pixels:{},trace:null};
const fmt=(n,d=4)=>Number(n).toFixed(d);
const rgbString=rgb=>`rgb(${rgb.join(',')})`;
const css=getComputedStyle(document.documentElement);
const colors={fine:css.getPropertyValue('--fine').trim(),coarse:css.getPropertyValue('--coarse').trim(),position:css.getPropertyValue('--position').trim(),green:css.getPropertyValue('--green').trim(),ink:css.getPropertyValue('--ink').trim(),muted:css.getPropertyValue('--muted').trim()};
function mix(a,b,t){return a.map((x,i)=>Math.round(x+(b[i]-x)*t));}
function valueColor(value,max=1){return rgbString(mix([239,242,232],value<0?[117,136,172]:[40,98,76],Math.min(1,Math.abs(value)/max)));}
function drawCells(id,values,columns,max=1){
  const canvas=$(id),ctx=canvas.getContext('2d'),rows=Math.ceil(values.length/columns);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const w=canvas.width/columns,h=canvas.height/rows;
  values.forEach((v,i)=>{ctx.fillStyle=valueColor(v,max);ctx.fillRect((i%columns)*w+1,Math.floor(i/columns)*h+1,w-2,h-2);});
}
function chooseButtons(selector,attribute,value){document.querySelectorAll(selector).forEach(button=>{const selected=button.dataset[attribute]===value;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});}
function setSplit(value){const n=Math.max(0,Math.min(100,Number(value)));$('split').value=n;$('split-value').value=`${Math.round(n)}%`;$('compare-left').style.clipPath=`inset(0 ${100-n}% 0 0)`;$('split-line').style.left=n+'%';}
$('split').addEventListener('input',e=>setSplit(e.target.value));
let dragging=false;
function splitAt(e){const r=$('compare-stage').getBoundingClientRect();setSplit((e.clientX-r.left)/r.width*100);}
$('compare-stage').addEventListener('pointerdown',e=>{dragging=true;e.currentTarget.setPointerCapture(e.pointerId);splitAt(e);});
$('compare-stage').addEventListener('pointermove',e=>{if(dragging)splitAt(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('compare-stage').addEventListener(event,()=>dragging=false);
document.querySelectorAll('[data-compare]').forEach(button=>button.addEventListener('click',()=>{
  chooseButtons('[data-compare]','compare',button.dataset.compare);
  const isOriginal=button.dataset.compare==='original';
  $('compare-left').src=`assets/${button.dataset.compare}.png`;
  $('compare-left').alt=translate(isOriginal?'未压缩的原始测试图':'BC7 重建的同一测试图');
  $('left-label').textContent=translate(isOriginal?'原图':'BC7');
}));

function pixelAt(name,x,y){return Array.from(state.pixels[name].slice((y*512+x)*4,(y*512+x)*4+3));}
function updatePixel(x,y){
  if(!state.model)return;
  if(!Number.isFinite(x)||!Number.isFinite(y))return;
  state.x=Math.max(0,Math.min(511,Math.round(x)));state.y=Math.max(0,Math.min(511,Math.round(y)));
  const t=state.trace=tracePixel(state.model,state.x,state.y);
  $('pixel-x').value=state.x;$('pixel-y').value=state.y;
  $('pixel-coord').textContent=`(${state.x}, ${state.y})`;
  $('uv-value').textContent=`(${fmt(t.u)}, ${fmt(t.v)})`;
  $('crosshair').style.left=((state.x+.5)/512*100)+'%';$('crosshair').style.top=((state.y+.5)/512*100)+'%';
  const source=pixelAt('original',state.x,state.y),output=t.rgb.map(v=>Math.round(v*255));
  $('source-swatch').style.background=rgbString(source);$('source-rgb').textContent=source.join(' · ');
  $('output-swatch').style.background=rgbString(output);$('network-swatch').style.background=rgbString(output);$('output-rgb').textContent=output.join(' · ');
  drawCells('fine-mini',t.fineValues,6,.5);drawCells('coarse-mini',t.coarseValues,5,.5);drawCells('position-mini',t.position,6);
  for(let i=0;i<3;i++)drawCells(`layer${i}-mini`,t.activations[i],10);
  renderNode();renderCrops();
}
$('pixel-stage').addEventListener('pointerdown',e=>{const r=e.currentTarget.getBoundingClientRect();updatePixel(Math.floor((e.clientX-r.left)/r.width*512),Math.floor((e.clientY-r.top)/r.height*512));});
$('trace-button').addEventListener('click',()=>updatePixel(Number($('pixel-x').value),Number($('pixel-y').value)));
for(const id of ['pixel-x','pixel-y'])$(id).addEventListener('keydown',e=>{if(e.key==='Enter')updatePixel(Number($('pixel-x').value),Number($('pixel-y').value));});
document.querySelectorAll('[data-pixel]').forEach(b=>b.addEventListener('click',()=>updatePixel(...b.dataset.pixel.split(',').map(Number))));
document.querySelectorAll('[data-node]').forEach(b=>b.addEventListener('click',()=>{state.node=b.dataset.node;renderNode();}));

function valueGrid(values){return `<div class="value-grid">${values.map((v,i)=>`<span class="value-cell" title="${i+1}: ${v}">${fmt(v,3)}</span>`).join('')}</div>`;}
function renderNode(){
  if(!state.trace)return;
  document.querySelectorAll('[data-node]').forEach(b=>{const selected=b.dataset.node===state.node;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  const t=state.trace;
  let title='',size='',body='';
  if(state.node==='fine'||state.node==='coarse'){
    const fine=state.node==='fine',sample=fine?t.fine:t.coarse;
    title=fine?'A / 四个节点，保留全部特征':'B / 按距离混合四个节点';size=fine?'4 × 6 = 24':'4 × 5 → 5';
    body=`<p>${fine?'每个节点存 6 个 4-bit 特征，按左上、右上、左下、右下顺序直接拼接，不做插值。':'每个节点存 5 个 4-bit 特征，用双线性权重混合为 5 个输入。权重之和为 1。'}</p><div class="table-scroll"><table class="node-table"><thead><tr><th>节点 (x, y)</th>${fine?'':'<th>插值权重</th>'}<th>解码特征值</th></tr></thead><tbody>${sample.nodes.map((n,i)=>`<tr><td>(${n.x}, ${n.y})</td>${fine?'':`<td>${fmt(sample.weights[i])}</td>`}<td>${n.values.map(v=>fmt(v,3)).join(' / ')}</td></tr>`).join('')}</tbody></table></div>`;
    if(!fine)body+=valueGrid(t.coarseValues);
  } else if(state.node==='position'){
    title='C / 用周期函数标记位置';size='3 × 4 = 12';body='<p>频率 64、128、256。每组依次为 sin(x)、sin(y)、cos(x)、cos(y)。不额外存储一张位置图。</p>'+valueGrid(t.position);
  } else if(state.node==='input'){
    title='41 个数，共同描述这个像素';size='24 + 5 + 12';body='<p>依次拼接细网格、粗网格和位置编码，送入第一层网络。下面按输入顺序排列。</p>'+valueGrid(t.input);
  } else if(state.node==='output'){
    title='最后，把 80 个激活映射成颜色';size='80 → 3';body='<p>输出层不使用正弦激活。线性输出限幅到 [0, 1] 后，乘以 255 并取整得到 RGB8。</p>'+valueGrid(t.activations[3])+`<p style="margin-top:12px">限幅后的 RGB：${t.rgb.map(v=>fmt(v,6)).join(' / ')}</p>`;
  } else {
    const i=Number(state.node.slice(-1));title=`隐藏层 ${i+1} / 正弦激活`;size=`${i===0?41:80} → 80`;body='<p>每个单元对上一层做加权求和，再计算 sin(30x)。以下是当前像素的 80 个实际激活值。</p>'+valueGrid(t.activations[i]);
  }
  $('node-detail').innerHTML=translate(`<div class="detail-heading"><h3>${title}</h3><span>${size}</span></div>${body}`);
}

const storageText={
  fine:['细网格 / 4-bit 局部特征','256 × 256 个节点，每个节点 6 个通道，每个值只需 4 bit。共 393,216 个特征值，占用 196,608 字节。'],
  coarse:['粗网格 / 4-bit 局部特征','128 × 128 个节点，每个节点 5 个通道。每次解码用四点插值，得到更大空间尺度上的特征，共 40,960 字节。'],
  network:['解码网络 / 10-bit 权重','41 → 80 → 80 → 80 → 3，共 16,320 个权重，使用 10-bit 存储；另有 FP32 行尺度和偏置。总计 22,344 字节。'],
  meta:['描述文件 / 如何读懂这些字节','1,614 字节 JSON，记录网格尺寸、网络形状、位宽、数据段偏移与校验值。它也计入 255.396 KiB 的比较预算。']
};
function renderStorage(){
  const [title,body]=storageText[state.storage];$('storage-detail').innerHTML=translate(`<strong>${title}</strong><p>${body}</p>`);
  chooseButtons('[data-storage]','storage',state.storage);
  const isGrid=state.storage==='fine'||state.storage==='coarse';
  if(isGrid){state.level=state.storage==='fine'?0:1;state.channel=0;updateChannelOptions();}
  drawGrid();
}
function updateChannelOptions(){
  const count=state.level===0?6:5;$('grid-channel').innerHTML=Array.from({length:count},(_,i)=>`<option value="${i}">${i+1} / ${count}</option>`).join('');
  $('grid-title').textContent=translate((state.level===0?'细':'粗')+'网格 · 学习到的特征');
}
function drawGrid(){
  if(!state.model)return;
  const n=state.model.config.sizes[state.level],c=state.model.config.channels[state.level],canvas=$('grid-canvas');
  canvas.width=n;canvas.height=n;
  const ctx=canvas.getContext('2d'),im=ctx.createImageData(n,n),g=state.model.grids[state.level];
  for(let i=0;i<n*n;i++){
    const v=g[i*c+state.channel],rgb=mix([239,242,232],v<0?[117,136,172]:[40,98,76],Math.min(1,Math.abs(v)/(v<0?7/16:.5)));
    im.data.set([...rgb,255],i*4);
  }
  ctx.putImageData(im,0,0);
  canvas.setAttribute('aria-label',translate(`${state.level===0?'细':'粗'}网格第 ${state.channel+1} 通道的实际量化特征值`));
}
document.querySelectorAll('[data-storage]').forEach(b=>b.addEventListener('click',()=>{state.storage=b.dataset.storage;renderStorage();}));
$('grid-channel').addEventListener('change',e=>{state.channel=Number(e.target.value);drawGrid();});

function renderHistory(){
  if(!state.data)return;
  const history=state.data.history,index=Number($('history-slider').value),current=history[index];
  $('history-score').innerHTML=`${fmt(current.rgb8_psnr,3)}<span> dB</span>`;$('history-pass').textContent=index;
  $('history-changes').textContent=translate(index===0?'搜索起点':`${current.changes.toLocaleString(locale)} 个编码更新`);
  const px=i=>52+i*39.5,py=y=>202-(y-42.5)/1.25*174;
  const x=px(index),y=py(current.rgb8_psnr),bc=py(state.data.scores.bc7);
  let svg='<title>真实离散搜索记录：相同体积下，质量从 42.648 提高到 43.636 dB</title>';
  for(const tick of [42.5,43,43.5])svg+=`<line x1="52" y1="${py(tick)}" x2="526" y2="${py(tick)}" stroke="#e6e9e1"/><text x="40" y="${py(tick)+4}" text-anchor="end" fill="${colors.muted}" font-size="10">${tick.toFixed(1)}</text>`;
  svg+=`<text x="4" y="18" fill="${colors.muted}" font-size="9">PSNR / dB</text><line x1="52" y1="${bc}" x2="526" y2="${bc}" stroke="#a9946e" stroke-dasharray="4 4"/><text x="521" y="${bc+13}" text-anchor="end" fill="#8d7042" font-size="10">BC7 42.904</text>`;
  const points=history.map((h,i)=>`${px(i)},${py(h.rgb8_psnr)}`).join(' ');
  svg+=`<polyline points="${points}" fill="none" stroke="#c5d6c9" stroke-width="2"/><polyline points="${history.slice(0,index+1).map((h,i)=>`${px(i)},${py(h.rgb8_psnr)}`).join(' ')}" fill="none" stroke="${colors.green}" stroke-width="2.5"/>`;
  history.forEach((h,i)=>{svg+=`<circle cx="${px(i)}" cy="${py(h.rgb8_psnr)}" r="3.5" fill="${i<=index?colors.green:'#c5d6c9'}"/>`;if(i%3===0)svg+=`<text x="${px(i)}" y="225" text-anchor="middle" fill="${colors.muted}" font-size="10">${i}</text>`;});
  svg+=`<line x1="${x}" y1="${y}" x2="${x}" y2="202" stroke="${colors.green}" opacity=".3"/><circle cx="${x}" cy="${y}" r="6" fill="${colors.green}" stroke="white" stroke-width="2"/><text x="526" y="243" text-anchor="end" font-size="9" fill="${colors.muted}">离散搜索轮数</text>`;
  $('history-chart').innerHTML=translate(svg);
}
$('history-slider').addEventListener('input',renderHistory);

function renderCrops(){
  if(!state.images.original)return;
  const size=state.size,startX=Math.max(0,Math.min(512-size,state.x-Math.floor(size/2))),startY=Math.max(0,Math.min(512-size,state.y-Math.floor(size/2)));
  $('crop-coord').textContent=translate(`像素 (${state.x}, ${state.y}) · ${size} × ${size} 裁剪`);
  for(const name of ['original','bc7','neural']){
    const canvas=$('crop-'+name),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    if(state.detail==='error'&&name!=='original'){
      const temp=document.createElement('canvas');temp.width=size;temp.height=size;const tc=temp.getContext('2d'),im=tc.createImageData(size,size);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const i=((startY+y)*512+startX+x)*4,j=(y*size+x)*4;
        for(let c=0;c<3;c++)im.data[j+c]=Math.min(255,Math.abs(state.pixels[name][i+c]-state.pixels.original[i+c])*8);
        im.data[j+3]=255;
      }
      tc.putImageData(im,0,0);ctx.drawImage(temp,0,0,256,256);
    } else ctx.drawImage(state.images[name],startX,startY,size,size,0,0,256,256);
    // The selection marker stays inside the crop, including near image borders.
    const sx=(state.x-startX+.5)/size*256,sy=(state.y-startY+.5)/size*256;
    ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(sx-4,sy-4,8,8);ctx.strokeStyle='#243c34';ctx.strokeRect(sx-5,sy-5,10,10);
  }
  for(const [id,name] of [['search-before','before'],['search-after','neural']]){
    const ctx=$(id).getContext('2d');ctx.imageSmoothingEnabled=false;
    ctx.drawImage(state.images[name],startX,startY,size,size,0,0,256,256);
  }
  $('error-note').textContent=translate(state.detail==='error'?'左侧保留原图；中、右两图逐通道显示 |重建 − 原图| × 8，统一倍率，超出 255 的值截断。越暗误差越小。':'最近邻放大，保留原始像素。各图标题的 PSNR 为全图指标。');
}
document.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>{state.detail=b.dataset.detail;chooseButtons('[data-detail]','detail',state.detail);renderCrops();}));
$('zoom').addEventListener('change',e=>{state.size=Number(e.target.value);renderCrops();});

async function fetchLocal(path,type='json'){
  const response=await fetch(path);if(!response.ok)throw new Error(`本地资源加载失败：${path} (${response.status})`);return type==='json'?response.json():response.arrayBuffer();
}
async function loadImage(name){
  const image=new Image();image.src=`assets/${name}.png`;await image.decode();state.images[name]=image;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);state.pixels[name]=ctx.getImageData(0,0,512,512).data;
}
async function init(){
  try{
    const [descriptor,buffer,data]=await Promise.all([fetchLocal('assets/model.json'),fetchLocal('assets/model.bin','buffer'),fetchLocal('assets/exhibit.json'),...['original','bc7','neural','before'].map(loadImage)]);
    state.model=unpackModel(buffer,descriptor);state.data=data;
    let maxError=0;
    for(const fixture of data.fixtures){const actual=tracePixel(state.model,fixture.x,fixture.y).rgb;actual.forEach((v,i)=>maxError=Math.max(maxError,Math.abs(v-fixture.rgb[i])));}
    if(!Number.isFinite(maxError)||maxError>0.0001)throw new Error('模型解码自检未通过，请检查本地资源是否完整。');
    $('load-status').textContent=translate('本地模型已就绪 · 点击图像或输入坐标，开始探索');
    $('self-check').textContent=translate(`12 个参考像素自检通过，最大 RGB 浮点差为 ${maxError.toExponential(1)}。`);
    $('trace-button').disabled=false;
    updatePixel(state.x,state.y);renderStorage();renderHistory();
    document.documentElement.dataset.ready='true';
  }catch(error){
    console.error(error);$('load-status').classList.add('error');
    $('load-status').textContent=translate(location.protocol==='file:'?'交互模型需要本地网页服务。请在本目录运行 node serve.mjs，再访问 http://127.0.0.1:8780。':`${error.message} 可刷新重试；静态图像与说明仍可阅读。`);
    document.documentElement.dataset.ready='error';
  }
}
const navLinks=[...document.querySelectorAll('.header nav a')];
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)navLinks.forEach(link=>link.classList.toggle('active',link.hash==='#'+entry.target.id));},{rootMargin:'-100px 0px -55% 0px',threshold:0});for(const id of ['compare','architecture','storage','optimization'])observer.observe($(id));}
renderStorage();init();

// Keep the current chapter when moving between the two static pages.
const languageLink=document.querySelector('.language-switch');
const updateLanguageLink=()=>{languageLink.hash=location.hash;};
updateLanguageLink();
window.addEventListener('hashchange',updateLanguageLink);
