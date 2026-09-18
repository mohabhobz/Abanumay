/* فحص 2.5.8 بالاستثناءات: هدف أصغر من 24 بيعدّي لو دايرة 24 حواليه ما بتلمسش دايرة هدف تاني */
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright'
import {ROUTES} from './routes.mjs'
import { fileURLToPath } from 'node:url'
const ROOT=fileURLToPath(new URL('../dist/', import.meta.url)),PORT=4491
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'}
const s=http.createServer((q,r)=>{const u=new URL(q.url,'http://x');let f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');r.setHeader('Content-Type',MIME[path.extname(f)]??'application/octet-stream');fs.createReadStream(f).pipe(r)})
await new Promise(r=>s.listen(PORT,r))
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'})
const ctx=await b.newContext({viewport:{width:1600,height:1000}})
await ctx.addInitScript(()=>{sessionStorage.setItem('ab-session','audit');localStorage.setItem('ab-theme','light')})
const p=await ctx.newPage()
const fails=new Map()
for(const route of ROUTES){
  await p.goto(`http://localhost:${PORT}${route}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(700)
  const r=await p.evaluate(()=>{
    const SEL='button,a[href],[role=button],[role=tab],[role=menuitem],[role=checkbox],input:not([type=hidden]),select,summary'
    const els=[...document.querySelectorAll(SEL)].map(e=>({e,r:e.getBoundingClientRect()})).filter(x=>x.r.width>0&&x.r.height>0)
    const key=e=>{const c=String(e.className||'').split(' ').filter(Boolean).slice(0,2).join('.');return e.tagName.toLowerCase()+(c?'.'+c:'')}
    const out=[]
    for(const {e,r} of els){
      if(r.width>=24&&r.height>=24) continue
      if(e.closest('p,li')&&e.tagName==='A'&&getComputedStyle(e).display==='inline') continue // استثناء inline
      const cx=r.x+r.width/2, cy=r.y+r.height/2
      let clash=null
      for(const o of els){ if(o.e===e) continue
        const ox=o.r.x+o.r.width/2, oy=o.r.y+o.r.height/2
        const d=Math.hypot(cx-ox,cy-oy)
        if(d<24){ clash={k:key(o.e),d:Math.round(d)}; break }
      }
      if(clash) out.push([key(e),Math.round(r.width)+'×'+Math.round(r.height),(e.getAttribute('aria-label')||e.textContent.trim()).slice(0,22),clash.k,clash.d])
    }
    return out
  })
  for(const x of r){const k=x[0]+'|'+x[1]+'|'+x[3];if(!fails.has(k))fails.set(k,[route,...x])}
}
await b.close();s.close()
console.log(`═══ سقوط 2.5.8 بعد تطبيق استثناء التباعد · ${fails.size} نمط فريد ═══`)
for(const v of fails.values()) console.log('  '+v.join('  ·  '))
