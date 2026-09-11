/**
 * فاحص التباين، بيقيس لون النص الفعلي من البكسل مقابل خلفيته،
 * مش من قيم الـCSS: الزجاج والـbackdrop-filter بيخلّوا الخلفية
 * المحسوبة مختلفة عن اللي العين بتشوفه.
 *
 *   npm i -D pngjs          # مرة واحدة، مش في package.json عشان
 *                           # ما يفضلش اعتماد على أداة تطوير
 *   npm run build
 *   node tools/contrast.mjs dark /projects
 *
 * بيطبع كل نص تحت حدّ AA (4.5:1، و3:1 للكبير). النسبة = 1 معناها
 * الحروف غطّت الصندوق كله، إنذار كاذب، مش مشكلة.
 */
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright'
import {PNG} from 'pngjs'
const ROOT='/home/claude/abanumay/app/dist'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.mp4':'video/mp4'}
const s=http.createServer((q,r)=>{const u=new URL(q.url,'http://x');let f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(ROOT,'index.html');r.setHeader('Content-Type',MIME[path.extname(f)]??'application/octet-stream');fs.createReadStream(f).pipe(r)})
await new Promise(r=>s.listen(4440,r))
const lum=([r,g,b])=>{const f=c=>{c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)}
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)}
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
/* `--all` بيمشي على كل المسارات في التلات ثيمات بمتصفّح واحد، ٤٢ صفحة في تشغيلة واحدة بدل ٤٢ تشغيلة. */
import{ROUTES as ALL_ROUTES}from'./routes.mjs'
const all=process.argv.includes('--all')
const THEMES=all?['light','dark','green']:[process.argv[2]||'dark']
const URLS=all?ALL_ROUTES:[process.argv[3]||'/']
let grand=0
for(const theme of THEMES){
const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1})
await c.addInitScript(t=>{sessionStorage.setItem('ab-session','omar');localStorage.setItem('ab-theme',t)},theme)
const p=await c.newPage()
for(const url of URLS){
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
        /* **النصّ المحجوب مش نصّ.** رصيف القرار مثبّت فوق الصفحة،
           والمحتوى اللي تحته بيتمرّر ورا الزرار المصمت. الفحص كان
           بياخد بكسلات الزرار كخلفية للوسم اللي ورا، فيطلع
           ١٫٥٧:١ لنصّ محدش بيقراه أصلًا. الاختبار: لو نقطة وسط
           النصّ مش راجعة العنصر ولا ابنه، فهو محجوب. */
        const cx=Math.round(rect.left+rect.width/2), cy=Math.round(rect.top+rect.height/2)
        const hit=document.elementFromPoint(cx,cy)
        if(!hit||(hit!==el&&!el.contains(hit)&&!hit.contains(el))) continue
        const cs=getComputedStyle(el)
        /* الخلفية لازم تتقاس من بكسلات **بتخصّ العنصر نفسه**.
           الشريط اللي فوق أو تحت صندوق النصّ بيقع أحيانًا على عنصر
           تاني خالص، تحت فقرة فيها زرار مثلًا، فيطلع تباينًا
           كاذبًا بين نصّ الفقرة ولون الزرار.

           فبدل الشريط الأعمى: بنجيب صندوق كل **سطر** من النطاق،
           والصفوف اللي بين السطور (المسافة السطرية) وبين أول سطر
           وحافة العنصر خالية من الحروف **وجوّه العنصر**، وهي
           بالظبط اللي بتدّي لون الخلفية الحقيقي. */
        const eb=el.getBoundingClientRect()
        const lines0=[...r.getClientRects()].sort((a,c)=>a.top-c.top)
        const lines=lines0.map((q)=>({t:Math.round(q.top),b:Math.round(q.bottom)}))
        const gaps=[]
        const push=(t,b)=>{ if(b-t>=2) gaps.push([Math.round(t),Math.round(b)]) }
        if(lines.length){
          push(eb.top+1,lines[0].t-1)
          for(let i=1;i<lines.length;i++) push(lines[i-1].b+1,lines[i].t-1)
          push(lines[lines.length-1].b+1,eb.bottom-1)
        }
        /* الحبّة (`.tag`) ارتفاعها ١٨ ونصّها ١١٫٢، فالفراغ فوق وتحت
           ٣px بس وواقع على المنحنى المصقول، بيخلط لون الحبّة بلون
           السطح ويدّي إنذارًا كاذبًا. في العنصر القصير الفراغ
           **الجانبي** (الحشو الأفقي) أوسع ومسطّح، فبيتقاس منه. */
        const sides=[]
        if(lines.length){
          /* الشريط الجانبي مسموح **بس** لو العنصر له حشو أفقي
             معلَن، يعني الفراغ ده أرضيته هو، مش عنصر جنبه.
             من غير الشرط ده الـ`span` الملزوق بمربّع لون في وسيلة
             إيضاح بيقرأ لون المربّع ويدّي إنذارًا كاذبًا. */
          const ps=parseFloat(cs.paddingInlineStart)||0, pe=parseFloat(cs.paddingInlineEnd)||0
          const L=lines0[0], R=lines0[lines0.length-1]
          const yy=[Math.round(L.top+L.height*0.35),Math.round(L.top+L.height*0.65)]
          if(ps>=5&&L.left-eb.left>=4) sides.push({x0:Math.round(eb.left+2),x1:Math.round(L.left-2),yy})
          if(pe>=5&&eb.right-R.right>=4) sides.push({x0:Math.round(R.right+2),x1:Math.round(eb.right-2),yy})
        }
        /* آخر ملاذ: العنصر اللي نصّه بيملا صندوقه وملوش حشو، مفيش
           فيه بكسل خالٍ من حرف. الشريط برّه بيقع على نصّ الجار
           وبيقرأ لون حروفه. فبنحسب الخلفية من **سلسلة الآباء**:
           بنركّب ألوان الخلفية لحد أول لون صمّاء. */
        const composite=()=>{
          let out=[null,null,null], acc=[0,0,0], a=0
          let q=el
          while(q){
            const m=getComputedStyle(q).backgroundColor.match(/[\d.]+/g)
            if(m){ const [r0,g0,b0]=m.slice(0,3).map(Number); const al=m[3]!==undefined?Number(m[3]):1
              if(al>0){ const k=(1-a)*al; acc=[acc[0]+r0*k,acc[1]+g0*k,acc[2]+b0*k]; a+=k }
              if(a>=.995) break }
            q=q.parentElement
          }
          if(a<=0) return null
          out=acc.map((v)=>Math.round(v/a))
          return out
        }
        out.push({cssBg:composite(),t:n.textContent.trim().slice(0,22),color:cs.color,size:parseFloat(cs.fontSize),weight:cs.fontWeight,
          x:Math.round(rect.left),y:Math.round(rect.top),w:Math.round(rect.width),h:Math.round(rect.height),gaps,sides,
          tall:gaps.some(([a,b])=>b-a>=4),
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
  const strip=(s0)=>{for(const y of s0.yy){if(y<0||y>=png.height)continue
    for(let x=s0.x0;x<=s0.x1;x++){if(x<0||x>=png.width)continue
      const k=px(x,y).join(','); counts.set(k,(counts.get(k)??0)+1)}}}
  if(it.tall){ for(const [a,b] of it.gaps) band(a,b) }
  else if(it.sides?.length){ for(const sd of it.sides) strip(sd) }
  else if(it.gaps?.length){ for(const [a,b] of it.gaps) band(a,b) }
  else if(it.cssBg){ counts.set(it.cssBg.join(','),1) }
  else { band(it.y-4,it.y-1); band(it.y+it.h+1,it.y+it.h+4) }
  if(!counts.size) continue
  const bg=[...counts.entries()].sort((a,z)=>z[1]-a[1])[0][0].split(',').map(Number)
  /* النسبة ١ معناها الحروف غطّت كل اللي اتقاس، مفيش خلفية
     اتشافت، فمفيش حكم. */
  if(fg.join()===bg.join()) continue
  const r=ratio(fg,bg)
  const large=it.size>=24||(it.size>=18.66&&Number(it.weight)>=700)
  const need=large?3:4.5
  if(r<need) bad.push({...it,r:+r.toFixed(2),need,bg:bg.join(','),fg:fg.join(',')})
}
grand+=bad.length
if(!all||bad.length) console.log(`${theme} ${url}، نصوص مفحوصة: ${items.length} · تحت الحدّ: ${bad.length}`)
for(const x of bad.slice(0,14)) console.log(`  ${String(x.r).padStart(5)} (<${x.need}) ${x.cls.padEnd(14)} ${x.size}px  "${x.t}"  fg ${x.fg} / bg ${x.bg}`)
}
await c.close()
}
if(all) console.log(`\n═══ الإجمالي: ${grand} نصًّا تحت AA عبر ${THEMES.length}×${URLS.length} صفحة ═══`)
await b.close();s.close()
