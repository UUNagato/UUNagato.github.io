// Meaningful codec regression: independent packed decode vs saved PyTorch pixels.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unpackModel,tracePixel} from './decoder.mjs';
const read=name=>readFile(new URL('assets/'+name,import.meta.url));
const [meta,blob,data]=await Promise.all([read('model.json').then(JSON.parse),read('model.bin'),read('exhibit.json').then(JSON.parse)]);
assert.equal(blob.length,259912);
assert.equal(createHash('sha256').update(blob).digest('hex'),meta.payload_sha256);
const model=unpackModel(blob.buffer.slice(blob.byteOffset,blob.byteOffset+blob.byteLength),meta);
let maximum=0;
assert.equal(meta.config.architecture,'reallocated_latent');
assert.deepEqual(meta.config.channels,[6,2,3]);
assert.deepEqual(meta.config.bits,[4,4,16]);
for(const fixture of [...data.fixtures,...data.verification_probes]){
  const result=tracePixel(model,fixture.x,fixture.y);
  assert.equal(result.input.length,41);
  assert.deepEqual(result.activations.map(a=>a.length),[80,80,80,3]);
  assert.ok(Math.abs(result.coarse.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
  assert.ok(Math.abs(result.local.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
  assert.equal(result.coarseValues.length,2);
  assert.equal(result.localValues.length,3);
  for(let i=0;i<3;i++){
    const error=Math.abs(fixture.rgb[i]-result.rgb[i]);maximum=Math.max(maximum,error);
    assert.ok(Number.isFinite(error)&&error<0.0001,`Pixel ${fixture.x},${fixture.y}, channel ${i}: ${error}`);
    assert.ok(Math.abs(Math.round(result.rgb[i]*255)-Math.round(fixture.rgb[i]*255))<=1);
  }
}
for(const [name,record] of Object.entries(data.manifest))assert.equal(createHash('sha256').update(await read(name)).digest('hex'),record.sha256, name);
assert.ok(Math.abs(data.scores.neural-46.048776350612584)<1e-6);
assert.ok(Math.abs(data.scores.bc7-42.90428643086807)<1e-6);
assert.equal(blob.length+(await read('model.json')).length,data.total_bytes);
assert.equal(data.total_bytes,261671);
assert.equal(data.history.length,16);
assert.equal(data.history[0].rgb8_psnr,data.scores.before);
assert.equal(data.history.at(-1).rgb8_psnr,data.scores.neural);
assert.equal(data.history.at(-1).stage,'rgb8_3');
console.log(JSON.stringify({passed:true,fixtures:data.fixtures.length,additional_probes:data.verification_probes.length,max_float_rgb_error:maximum,verified_assets:Object.keys(data.manifest).length,total_bytes:data.total_bytes,psnr:data.scores.neural},null,2));
