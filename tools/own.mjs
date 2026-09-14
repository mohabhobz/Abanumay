import fs from 'node:fs'
import path from 'node:path'
const css=fs.readFileSync('src/styles/index.css','utf8')
/* كل كلاس معرَّف + رقم سطره */
const defs=new Map()
css.split('\n').forEach((ln,i)=>{
  for(const m of ln.matchAll(/(^|[\s,>+~(])\.([a-zA-Z][a-zA-Z0-9_-]*)/g)){
    if(!defs.has(m[2])) defs.set(m[2],i+1)
  }
})
/* كل ملف TSX وكلاساته */
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])
const files=walk('src').filter(f=>/\.tsx?$/.test(f))
const use=new Map() // class -> Set(feature)
const feat=f=>{
  const p=f.replace(/^src\//,'')
  if(p.startsWith('features/')) return 'features/'+p.split('/')[1]
  if(p.startsWith('components/')) return 'components/'+p.split('/')[1]
  if(p.startsWith('app/')) return 'app'
  return 'other'
}
for(const f of files){
  const t=fs.readFileSync(f,'utf8')
  for(const m of t.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)){
    const s=(m[1]||m[2]||m[3]||'').replace(/\$\{[^}]*\}/g,' ')
    for(const c of s.split(/[\s'"]+/).filter(Boolean)){
      if(!use.has(c)) use.set(c,new Set())
      use.get(c).add(feat(f))
    }
  }
}
const owners=new Map()
let unused=0, shared=0, owned=0
for(const [c] of defs){
  const s=use.get(c)
  if(!s||!s.size){unused++;continue}
  if(s.size>1){shared++; continue}
  owned++
  const o=[...s][0]
  owners.set(o,(owners.get(o)??0)+1)
}
console.log(`كلاسات معرَّفة في CSS: ${defs.size}`)
console.log(`  مملوكة لملف/موديول واحد: ${owned}`)
console.log(`  مشتركة بين موديولين+:     ${shared}`)
console.log(`  ما لقتش استعمالها (ديناميكية أو ميتة): ${unused}`)
console.log('\nتوزيع المملوك:')
for(const [o,n] of [...owners.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${o.padEnd(26)} ${n}`)
