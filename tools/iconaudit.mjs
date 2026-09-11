/**
 * جرد الأيقونات — **أيقونة واحدة من مكتبة واحدة**.
 *
 * `icons.ts` بتضمن إن اللي بيعدّي من `<Icon>` لوسيد. لكن الأيقونة
 * ممكن تتسرّب من تلات أبواب تانية:
 *
 *   · `<svg>` مرسوم بالإيد جوّه كمبوننت
 *   · شكل مرسوم في CSS بـ`mask` أو `background-image` data-URI
 *   · إيموجي مكتوب في نصّ **معروض**
 *
 * السكربت بيقفل التلاتة. وعشان ما يدّيش إنذارًا كاذبًا:
 *
 *   · الشعار والرسوم البيانية والخريطة **مش أيقونات** — مستثناة
 *     بالاسم في `NOT_ICONS`
 *   · ملمس الخلفية (`feTurbulence`) مش شكل — مستثنى
 *   · الشكل المرسوم في CSS بيتقارن **بمسار لوسيد نفسه**: لو
 *     المسار هو هو، فده استعمال مشروع للمكتبة بصيغة تانية
 *     (القناع محتاج المسار نصًّا عشان التدرّج يبان من خلاله)
 *   · **التعليقات بتتشال قبل البحث عن إيموجي**: الوثيقة الداخلية
 *     فيها ⚠️ و🔴 عن قصد، وهي مش واجهة
 *   · الأسهم (← ⇒ →) **طباعة لا إيموجي** — بتتقري في النصّ العربي
 *     زي أي محرف، فمش ممنوعة
 *
 *   node tools/iconaudit.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = new URL('../src/', import.meta.url).pathname

/** مش أيقونات: هوية أو رسم بياني أو ملمس */
const NOT_ICONS = [
  'assets/Logo.tsx', 'assets/LogoColor.tsx',      // الشعار
  'components/charts/SaudiMap.tsx',               // خريطة السعودية
  'components/charts/index.tsx',                  // الرسوم البيانية
  'components/ui/GateArc.tsx',                    // مروحة الاعتماد
]

/** مسارات لوسيد المسموح استعمالها نصًّا في CSS (القناع) */
const LUCIDE_PATHS = {
  Sparkle: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z',
}

/** الإيموجي التصويري بس — الأسهم والرموز الطباعية مش منه */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

/** يشيل تعليقات JS/TS/CSS — الوثيقة الداخلية مش واجهة */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(Math.max(0, m.length - p.length)))

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name)
    if (e.isDirectory()) walk(f, out)
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(f)
  }
  return out
}

const rel = (f) => f.slice(SRC.length)
const hits = { svg: [], shape: [], emoji: [] }

for (const f of walk(SRC)) {
  const r = rel(f)
  const raw = fs.readFileSync(f, 'utf8')
  const skip = NOT_ICONS.some((x) => r.endsWith(x))
  const lines = raw.split('\n')
  const clean = stripComments(raw).split('\n')

  lines.forEach((line, i) => {
    const at = `${r}:${i + 1}`

    /* ١ · SVG مرسوم بالإيد — في الكمبوننتس بس.
       الـdata-URI في CSS شغل الفحص اللي بعده، وإلا الشكل الواحد
       بيتعدّ مرتين. */
    if (!skip && r.endsWith('.tsx') && /<svg[\s>]/.test(line)) {
      hits.svg.push(at)
    }

    /* ٢ · شكل مرسوم في CSS — مسموح لو مساره مسار لوسيد */
    if (/svg\+xml/.test(line) && !/feTurbulence/.test(line)) {
      const known = Object.entries(LUCIDE_PATHS).find(([, d]) => line.includes(d))
      if (!known) hits.shape.push(at)
    }

    /* ٣ · إيموجي في نصّ معروض — التعليقات مستثناة */
    if (EMOJI.test(clean[i] ?? '')) {
      hits.emoji.push(`${at}  ${line.trim().slice(0, 46)}`)
    }
  })
}

const out = (title, list, note) => {
  console.log(`\n═══ ${title} ═══`)
  if (note) console.log(`  ${note}`)
  if (!list.length) { console.log('  نضيف.'); return }
  for (const x of list) console.log(`  🔴 ${x}`)
}

console.log('════════════════════════════════════════')
console.log(' جرد الأيقونات — مصدر واحد: lucide.dev')
console.log('════════════════════════════════════════')
out('SVG مرسوم بالإيد', hits.svg, `مستثنى: ${NOT_ICONS.length} ملف هوية/رسم بياني`)
out('شكل مرسوم في CSS', hits.shape, 'المسموح: مسار لوسيد نصًّا (القناع) · الملمس')
out('إيموجي في نصّ معروض', hits.emoji, 'التعليقات والأسهم الطباعية مستثناة')
const n = hits.svg.length + hits.shape.length + hits.emoji.length
console.log(`\n═══ ${n} تسريب خارج المكتبة ═══`)
