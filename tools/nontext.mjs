/**
 * تباين غير النصّ (WCAG 1.4.11) — بيقيس حدّ الكمبوننت من البكسل
 * الحقيقي مقابل جارَيه.
 *
 * ⚠️ **مش كل حاجة ليها حدّ لازمها ٣:١.** المعيار بيقول:
 * «المعلومة البصرية **اللازمة لتمييز** عناصر الواجهة وحالاتها».
 * يعني الشرط بيقع على اللي **حدّه هو الدليل الوحيد** إنه تحكّم —
 * الحقل والمنسدلة والمُدخل. أما اللي بيتعرّف بمحتواه (كارت فيه
 * عنوان ورقم · وسم فيه كلمة · تاب شكله أندرلاين) فحدّه زخرفة.
 *
 * أول كتابة حطّت التسعة في سلّة واحدة، فرجّعت **٧ خروقات**
 * والحقيقة **٤**: التاب طلع خرقًا وهو مالوش إطار جانبي **بقصد**
 * (المختار بيتعلّم بخطّ ٢px تحته) · وفاصل صفّ الجدول زخرفة ·
 * ووسم الحالة تسمية ونصّها مقيس في `contrast.mjs` وعدّى.
 * فحص بيبلّغ عن خروقات مش حقيقية بيتعوّد الناس يتجاهلوه.
 */
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright';import {PNG} from 'pngjs'
import { fileURLToPath } from 'node:url'
const ROOT=fileURLToPath(new URL('../dist/', import.meta.url)),PORT=4493
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'}
const s=http.createServer((q,r)=>{const u=new URL(q.url,'http://x');let f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');r.setHeader('Content-Type',MIME[path.extname(f)]??'application/octet-stream');fs.createReadStream(f).pipe(r)})
await new Promise(r=>s.listen(PORT,r))
const lum=([r,g,b])=>{const f=c=>{c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)}
const ratio=(a,b)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)}
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'})
let fails=0
/** [مسار, محدّد, اسم, لازم؟] · `لازم` = حدّه هو الدليل الوحيد إنه تحكّم */
const TARGETS=[
  ['/projects','label.srch','حقل البحث',true],
  ['/projects','button.fsel-b','قائمة منسدلة',true],
  ['/login','span.lbox','حقل الدخول',true],
  ['/projects','button.fchip','شريحة فلتر',true],
  ['/','button.askfab','زرار المساعد',true],
  ['/','a.railitem','عنصر الشريط الجانبي',true],
  /* تحت: بتتقاس للعلم · بتتعرّف بمحتواها لا بحدّها */
  ['/', 'a.kpi','بطاقة مؤشّر (رابط)',false],
  ['/projects','button.tab','تاب (أندرلاين)',false],
  ['/projects','tbody tr','فاصل صفّ الجدول',false],
  ['/projects','.tag','وسم الحالة',false],
  ['/','.btn-ghost','زرار جوست',false],
]
for(const theme of ['light','dark']){
  const ctx=await b.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1})
  await ctx.addInitScript(t=>{sessionStorage.setItem('ab-session','audit');localStorage.setItem('ab-theme',t)},theme)
  await ctx.addInitScript(()=>{const k=()=>{const st=document.createElement('style');st.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.appendChild(st)};document.head?k():document.addEventListener('DOMContentLoaded',k)})
  const p=await ctx.newPage()
  console.log(`\n═══ ${theme} ═══`)
  let last=''
  for(const [route,sel,label,must] of TARGETS){
    if(route!==last){await p.goto(`http://localhost:${PORT}${route}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(800);last=route}
    const box=await p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}},sel)
    if(!box){console.log(`  ${label.padEnd(24)} · مش موجود`);continue}
    const shot=await p.screenshot({clip:{x:Math.max(0,box.x-6),y:Math.max(0,box.y-6),width:Math.min(60,box.w+12),height:Math.min(60,box.h+12)}})
    const png=PNG.sync.read(shot)
    const px=(x,y)=>{const i=(png.width*y+x)<<2;return [png.data[i],png.data[i+1],png.data[i+2]]}
    // سطر أفقي في نص الارتفاع: برّه(2) · الحدّ(6) · جوّه(10)
    const midY=Math.min(png.height-1,Math.round(Math.min(60,box.h+12)/2))
    const outside=px(1,midY), edge=px(6,midY), inside=px(11,midY)
    const r1=ratio(edge,outside), r2=ratio(edge,inside), best=Math.max(r1,r2)
    const ok=best>=3
    const flag=must?(ok?'✔':'✖'):(ok?'✔':'·')
    if(must&&!ok) fails++
    console.log(`  ${flag} ${(label+(must?'':' (للعلم)')).padEnd(30)} الحدّ مقابل الخلفية: ${best.toFixed(2)}:1   (برّه rgb(${outside}) · حدّ rgb(${edge}) · جوّه rgb(${inside}))`)
  }
  await ctx.close()
}
await b.close();s.close()
console.log(fails===0
  ? '\n✅ كل تحكّم حدّه ≥ ٣:١ (WCAG 1.4.11)'
  : `\n⚠️ ${fails} تحكّم تحت ٣:١ · اللي عليه (للعلم) خارج الشرط`)
process.exit(fails===0?0:1)
