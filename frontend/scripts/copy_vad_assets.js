import fs from 'fs';
import path from 'path';

const publicVad = path.resolve('public/vad');
fs.mkdirSync(publicVad, { recursive: true });

const copyIfExist = (src, dest) => {
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
};

const vadDist = path.resolve('node_modules/@ricky0123/vad-web/dist');
copyIfExist(path.join(vadDist, 'silero_vad_v5.onnx'), path.join(publicVad, 'silero_vad_v5.onnx'));
copyIfExist(path.join(vadDist, 'vad.worklet.bundle.min.js'), path.join(publicVad, 'vad.worklet.bundle.min.js'));

const onnxDist = path.resolve('node_modules/onnxruntime-web/dist');
if (fs.existsSync(onnxDist)) {
  for (const f of fs.readdirSync(onnxDist)) {
    if (f.endsWith('.wasm') || f.endsWith('.mjs')) copyIfExist(path.join(onnxDist, f), path.join(publicVad, f));
  }
}
console.log('✅ Silero VAD & ONNX WASM assets synchronized to public/vad/');
