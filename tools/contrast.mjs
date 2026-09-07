import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright'
import {PNG} from 'pngjs'
const ROOT='/home/claude/abanumay/app/dist'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.mp4':'video/mp4'}
const s=http.createServer((q,r)=>{const u=new URL(q.url,'http://x');let f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');r.setHeader('Content-Type',MIME[path.extname(f)]??'application/octet-stream');fs.createReadStream(f).pipe(r)})
await new Promise(r=>s.listen(4440,r))
const lum=([r,g,b])=>{const f=c=>{c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)}
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)}
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
const theme=process.argv[2]||'dark', url=process.argv[3]||'/'
const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1})
await c.addInitScript(t=>{sessionStorage.setItem('ab-session','omar');localStorage.setItem('ab-theme',t)},theme)
const p=await c.newPage()
await p.goto('http://localhost:4440'+url,{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500)
const buf=await p.screenshot()
const png=PNG.sync.read(buf)
const px=(x,y)=>{const i=(png.width*y+x)<<2;return [png.data[i],png.data[i+1],png.data[i+2]]}
const items=await p.evaluate(()=>{
  const out=[]
  const walk=(el)=>{
    for(const n of el.childNodes){
      if(n.nodeType===3 && n.textContent.trim().length>1){
        const r=document.createRange();r.selectNodeContents(n)
        const rect=r.getBoundingClientRect()
        if(rect.width<6||rect.height<6||rect.top<0||rect.bottom>900||rect.left<0||rect.right>1440) continue
        if(el.ownerSVGElement||el.tagName==='svg') continue
        const cs=getComputedStyle(el)
        out.push({t:n.textContent.trim().slice(0,22),color:cs.color,size:parseFloat(cs.fontSize),weight:cs.fontWeight,
          x:Math.round(rect.left),y:Math.round(rect.top),w:Math.round(rect.width),h:Math.round(rect.height),
          cls:(el.className&&typeof el.className==='string')?el.className.split(' ')[0]:el.tagName.toLowerCase()})
      } else if(n.nodeType===1) walk(n)
    }
  }
  walk(document.body)
  return out
})
const parse=s=>s.match(/\d+/g).slice(0,3).map(Number)
const bad=[]
for(const it of items){
  // اللون الغالب في صندوق النص ≈ الخلفية، لأن الحروف أقلية من البكسلات
  const fg=parse(it.color)
  // الخلفية بتتقاس من شريط رفيع فوق وتحت صندوق النص: جوّه الصندوق
  // بكسلات هالة الحرف بتخلط اللونين وبتدّي نسبة كاذبة
  const counts=new Map()
  const band=(y0,y1)=>{for(let y=y0;y<y1;y++){if(y<0||y>=png.height)continue
    for(let x=it.x;x<it.x+it.w;x+=2){if(x<0||x>=png.width)continue
      const k=px(x,y).join(','); counts.set(k,(counts.get(k)??0)+1)}}}
  band(it.y-4,it.y-1); band(it.y+it.h+1,it.y+it.h+4)
  if(!counts.size) continue
  const bg=[...counts.entries()].sort((a,z)=>z[1]-a[1])[0][0].split(',').map(Number)
  const r=ratio(fg,bg)
  const large=it.size>=24||(it.size>=18.66&&Number(it.weight)>=700)
  const need=large?3:4.5
  if(r<need) bad.push({...it,r:+r.toFixed(2),need,bg:bg.join(','),fg:fg.join(',')})
}
console.log(`${theme} ${url} — نصوص مفحوصة: ${items.length} · تحت الحدّ: ${bad.length}`)
for(const x of bad.slice(0,14)) console.log(`  ${String(x.r).padStart(5)} (<${x.need}) ${x.cls.padEnd(14)} ${x.size}px  "${x.t}"  fg ${x.fg} / bg ${x.bg}`)
await b.close();s.close()
