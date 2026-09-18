import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright'
import {ROUTES} from './routes.mjs'
import { fileURLToPath } from 'node:url'
const ROOT=fileURLToPath(new URL('../dist/', import.meta.url)),PORT=4477
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'}
const s=http.createServer((q,r)=>{const u=new URL(q.url,'http://x');let f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');r.setHeader('Content-Type',MIME[path.extname(f)]??'application/octet-stream');fs.createReadStream(f).pipe(r)})
await new Promise(r=>s.listen(PORT,r))
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'})
const ctx=await b.newContext({viewport:{width:1600,height:1000}})
await ctx.addInitScript(()=>{sessionStorage.setItem('ab-session','audit');localStorage.setItem('ab-theme','light')})
const p=await ctx.newPage()
const bad=new Map()
for(const route of ROUTES){
  await p.goto(`http://localhost:${PORT}${route}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(650)
  const r=await p.evaluate(()=>{
    const out=[]
    const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT)
    let n
    while(n=walk.nextNode()){
      const t=n.textContent
      if(!/%/.test(t)) continue
      const el=n.parentElement; if(!el) continue
      const s=getComputedStyle(el)
      /* ⚠️ **علامات العزل في يونيكود عزلٌ كامل.** `pct()` بتلفّ
         الرقم بـU+2066 (LRI) وU+2069 (PDI)، ودي بتعزل بيديًّا
         من غير أي CSS. الأداة كانت بتفحص `unicode-bidi` وحدها،
         فرجّعت **١٧ حالة** وأكتر من نصّهم معزول أصلًا. */
      const marked = /[\u2066-\u2069\u2068]/.test(t)
      const isolated = marked||s.unicodeBidi.includes('isolate')||s.unicodeBidi.includes('plaintext')
      // النصّ فيه % ورقم ملزوقين؟ لو %  لوحده في عقدة نصّ اتجاهها RTL ← مكسور
      /* `%` لوحده في عقدة (بلا رقم جنبه) بيتعلّق على مزاج الجُمل
         اللي حواليه · والرقم الملزوق بيه محتاج عزلًا */
      const lone = /^\s*%\s*$/.test(t)
      if((lone||!isolated) && /%/.test(t) && s.direction==='rtl'){
        const k=(el.className||el.tagName)+'|'+t.trim().slice(0,26)
        out.push([String(el.className||el.tagName),t.trim().slice(0,34),s.direction,s.unicodeBidi])
      }
    }
    return out
  })
  for(const x of r){const k=x[0]+'|'+x[1];if(!bad.has(k))bad.set(k,[route,...x])}
}
await b.close();s.close()
console.log(`═══ عقد نصّ فيها % في سياق RTL بلا عزل · ${bad.size} حالة فريدة ═══`)
for(const v of [...bad.values()].slice(0,30)) console.log('  '+v.join('  ·  '))
