// 사용법: node tools/compile.js   (targets/ 의 순서대로 targets/targets.mind 생성)
// 마커 순서: targets/order.json 의 배열 (기본: junwoo.png, jungwoo.png)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const order = (fs.existsSync(path.join(root,'targets/order.json')) ? JSON.parse(fs.readFileSync(path.join(root,'targets/order.json'))) : ['junwoo.png','jungwoo.png']).filter(f => fs.existsSync(path.join(root,'targets',f)));
const mime = {'.html':'text/html','.js':'text/javascript','.png':'image/png'};
const srv = http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(d);});});
srv.listen(0, async () => {
  const port = srv.address().port;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage();
  p.on('console', m => console.log('[page]', m.text()));
  p.on('pageerror', e => console.log('[err]', e.message));
  await p.goto(`http://localhost:${port}/tools/compile.html`);
  await p.waitForFunction('window.ready', null, {timeout: 30000});
  console.log('compiling:', order);
  const b64 = await p.evaluate(u => window.compileTargets(u), order.map(f => `/targets/${f}`));
  fs.writeFileSync(path.join(root,'targets/targets.mind'), Buffer.from(b64,'base64'));
  console.log('wrote targets/targets.mind', Buffer.from(b64,'base64').length, 'bytes');
  await b.close(); srv.close();
});
