/**
 * مفيش زرار بلا فعل.
 *
 * ⚠️ **العميل مسك الغلطة دي تلات مرات، وكل مرة في شاشة تانية.**
 * «اكتب أول رسالة» في المراسلة، و«تسجيل جهة جديدة» في الدخول، وآخرهم
 * «خروج» في بوّابة الجهة (٢٢ سبتمبر). والفحص اللي عملته بعدها لقى
 * **١٣ زرارًا** من نفس النوع · منهم «ارفع» في البوّابة، وده الفعل
 * الوحيد اللي الجهة جت البوّابة عشانه.
 *
 * الزرار اللي شكله بيوعد بحاجة وما بيعملهاش **أسوأ من زرار مش
 * موجود**: المستخدم بيضغط، ومفيش حاجة بتحصل، ومفيش حاجة بتقوله
 * ليه · فبيضغط تاني، وبعدين بيفتكر إن السيستم واقع.
 *
 * والدرس اللي بيتكرّر في السيستم ده: **القاعدة المكتوبة في تعليق من
 * غير حاجة بتفحصها بتفضل نيّة.** فالفحص ده بيمنع `<button>` من غير
 * `onClick` ولا `type="submit"` ولا `disabled` ولا props منشورة.
 *
 * والاستثناءات مكتوبة **بسببها** تحت · وكل واحد منهم مستنّي قرار
 * تصميم، مش سهو.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

/**
 * الزراير اللي من غير فعل **عن قصد لحدّ قرار** · بالملف والنصّ.
 *
 * ⚠️ القايمة دي بتقلّ بس · أي زرار جديد بلا فعل بيوقف الكوميت،
 * واللي هنا كل واحد عليه سؤال مفتوح.
 */
const WAIVED = {
  /* أفعال القرار في شريط المشروع بتيجي من الدور (`roles.ts`) ·
     «توصية بالموافقة» و«اعتماد» محتاجة دورة اعتماد المشروع
     نفسها، وده BPD-004 اللي لسه بيتصمّم كتدفّق لا كزرار */
  'components/shell/DecisionBar.tsx': 'أفعال القرار · مستنّية دورة اعتماد المشروع',
  /* أفعال رسالة المساعد (إعادة التوليد · مفيدة · غير مفيدة) ·
     محتاجة باك اند للموديل، والنسخ جنبهم شغّال */
  'components/assistant/AiMessage.tsx': 'أفعال رسالة المساعد · مستنّية الموديل',
  /* إرفاق ملف للمساعد · محتاج قرار: إيه اللي المساعد يقراه */
  'components/assistant/Composer.tsx': 'إرفاق للمساعد · مستنّي قرار النطاق',
  /* «اطلبه من الجهة» بيحتاج قناة المراسلة تبعت فعلًا */
  'features/projects/tabs/EntityTab.tsx': 'طلب مستند · مستنّي إرسال المراسلة',
  /* شرائح نوع المتابعة · إضافة متابعة محتاجة فورمها */
  'features/projects/tabs/index.tsx': 'إضافة متابعة · مستنّية الفورم',
  /* «نسيت كلمة المرور؟» بيقول سببه في `title` · الاستعادة من إدارة
     النظام في النموذج (مكتوب في `LoginPage`) */
  'features/auth/LoginPage.tsx': 'استعادة كلمة المرور · من إدارة النظام',
}

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name))
      : /\.tsx$/.test(e.name) ? [path.join(d, e.name)] : [])

const strip = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

const hits = []
const waived = []
for (const f of walk(SRC)) {
  const rel = path.relative(SRC, f).split(path.sep).join('/')
  const src = strip(fs.readFileSync(f, 'utf8'))
  for (const m of src.matchAll(/<button\b([^>]*)>/g)) {
    const attrs = m[1]
    if (/onClick|type=["']submit["']|disabled|\{\s*\.\.\./.test(attrs)) continue
    const line = src.slice(0, m.index).split('\n').length
    const label = src.slice(m.index + m[0].length, m.index + m[0].length + 200)
      .replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32)
    if (WAIVED[rel]) waived.push(rel)
    else hits.push(`${rel}:${line}  «${label || '؟'}»`)
  }
}

console.log('\n═══ الزراير اللي من غير فعل ═══\n')
if (hits.length) {
  console.log(`🔴 ${hits.length} زرار شكله بيوعد بحاجة وما بيعملهاش:`)
  for (const h of hits) console.log(`   ${h}`)
  console.log('\n   زرار ما بيعملش حاجة أسوأ من زرار مش موجود · وصّله بفعل،')
  console.log('   أو شيله، أو اكتبه في WAIVED بسببه لو مستنّي قرار.\n')
  process.exit(1)
}
console.log(`✅ كل زرار ليه فعل · ${new Set(waived).size} ملف مستنّي قرار (مكتوب بسببه)\n`)
