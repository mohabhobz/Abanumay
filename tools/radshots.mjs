/* لقطات مكبّرة لأركان بعينها · الحكم على التناغم بالعين مش بالرقم */
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright'
const ROOT=new URL('../dist/',import.meta.url).pathname,PORT=4499
const OUT=new URL('../.rad/',import.meta.url).pathname
fs.mkdirSync(OUT,{recursive:true})
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'}
const s=http.createServer((q,r)=>{const u=new URL(q.url,'http://x');let f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');r.setHeader('Content-Type',MIME[path.extname(f)]??'application/octet-stream');fs.createReadStream(f).pipe(r)})
await new Promise(r=>s.listen(PORT,r))
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'})
const ctx=await b.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:4})
await ctx.addInitScript(()=>{sessionStorage.setItem('ab-session','audit');localStorage.setItem('ab-theme','light')})
await ctx.addInitScript(()=>{const k=()=>{const st=document.createElement('style');st.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.appendChild(st)};document.head?k():document.addEventListener('DOMContentLoaded',k)})
const p=await ctx.newPage()
const JOBS=[
 ['/','a.kpi','01_kpi_card_kpi-ic'],
 ['/','nav.rail','02_rail_item'],
 ['/','button.acctbtn','03_acct_circle'],
 ['/projects','div.glass.ftoolbar','04_filter_toolbar'],
 ['/projects','div.glass.qread','05_qread_card_footer'],
 ['/projects','table','06_table_row_ends'],
 ['/projects','div.tabs','07_tabs_pills'],
 ['/entities/755','div.ejr','08_entity_journey'],
 ['/entities/755','span.ejr-ic','09_ejr_icon_circle'],
 ['/budget','div.bgbar','10_budget_bar'],
 ['/projects/20852/agreement','div.pay','11_pay_steps'],
 ['/','div.chbars','12_chart_bars'],
]
let last=''
for(const [route,sel,name] of JOBS){
  if(route!==last){await p.goto(`http://localhost:${PORT}${route}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(900);last=route}
  const el=await p.$(sel)
  if(!el){console.log('مش موجود: '+sel+' في '+route);continue}
  const box=await el.boundingBox()
  if(!box){console.log('بلا صندوق: '+sel);continue}
  try{ await el.scrollIntoViewIfNeeded() }catch{}
  await p.waitForTimeout(250)
  const bb=await el.boundingBox(); if(!bb){console.log('بلا صندوق بعد التمرير: '+sel);continue}
  const vh=1000, x=Math.max(0,Math.min(bb.x-10,1590)), y=Math.max(0,Math.min(bb.y-10,vh-20))
  const w=Math.max(10,Math.min(bb.width+20,1600-x)), h=Math.max(10,Math.min(bb.height+20,vh-y,420))
  await p.screenshot({path:path.join(OUT,name+'.png'),clip:{x,y,width:w,height:h}})
  console.log(`${name}  ${Math.round(box.width)}×${Math.round(box.height)}`)
}
await b.close();s.close()
