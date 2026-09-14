/**
 * كوديمود الارتفاع — بيربط الظلّ الخارجي بسلّم من أربع درجات.
 *
 * ═══ المشكلة ═══
 *
 * **٢٤ وصفة ظلّ خارجي مختلفة** في الملف: `6px 16px -8px` هنا
 * و`8px 18px -10px` هناك و`8px 18px -12px` في التالت — تلات
 * أرقام مختلفة لنفس الإحساس. كل كمبوننت اخترع ارتفاعه.
 *
 * والظلّ **مش زخرفة، هو لغة**: بيقول للعين قدّ إيه العنصر مرفوع
 * عن اللي تحته. أربع درجات كفاية لكل نظام (ماتيريال ٥ · كاربون ٦)،
 * و٢٤ وصفة معناها إن اللغة دي مش مفهومة أصلًا.
 *
 * ═══ السلّم ═══
 *
 *   --el-1  رفعة خفيفة   · عنصر بيرتفع بالهوفر
 *   --el-2  عايم صغير    · تلميح · توست · حقل مركَّز
 *   --el-3  عايم         · قائمة منسدلة · دوك · زرار عايم
 *   --el-4  نافذة        · مودال · معاينة · بطاقة دخول
 *
 * ⚠️ **ولون الظلّ لكل ثيم.** كان `rgba(20,69,71,...)` مكتوبًا
 * بالإيد في كل مكان — أخضر داكن. وده صحّ على خلفية فاتحة وغلط
 * على غامقة: ظلّ ملوّن على أسود ما بيبانش. `--el-c` بتتبدّل.
 *
 * ═══ استثناءات مقصودة ═══
 *
 *   · `0 0 0 Npx` — حلقة لا ظلّ (نبضة · تحديد)
 *   · إزاحة أفقية (`-20px 0 ...`) — درز بين قطاعات، اتجاهي
 *   · طبقات `inset` — حدود لا ارتفاع
 *
 *   node tools/elmod.mjs --dry
 *   node tools/elmod.mjs
 */
import fs from 'node:fs'

const FILE = 'src/styles/index.css'
const DRY = process.argv.includes('--dry')

/** الهندسة (y blur [spread]) → الدرجة */
const MAP = {
  '1px 2px': '--el-1', '2px 14px': '--el-1', '6px 16px -8px': '--el-1',
  '8px 18px -10px': '--el-2', '8px 18px -12px': '--el-2', '8px 20px': '--el-2',
  '8px 22px': '--el-2', '8px 26px': '--el-2', '10px 22px -12px': '--el-2',
  '10px 30px': '--el-2', '12px 26px -12px': '--el-2', '12px 26px -10px': '--el-2',
  '14px 30px': '--el-3', '14px 30px -18px': '--el-3', '14px 32px': '--el-3',
  '16px 38px': '--el-3', '18px 40px -20px': '--el-3', '18px 44px': '--el-3',
  '24px 60px': '--el-4', '24px 60px -18px': '--el-4', '30px 70px': '--el-4',
}

/** قصّ بمراعاة الأقواس · `rgba(a, b, c)` مش فاصلتين */
const splitTop = (s) => {
  const out = []; let d = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') d++
    if (ch === ')') d--
    if (ch === ',' && d === 0) { out.push(cur); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}

let src = fs.readFileSync(FILE, 'utf8')
const hits = new Map()
let n = 0, skipped = 0

const out = src.replace(/box-shadow\s*:\s*([^;}]*)/g, (m, decl) => {
  const layers = splitTop(decl).map((l) => {
    const t = l.trim()
    if (!t || t === 'none' || t.includes('inset') || t.startsWith('var(')) return l
    /* الهندسة = الأرقام قبل اللون · بنسيب أي حاجة فيها calc أو متغيّر */
    if (/calc\(|var\(/.test(t.split(/rgba?\(|#/)[0])) { skipped++; return l }
    const g = t.match(/^\s*0\s+((?:[-0-9.]+px\s*){2,3})/)
    if (!g) { skipped++; return l }
    const key = g[1].trim().replace(/\s+/g, ' ')
    const tok = MAP[key]
    if (!tok) { skipped++; return l }
    hits.set(`${key} → ${tok}`, (hits.get(`${key} → ${tok}`) ?? 0) + 1)
    n++
    return ` var(${tok})`
  })
  return 'box-shadow:' + layers.join(',')
})

console.log(`ربط ${n} طبقة · اتساب ${skipped} (حلقة · اتجاهي · متغيّر)`)
for (const [k, c] of [...hits.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(3)}×  ${k}`)
if (!DRY) { fs.writeFileSync(FILE, out); console.log('\n✅ اتكتب') }
else console.log('\n(تجربة · ما اتكتبش)')
