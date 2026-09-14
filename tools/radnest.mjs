/**
 * التراكز، بدقّة: الركن المتداخل **بيهمّ فقط** لو ركن الابن واقع
 * جوّه منطقة قوس الأب (dx < ركن الأب و dy < ركن الأب). الابن اللي
 * في نصّ الكارت ركنه مالوش علاقة بركن الكارت.
 */
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright'
import {ROUTES} from './routes.mjs'
const ROOT=new URL('../dist/',import.meta.url).pathname,PORT=4498
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'}
const s=http.createServer((q,r)=>{const u=new URL(q.url,'http://x');let f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');r.setHeader('Content-Type',MIME[path.extname(f)]??'application/octet-stream');fs.createReadStream(f).pipe(r)})
await new Promise(r=>s.listen(PORT,r))
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'})
const ctx=await b.newContext({viewport:{width:1600,height:1000}})
await ctx.addInitScript(()=>{sessionStorage.setItem('ab-session','audit');localStorage.setItem('ab-theme','light')})
await ctx.addInitScript(()=>{const k=()=>{const st=document.createElement('style');st.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.appendChild(st)};document.head?k():document.addEventListener('DOMContentLoaded',k)})
const p=await ctx.newPage()
const agg=new Map()
for(const route of ROUTES){
  await p.goto(`http://localhost:${PORT}${route}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(700)
  const got=await p.evaluate(()=>{
    const key=e=>{const c=String(e.className||'').split(' ').filter(Boolean).slice(0,2).join('.');return e.tagName.toLowerCase()+(c?'.'+c:'')}
    const nm=(v,side)=>{const n=parseFloat(v);if(!Number.isFinite(n))return 0;return String(v).includes('%')?(n/100)*side:n}
    const corners=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),side=Math.min(r.width,r.height)
      return {tl:nm(s.borderTopLeftRadius.split(' ')[0],side),tr:nm(s.borderTopRightRadius.split(' ')[0],side),
              br:nm(s.borderBottomRightRadius.split(' ')[0],side),bl:nm(s.borderBottomLeftRadius.split(' ')[0],side),r}}
    const out=[]
    for(const e of document.querySelectorAll('body *')){
      const c=corners(e); if(c.r.width<4||c.r.height<4) continue
      const st=getComputedStyle(e); if(st.visibility==='hidden'||st.opacity==='0') continue
      /* الابن لازم يرسم صندوقًا فعلًا · النصّ جوّه كبسولة مالوش ركن */
      const paints = (st.backgroundColor&&st.backgroundColor!=='rgba(0, 0, 0, 0)')||st.borderTopWidth!=='0px'||(st.boxShadow&&st.boxShadow!=='none')||st.overflow==='hidden'||st.overflowX==='hidden'
      if(!paints) continue
      let par=e.parentElement,d=0,pc=null
      while(par&&d<4){const q=corners(par);const pm=Math.max(q.tl,q.tr,q.br,q.bl)
        if(pm>2&&q.r.width>8&&q.r.height>8){pc=q;break} par=par.parentElement;d++}
      if(!pc) continue
      const PR=pc.r, CR=c.r
      const CORN=[['tl',CR.left-PR.left,CR.top-PR.top,pc.tl,c.tl],
                  ['tr',PR.right-CR.right,CR.top-PR.top,pc.tr,c.tr],
                  ['br',PR.right-CR.right,PR.bottom-CR.bottom,pc.br,c.br],
                  ['bl',CR.left-PR.left,PR.bottom-CR.bottom,pc.bl,c.bl]]
      for(const [name,dx,dy,pr,cr] of CORN){
        if(pr<=2) continue
        /* الأب كبسولة: قوسه نصّ ضلعه، مش 999 */
        const pside=Math.min(PR.width,PR.height); const prc=Math.min(pr,pside/2)
        if(prc<=2) continue
        if(dx<-1||dy<-1) continue
        /* بيهمّ فقط لو ركن الابن جوّه قوس الأب */
        if(dx>=prc||dy>=prc) continue
        const inset=Math.min(dx,dy)
        const ideal=Math.max(0,prc-inset)
        const err=cr-ideal
        if(Math.abs(err)<3) continue
        out.push([key(par),key(e),name,Math.round(prc),Math.round(dx),Math.round(dy),Math.round(ideal),Math.round(cr),Math.round(err)])
      }
    }
    return out
  })
  for(const x of got){const k=x.slice(0,3).join('|');if(!agg.has(k))agg.set(k,{row:x,n:0,routes:new Set()});const a=agg.get(k);a.n++;a.routes.add(route)}
}
await b.close();s.close()
const rows=[...agg.values()].sort((a,b)=>Math.abs(b.row[8])-Math.abs(a.row[8]))
console.log(`═══ أركان متداخلة فعليًّا (ركن الابن جوّه قوس الأب) · ${rows.length} حالة ═══\n`)
console.log('  '+'الأب'.padEnd(26)+'الابن'.padEnd(26)+'ركن  أب  dx  dy  المثالي  الفعلي  الفرق   عدد')
for(const {row,n} of rows.slice(0,40)){
  console.log('  '+row[0].padEnd(26)+row[1].padEnd(26)+row[2].padEnd(5)+String(row[3]).padStart(3)+String(row[4]).padStart(4)+String(row[5]).padStart(4)+String(row[6]).padStart(8)+String(row[7]).padStart(8)+String((row[8]>0?'+':'')+row[8]).padStart(8)+String(n).padStart(6))
}
