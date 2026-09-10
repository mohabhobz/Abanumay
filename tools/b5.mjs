import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright'
import {PNG} from 'pngjs'
const ROOT='/home/claude/abanumay/app/dist'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'}
const s=http.createServer((q,r)=>{const u=new URL(q.url,'http://x');let f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');r.setHeader('Content-Type',MIME[path.extname(f)]??'application/octet-stream');fs.createReadStream(f).pipe(r)})
await new Promise(r=>s.listen(4441,r))
const lum=([r,g,b])=>{const f=c=>{c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)}
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((m,n)=>n-m);return (x+.05)/(y+.05)}
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
for(const theme of ['light','dark','green']){
  const c=await b.newContext({viewport:{width:1560,height:1000},deviceScaleFactor:2})
  await c.addInitScript(t=>{sessionStorage.setItem('ab-session','1');sessionStorage.setItem('abanumay.assistant.greeted','1');localStorage.setItem('ab-theme',t)},theme)
  const p=await c.newPage()
  await p.goto('http://localhost:4441/projects?view=table&size=6',{waitUntil:'domcontentloaded'});await p.waitForTimeout(1700)
  await p.locator('.tbl thead input[type=checkbox]').first().check();await p.waitForTimeout(700)
  await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'})
  await p.waitForTimeout(200)
  const box=await p.locator('.bulkbar').boundingBox()
  const buf=await p.screenshot({clip:box}); const png=PNG.sync.read(buf)
  // أغمق وأفتح بكسل جوّه الشارة والنص
  const stats=(sel)=>p.evaluate(s=>{const e=document.querySelector(s);const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}},sel)
  for(const sel of ['.bulkn','.decsent','.bulkx']){
    const r=await stats(sel)
    const x0=Math.round((r.x-box.x)*2),y0=Math.round((r.y-box.y)*2),w=Math.round(r.w*2),h=Math.round(r.h*2)
    let dark=[255,255,255],light=[0,0,0]
    for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const i=(png.width*y+x)<<2;const px=[png.data[i],png.data[i+1],png.data[i+2]]
      if(lum(px)<lum(dark))dark=px; if(lum(px)>lum(light))light=px}
    console.log(theme.padEnd(6),sel.padEnd(10),'تباين',ratio(dark,light).toFixed(2))
  }
  await p.screenshot({path:`/home/claude/abanumay/shots/b5-${theme}.png`,clip:{...box,y:box.y-18,height:box.height+36}})
  await c.close()
}
await b.close();s.close()
