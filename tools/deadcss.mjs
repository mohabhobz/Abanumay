/* كلاسات معرَّفة في CSS وما ظهرتش في الـDOM عبر كل المسارات */
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright'
import {ROUTES} from './routes.mjs'
const ROOT=new URL('../dist/',import.meta.url).pathname,PORT=4501
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'}
const s=http.createServer((q,r)=>{const u=new URL(q.url,'http://x');let f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');r.setHeader('Content-Type',MIME[path.extname(f)]??'application/octet-stream');fs.createReadStream(f).pipe(r)})
await new Promise(r=>s.listen(PORT,r))
const css=fs.readFileSync(new URL('../src/styles/index.css',import.meta.url),'utf8')
const defs=new Set()
for(const m of css.matchAll(/(^|[\s,>+~(])\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) defs.add(m[2])
const seen=new Set()
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'})
for(const theme of ['light','dark','green']){
  const ctx=await b.newContext({viewport:{width:1600,height:1000}})
  await ctx.addInitScript(t=>{sessionStorage.setItem('ab-session','audit');localStorage.setItem('ab-theme',t)},theme)
  const p=await ctx.newPage()
  for(const route of ROUTES){
    await p.goto(`http://localhost:${PORT}${route}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(600)
    const cl=await p.evaluate(()=>{const s=new Set();for(const e of document.querySelectorAll('*'))for(const c of e.classList)s.add(c);return [...s]})
    for(const c of cl) seen.add(c)
  }
  await ctx.close()
}
await b.close();s.close()
const dead=[...defs].filter(c=>!seen.has(c)).sort()
console.log(`كلاسات في CSS: ${defs.size} · ظهرت في الـDOM: ${[...defs].filter(c=>seen.has(c)).length} · **ما ظهرتش: ${dead.length}**`)
console.log('\n(بعضها حالات hover/focus/error مش مرسومة في الجرد — فدي قايمة "للمراجعة" لا "للحذف")\n')
console.log(dead.join(' · '))
